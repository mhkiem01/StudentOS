"""Conservative rich-note HTML and account-scoped image storage."""
from html.parser import HTMLParser
from html import escape
import base64
import re
import uuid

TAGS=set('p div br h1 h2 h3 h4 h5 h6 strong b em i u s strike ul ol li blockquote pre code mark aside hr a img input span'.split())
VOID={'br','hr','img','input'}
IMAGE=re.compile(r'^/api/notes/images/[a-f0-9]{32}\.(?:png|jpg|webp)$')

class Cleaner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.out=[];self.stack=[];self.blocked=0
    def handle_starttag(self,tag,attrs):
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
        self.out.append('<'+tag+''.join(' '+k+'="'+escape(v,quote=True)+'"' for k,v in safe)+'>')
        if tag not in VOID:self.stack.append(tag)
    def handle_endtag(self,tag):
        if tag in {'script','style','iframe','object','svg','math','template'}:
            self.blocked=max(0,self.blocked-1);return
        if self.blocked or tag not in self.stack:return
        while self.stack:
            last=self.stack.pop();self.out.append('</'+last+'>')
            if last==tag:break
    def handle_data(self,data):
        if not self.blocked:self.out.append(escape(data))
    def result(self):
        return ''.join(self.out)+''.join('</'+t+'>' for t in reversed(self.stack))

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
