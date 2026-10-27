import unittest,tempfile,base64
from pathlib import Path
import backend  # adds backend/<feature> folders to the import path
import note_document as doc

class DocumentTests(unittest.TestCase):
    def test_allowlist_strips_scripts_handlers_and_unsafe_urls_but_keeps_safe_styles(self):
        clean=doc.sanitize('<script>alert(1)</script><svg onload="bad()">bad</svg><p style="color:red;position:fixed" onclick="bad()">Safe <b>bold</b></p><span style="font-size:20px;background:url(x)">big</span><a href="javascript:bad()">link</a><img src="https://tracker.invalid/x">')
        self.assertNotIn('script',clean);self.assertNotIn('onclick',clean);self.assertNotIn('javascript',clean);self.assertNotIn('<img',clean)
        # Text colour and size survive; layout/background/handler styles do not.
        self.assertIn('color:red',clean);self.assertIn('font-size:20px',clean)
        self.assertNotIn('position',clean);self.assertNotIn('url(',clean)
        self.assertIn('<b>bold</b>',clean)
    def test_word_style_sizes_and_spacing_survive_but_unsafe_values_do_not(self):
        clean=doc.sanitize('<p style="line-height:1.8;margin-top:6pt;margin-bottom:0"><span style="font-size:10.5pt;letter-spacing:-0.5pt">Tight</span> <span style="letter-spacing:normal;font-size:72pt">Big</span></p>')
        for kept in ('line-height:1.8','margin-top:6pt','margin-bottom:0','font-size:10.5pt','letter-spacing:-0.5pt','letter-spacing:normal','font-size:72pt'):self.assertIn(kept,clean)
        clean=doc.sanitize('<p style="line-height:expression(bad);letter-spacing:999px;margin-top:-50px;margin-bottom:1pt;font-size:1pt !important">x</p>')
        for dropped in ('expression','999px','-50px','!important'):self.assertNotIn(dropped,clean)
        self.assertIn('margin-bottom:1pt',clean)
    def test_handwriting_pages_keep_only_their_reference(self):
        ink='a'*32
        clean=doc.sanitize(f'<p>a</p><figure data-ink="{ink}" contenteditable="false" data-ink-shown="{ink}"><img src="blob:x"><b>drawn</b></figure><figure data-ink="../x"><p>gone</p></figure><figure><script>bad()</script></figure><p>b</p>')
        self.assertEqual(clean,f'<p>a</p><figure data-ink="{ink}"></figure><p>b</p>')
        self.assertEqual(doc.sanitize(clean),clean);self.assertEqual(doc.plain(clean),'a\nb\n')
    def test_handwriting_files_are_checked_and_never_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)/'uploads';page='v1 lined white|p 1d1d1f 24 400,400,50 4,-2,3 6,1,-2|h ffe14d 180 100,200 40,0'
            ink=doc.save_ink(folder,{'ink':page});self.assertRegex(ink,r'^[a-f0-9]{32}$');self.assertEqual(doc.read_ink(folder,ink),page)
            self.assertNotEqual(doc.save_ink(folder,{'ink':page}),ink)
            for bad in ('v1 lined white|p 1d1d1f 24','v2 lined white','v1 lined white|p 1d1d1f 24 1,2,3<script>','v1 plaid white','','v1 lined white|'+'p 000000 10 1,1,1|'*6001):
                with self.assertRaises(ValueError):doc.save_ink(folder,{'ink':bad})
            with self.assertRaises(ValueError):doc.save_ink(folder,['not','a','page'])
            with self.assertRaises(ValueError):doc.save_ink(folder,{'ink':'v1 lined white|m 000000 10 1,1'+' 1,1'*800000})
            for bad_id in ('../accounts','A'*32,'a'*31,None,'b'*32):
                with self.assertRaises(ValueError):doc.read_ink(folder,bad_id)
    def test_rich_document_roundtrip(self):
        value='<h1>Title</h1><p><u>Underlined</u> <mark>Highlight</mark></p><aside data-callout="tip"><b>Exam Tip</b></aside><ul><li><input type="checkbox" checked="checked">Task</li></ul><pre><code>&lt;code&gt;</code></pre>'
        clean=doc.sanitize(value);self.assertEqual(doc.sanitize(clean),clean);self.assertIn('checked',clean);self.assertIn('data-callout="tip"',clean)
        self.assertIn('Underlined',doc.plain(clean))
    def test_only_local_image_references_allowed(self):
        path='/api/notes/images/'+'a'*32+'.png'
        self.assertIn(path,doc.sanitize('<img src="'+path+'" onerror="bad()">'))
        self.assertEqual(doc.sanitize('<img src="/api/notes/images/../../accounts.db">'),'')
    def test_upload_file_not_database_and_rejects_html(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp)/'uploads';image='data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\nexample').decode()
            url=doc.upload(directory,{'image':image});self.assertTrue((directory/url.rsplit('/',1)[-1]).exists())
            with self.assertRaises(ValueError):doc.upload(directory,{'image':'data:image/png;base64,'+base64.b64encode(b'<script>bad</script>').decode()})
