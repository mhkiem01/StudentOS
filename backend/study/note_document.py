"""Conservative rich-note HTML and account-scoped image storage."""
from html.parser import HTMLParser
from html import escape
import base64
import re
import uuid

TAGS=set('p div br h1 h2 h3 h4 h5 h6 strong b em i u s strike ul ol li blockquote pre code mark aside hr a img input span'.split())
VOID={'br','hr','img','input'}
IMAGE=re.compile(r'^/api/notes/images/[a-f0-9]{32}\.(?:png|jpg|webp)$')
COLOR=re.compile(r'^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$',re.I)
SIZE=re.compile(r'^(\d{1,3}(?:\.\d+)?(?:px|pt|rem|em|%)|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$',re.I)
# Spacing set from the editor toolbar: line spacing (a multiple or a length), letter spacing, space before/after paragraphs.
LINE=re.compile(r'^(\d(?:\.\d+)?|\d{1,3}(?:\.\d+)?(?:px|pt|em|%)|normal)$',re.I)
LETTER=re.compile(r'^(-?\d{1,2}(?:\.\d+)?(?:px|pt|em)|0|normal)$',re.I)
GAP=re.compile(r'^(\d{1,3}(?:\.\d+)?(?:px|pt|em)|0)$',re.I)
STYLES={'color':COLOR,'font-size':SIZE,'line-height':LINE,'letter-spacing':LETTER,'margin-top':GAP,'margin-bottom':GAP}
# Handwriting pages (frontend/study/handwriting.js): a note holds <figure data-ink="id">; the strokes live in id.ink.
INK_ID=re.compile(r'[a-f0-9]{32}')
INK_HEAD=re.compile(r'v1 (?:blank|lined|narrow|grid|dotted|cornell|music) (?:white|cream|yellow|dark)')
INK_STROKE=re.compile(r'[pnmhs] [0-9a-f]{6} \d{1,3}(?: -?\d{1,5},-?\d{1,5}(?:,-?\d{1,3})?)+')
MAX_INK=3_000_000

def safe_style(value):
    """Keep only validated text colour, size and spacing from an inline style; drop everything else."""
    out=[]
    for decl in str(value or '').split(';'):
        prop,sep,val=decl.partition(':')
        if not sep:continue
        prop=prop.strip().lower();val=val.strip()
        if prop in STYLES and STYLES[prop].fullmatch(val):out.append(prop+':'+val)
    return ';'.join(out)

class Cleaner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.out=[];self.stack=[];self.blocked=0;self.figure=0;self.figure_kept=False
    def handle_starttag(self,tag,attrs):
        # A handwriting page is kept only as its reference: whatever is inside it was drawn by the app, never stored.
        if self.figure:
            if tag=='figure':self.figure+=1
            return
        if tag=='figure' and not self.blocked:
            ink=dict(attrs).get('data-ink') or ''
            self.figure=1;self.figure_kept=bool(INK_ID.fullmatch(ink))
            if self.figure_kept:self.out.append('<figure data-ink="'+ink+'">')
            return
        if tag in {'script','style','iframe','object','svg','math','template'}:self.blocked+=1;return
        if self.blocked or tag not in TAGS:return
        attrs=dict(attrs);safe=[]
        if tag=='a':
            href=attrs.get('href','').strip()
            if re.match(r'^(https?://|mailto:)',href,re.I):safe.extend([('href',href),('target','_blank'),('rel','noopener noreferrer')])
        if tag=='img':
            if not IMAGE.fullmatch(attrs.get('src','')):return
            safe=[('src',attrs['src']),('alt',attrs.get('alt','Image'))]
        if tag=='input':
            if attrs.get('type')!='checkbox':return
            safe=[('type','checkbox')]
            if 'checked' in attrs:safe.append(('checked','checked'))
        if tag=='aside':
            kind=attrs.get('data-callout','takeaway')
            if kind not in {'takeaway','important','tip','example','question'}:kind='takeaway'
            safe=[('data-callout',kind)]
        style=safe_style(attrs.get('style',''))
        if style:safe.append(('style',style))
        self.out.append('<'+tag+''.join(' '+k+'="'+escape(v,quote=True)+'"' for k,v in safe)+'>')
        if tag not in VOID:self.stack.append(tag)
    def handle_endtag(self,tag):
        if self.figure:
            if tag=='figure':
                self.figure-=1
                if not self.figure and self.figure_kept:self.out.append('</figure>')
            return
        if tag in {'script','style','iframe','object','svg','math','template'}:
            self.blocked=max(0,self.blocked-1);return
        if self.blocked or tag not in self.stack:return
        while self.stack:
            last=self.stack.pop();self.out.append('</'+last+'>')
            if last==tag:break
    def handle_data(self,data):
        if not self.blocked and not self.figure:self.out.append(escape(data))
    def result(self):
        return ''.join(self.out)+('</figure>' if self.figure and self.figure_kept else '')+''.join('</'+t+'>' for t in reversed(self.stack))

def sanitize(value):
    parser=Cleaner();parser.feed(value);return parser.result()

class Text(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,data):self.parts.append(data)
    def handle_endtag(self,tag):
        if tag in {'p','div','li','h1','h2','h3','pre','aside'}:self.parts.append('\n')

def plain(value):
    parser=Text();parser.feed(sanitize(value));return ''.join(parser.parts)

def upload(directory,payload):
    value=payload.get('image','')
    if not isinstance(value,str) or len(value)>7_000_000:raise ValueError('Use an image smaller than 5 MB.')
    match=re.fullmatch(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)',value)
    if not match:raise ValueError('Use a PNG, JPG or WebP image.')
    data=base64.b64decode(match[2],validate=True)
    if len(data)>5*1024*1024:raise ValueError('Use an image smaller than 5 MB.')
    kind=match[1]
    valid=(kind=='png' and data.startswith(b'\x89PNG\r\n\x1a\n')) or (kind=='jpeg' and data.startswith(b'\xff\xd8\xff')) or (kind=='webp' and data[:4]==b'RIFF' and data[8:12]==b'WEBP')
    if not valid:raise ValueError('The image content does not match its file type.')
    directory.mkdir(parents=True,exist_ok=True)
    name=uuid.uuid4().hex+'.'+('jpg' if kind=='jpeg' else kind)
    with (directory/name).open('xb') as target:target.write(data)
    return '/api/notes/images/'+name

def save_ink(directory,payload):
    """Store a handwriting page after checking it is in the stored form exactly; returns its id. Files are never changed."""
    value=payload.get('ink') if isinstance(payload,dict) else None
    if not isinstance(value,str) or not value:raise ValueError('This handwriting page could not be saved.')
    if len(value)>MAX_INK:raise ValueError('This handwriting page is too full to save. Continue on a new page.')
    head,*strokes=value.split('|')
    if not INK_HEAD.fullmatch(head) or len(strokes)>6000 or not all(INK_STROKE.fullmatch(s) for s in strokes):raise ValueError('This handwriting page could not be saved.')
    directory.mkdir(parents=True,exist_ok=True)
    name=uuid.uuid4().hex
    with (directory/(name+'.ink')).open('x',encoding='ascii') as target:target.write(value)
    return name

def read_ink(directory,ink_id):
    if not isinstance(ink_id,str) or not INK_ID.fullmatch(ink_id):raise ValueError('Handwriting page not found.')
    file=directory/(ink_id+'.ink')
    if not file.is_file():raise ValueError('Handwriting page not found.')
    return file.read_text(encoding='ascii')
