import unittest,tempfile,base64
from pathlib import Path
import backend  # adds backend/<feature> folders to the import path
import note_document as doc

class DocumentTests(unittest.TestCase):
    def test_allowlist_strips_scripts_styles_handlers_and_unsafe_urls(self):
        clean=doc.sanitize('<script>alert(1)</script><svg onload="bad()">bad</svg><p style="color:red" onclick="bad()">Safe <b>bold</b></p><a href="javascript:bad()">link</a><img src="https://tracker.invalid/x">')
        self.assertNotIn('script',clean);self.assertNotIn('onclick',clean);self.assertNotIn('style=',clean);self.assertNotIn('javascript',clean);self.assertNotIn('<img',clean)
        self.assertIn('<b>bold</b>',clean)
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
