"""Render selected preview pages in a short-lived process, never in the web process.

Only raster images cross the preview boundary: no PDF attachments, actions,
scripts, metadata or unselected page objects are returned to an unowned browser.
Keep PDFium patched. A child-process timeout is not a hardened OS sandbox.
API reference: https://pypdfium2.readthedocs.io/en/stable/python_api.html
"""
import base64
import io
import json
import subprocess
import sys
from pathlib import Path

def preview(content, count=3):
    if int(count) not in (1,3,5):raise ValueError('Choose 1, 3 or 5 preview pages.')
    try:
        r=subprocess.run([sys.executable,str(Path(__file__).resolve()),str(count)],input=content,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=25,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except subprocess.TimeoutExpired:raise ValueError('PDF preview took too long. Try a smaller/simpler PDF.')
    if r.returncode:raise ValueError('Could not safely read this PDF. Use an unencrypted PDF and install requirements-marketplace.txt.')
    try:result=json.loads(r.stdout)
    except Exception:raise ValueError('PDF renderer returned an invalid result.')
    return result

def worker():
    sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'.marketplace-deps'))
    import pypdfium2 as pdfium
    raw=sys.stdin.buffer.read(8*1024*1024+1)
    if len(raw)>8*1024*1024:raise ValueError('PDF is too large.')
    doc=pdfium.PdfDocument(raw);total=len(doc)
    if not 1<=total<=10000:raise ValueError('Unsupported page count.')
    result={'pages':total,'images':[]}
    # Always leave at least one page protected, even if a free listing is later priced.
    for index in range(min(int(sys.argv[1]),max(0,total-1))):
        page=doc[index];w,h=page.get_size()
        if not 1<=w<=20000 or not 1<=h<=20000:raise ValueError('Unsupported page dimensions.')
        scale=min(1100/w,1500/h,2)
        bitmap=page.render(scale=scale,may_draw_forms=False);im=bitmap.to_pil();out=io.BytesIO();im.save(out,format='PNG')
        result['images'].append(base64.b64encode(out.getvalue()).decode('ascii'))
        im.close();bitmap.close();page.close()
    doc.close();sys.stdout.write(json.dumps(result))

if __name__=='__main__':worker()
