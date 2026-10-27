const fetch=require('../../support/authenticated_fetch.js');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const base=`http://127.0.0.1:${process.argv[2]}`,debug=process.argv[3],pages=await fetch(`http://127.0.0.1:${debug}/json/list`).then(r=>r.json()),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map(),errors=[];
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Page.javascriptDialogOpening')call('Page.handleJavaScriptDialog',{accept:true})};
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const wait=async exp=>{for(let i=0;i<150;i++){if(await js(exp))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out: '+exp+'; status: '+await js("document.querySelector('#notebookStatus')?.textContent"))};
 const state=()=>fetch(base+'/api/portal').then(r=>r.json());
 const action=async name=>js(`document.querySelector('[data-action="${name}"]').click()`);
 const dialog=async label=>js(`[...document.querySelectorAll('#notebookDialog button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
 const shot=async name=>{const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(os.tmpdir(),name),Buffer.from(r.data,'base64'))};
 await fetch.browser(base,call);await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1672,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:base});await wait("!!document.querySelector('#tutorComposer')");await js("document.querySelector('.nav [data-view=notes]').click()");await wait("!!document.querySelector('[data-note-subject=computing]')");
 await js("document.querySelector('[data-note-subject=computing]').click()");
 assert.equal(await js("document.querySelectorAll('[data-open-note]').length"),5);
 assert(!await js("document.querySelector('#notebookCards').textContent.includes('Algebra only')"));
 await js("document.querySelector('[data-note-filter=pinned]').click()");assert.equal(await js("document.querySelectorAll('[data-open-note]').length"),2);
 await js("document.querySelector('[data-note-filter=all]').click();document.querySelector('[data-open-note=n0]').click()");
 assert(await js("document.querySelector('.notebook-editor').getBoundingClientRect().width>innerWidth*.9"));
 assert(await js("!!document.querySelector('#notebookDocument h2') && !!document.querySelector('#notebookDocument aside')"));
 await action('close');assert.equal((await state()).notes.find(n=>n.id==='n0').content_format,'markdown');
 await js("document.querySelector('[data-new-note]').click()");
 assert.equal(await js("document.querySelector('#notebookTitle').value"),'Untitled Note');
 assert.equal(await js("document.querySelector('#notebookSubject').value"),'computing');
 assert(!await js("document.querySelector('#notebookTopic').textContent.includes('Algebra')"));
 await action('save');await wait("!document.querySelector('#notebookSaveError').hidden");
 assert(await js("document.querySelector('#notebookSaveErrorReason').textContent.includes('Topic')"));
 assert.equal(await js("document.querySelector('#notebookTopic').getAttribute('aria-invalid')"),'true');
 await js("document.querySelector('#notebookFixSave').click()");assert.equal(await js('document.activeElement.id'),'notebookTopic');
 await js("document.querySelector('#notebookTitle').value='Workspace test';document.querySelector('#notebookTopic').value='Networks';document.querySelector('#notebookWeek').value=4;var d=document.querySelector('#notebookDocument');d.innerHTML='<h1>Lecture ideas</h1><h2>Core concepts</h2><p>Continuous writing</p>'+'<p>Spaced reading keeps each idea fresh between lectures and tutorials.</p>'.repeat(60);d.dispatchEvent(new Event('input',{bubbles:true}))");
 await wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 let note=(await state()).notes.find(n=>n.title==='Workspace test');assert(note);assert.equal(note.content_format,'html');assert.equal(note.week,4);assert.equal(note.topic_name,'Networks');
 assert.equal(await js("document.querySelectorAll('.notebook-outline').length"),2);
 // Native selection formatting and keyboard history.
 await js("var d=document.querySelector('#notebookDocument');var r=document.createRange();r.selectNodeContents(d.querySelector('p'));var s=getSelection();s.removeAllRanges();s.addRange(r);d.focus();document.dispatchEvent(new Event('selectionchange'))");
 await action('bold');assert(await js("!!document.querySelector('#notebookDocument b,#notebookDocument strong')"));
 await action('undo');assert(!await js("!!document.querySelector('#notebookDocument b,#notebookDocument strong')"));
 await action('redo');assert(await js("!!document.querySelector('#notebookDocument b,#notebookDocument strong')"));
 await action('pin');await action('save');await wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 assert.equal((await state()).notes.find(n=>n.id===note.id).is_pinned,1);
 await action('fullscreen');assert(await js("document.querySelector('.notebook-editor').classList.contains('fullscreen')"));await action('fullscreen');
 // Page view: fixed-size pages (880px tall, 28px apart, 64px/72px top/bottom margins); no block crosses a page margin.
 const pageText="document.querySelector('#notebookPage').textContent",pageOfIn=`(root,c)=>Math.floor((c.getBoundingClientRect().top-root.getBoundingClientRect().top)/908)`;
 await wait(`document.querySelector('.notebook-editor').classList.contains('paged') && ${pageText}.startsWith('Page 1 of ')`);
 const editorPages=+(await js(pageText)).match(/of (\d+)/)[1];assert(editorPages>2,'Long note should span several pages');
 assert.equal(await js("document.querySelectorAll('.notebook-sheets>div').length"),editorPages);
 assert(await js("(()=>{const d=document.querySelector('#notebookDocument'),t=d.getBoundingClientRect().top;return [...d.children].every(c=>{const r=c.getBoundingClientRect(),k=Math.floor((r.top-t)/908);return r.top-t>=k*908+63&&r.bottom-t<=k*908+880-72+1})})()"));
 assert.equal(await js("document.querySelectorAll('.notebook-outline small').length"),2);
 // A pasted wrapper and large code examples must stay inside the paper.
 await js("var paginationOriginal=document.querySelector('#notebookDocument').innerHTML;var d=document.querySelector('#notebookDocument');d.innerHTML='<div>'+('<h2>Important Time Rules</h2><p style=\"font-size:32px\">If the minutes are below 10, use zero.</p><pre>2:02\\nExample pronunciation</pre><p style=\"font-size:32px\">For half past the hour:</p><pre>2:30\\nExample pronunciation</pre>').repeat(12)+'</div>';d.dispatchEvent(new Event('input',{bubbles:true}))");
 await wait("(()=>{const d=document.querySelector('#notebookDocument'),t=d.getBoundingClientRect().top;return [...d.querySelectorAll('h2,p,pre')].every(c=>{const r=c.getBoundingClientRect(),k=Math.floor((r.top-t)/908);return r.top-t>=k*908+63&&r.bottom-t<=k*908+809})})()");
 await js("var d=document.querySelector('#notebookDocument');d.innerHTML=paginationOriginal;d.dispatchEvent(new Event('input',{bubbles:true}))");
 await wait(`${pageText}.endsWith('of ${editorPages}')`);
 await action('pages');assert(await js(`!document.querySelector('.notebook-editor').classList.contains('paged') && ${pageText}===''`));
 await action('pages');assert(await js(`document.querySelector('.notebook-editor').classList.contains('paged') && document.querySelector('[data-action=pages]').getAttribute('aria-pressed')==='true'`));
 // Book view shows the same pages: it opens on the editor's page, keeps every block on the same page number, and returns to the page read.
 const bookStatus="document.querySelector('.notebook-book footer [role=status]').textContent",key=k=>js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'${k}',bubbles:true}))`);
 await js("var s=document.querySelector('.notebook-paper-scroll');s.scrollTop+=document.querySelector('#notebookDocument').getBoundingClientRect().top+2*908-s.getBoundingClientRect().top");await wait(`${pageText}.startsWith('Page 3 of')`);
 await action('book');await wait("!!document.querySelector('.notebook-book')");
 assert(await js(`!document.querySelector('.notebook-book-spread').classList.contains('single') && ${bookStatus}==='Pages 3–4 of ${editorPages}'`));
 assert(await js("!document.querySelector('.notebook-book [contenteditable=true]') && document.querySelector('.notebook-header').inert && document.querySelector('.notebook-book-page').textContent.includes('Continuous writing')"));
 assert(await js(`(()=>{const pg=${pageOfIn},d=document.querySelector('#notebookDocument'),m=document.querySelector('.notebook-book-master .notebook-book-flow');return d.children.length===m.children.length&&[...d.children].every((c,i)=>pg(d,c)===pg(m,m.children[i]))})()`));
 await key('Home');assert.equal(await js(bookStatus),`Pages 1–2 of ${editorPages}`);
 await js("document.querySelector('[data-book=next]').click()");assert((await js(bookStatus)).startsWith('Pages 3–4'));
 await key('ArrowLeft');assert((await js(bookStatus)).startsWith('Pages 1–2'));
 await key('End');assert(await js(`${bookStatus}.endsWith('of ${editorPages}') && document.querySelector('[data-book=next]').disabled`));
 await key('Home');await new Promise(r=>setTimeout(r,400));await shot('notebook-book-desktop.png');
 await js("document.querySelector('[data-book=fullscreen]').click()");await wait("document.fullscreenElement===document.querySelector('.notebook-book')||document.querySelector('.notebook-book').classList.contains('expanded')");
 assert(await js("var r=document.querySelector('.notebook-book').getBoundingClientRect();r.width>=innerWidth-1&&r.height>=innerHeight-1"));assert.equal(await js("document.querySelector('[data-book=fullscreen]').textContent"),'Exit Full Screen');
 await wait(`${bookStatus}==='Pages 1–2 of ${editorPages}'`);
 await js("document.fullscreenElement?document.exitFullscreen():document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");await wait("!document.fullscreenElement&&!document.querySelector('.notebook-book').classList.contains('expanded')");
 await key('Escape');await wait("!document.querySelector('.notebook-book')");
 assert(await js(`!!document.querySelector('.notebook-editor') && !document.querySelector('.notebook-header').inert && document.querySelector('#notebookDialog').hidden && document.activeElement.dataset.action==='book' && ${pageText}.startsWith('Page 1 of')`));
 // Like a word processor: no line of text is ever outside a page, long paragraphs continue onto the next page line by
 // line, headings stay with what follows, short code blocks stay whole. The note mixes paragraphs inside a span and
 // inside headings, as pasted or older notes can.
 const messy='<h2>Telling the time</h2>'+('<p>'+'Long paragraphs flow from one page to the next one line at a time, exactly as a word processor does. '.repeat(6)+'</p><span style="font-size:13px"><h3>Rules</h3><h1><p><strong>Xiànzài jǐ diǎn?</strong><br>现在几点？<br>What time is it now?</p><div><pre><code>2:02\n→ liǎng diǎn líng èr fēn</code></pre></div></h1></span><h3>Asking</h3><h1><div>xiànzài 现在<br> - now</div></h1>').repeat(10);
 const linesOutside=`(()=>{const d=document.querySelector('#notebookDocument'),o=d.getBoundingClientRect().top+64,range=document.createRange(),w=document.createTreeWalker(d,NodeFilter.SHOW_TEXT),bad=[];while(w.nextNode()){const t=w.currentNode;if(!t.data.trim())continue;range.selectNodeContents(t);for(const r of range.getClientRects()){if(!r.height||r.width<1)continue;const k=Math.floor(((r.top+r.bottom)/2-o+164)/908);if(r.top-o<k*908-2||r.bottom-o>k*908+744+2)bad.push(t.data.trim().slice(0,30))}}return bad})()`;
 const splitParagraph="[...document.querySelectorAll('#notebookDocument p')].some(p=>{const o=document.querySelector('#notebookDocument').getBoundingClientRect().top+64,r=document.createRange();r.selectNodeContents(p);return new Set([...r.getClientRects()].filter(x=>x.width>=1).map(x=>Math.floor(((x.top+x.bottom)/2-o+164)/908))).size>1})";
 const strandedHeadings="(()=>{const d=document.querySelector('#notebookDocument'),o=d.getBoundingClientRect().top+64,pg=y=>Math.floor((y-o+164)/908),r=document.createRange(),texts=[],w=document.createTreeWalker(d,NodeFilter.SHOW_TEXT);while(w.nextNode())if(w.currentNode.data.trim())texts.push(w.currentNode);return [...d.querySelectorAll('h2,h3')].filter(h=>{const i=texts.findLastIndex(t=>h.contains(t)),next=texts[i+1];if(i<0||!next)return false;r.selectNodeContents(texts[i]);const a=[...r.getClientRects()].at(-1);r.selectNodeContents(next);return pg(r.getClientRects()[0].top)>pg(a.top)}).length})()";
 const loneLines="[...document.querySelectorAll('#notebookDocument p')].filter(p=>{const o=document.querySelector('#notebookDocument').getBoundingClientRect().top+64,r=document.createRange();r.selectNodeContents(p);const tops=[...new Set([...r.getClientRects()].filter(x=>x.width>=1).map(x=>Math.round(x.top)))],pages=tops.map(t=>Math.floor((t-o+164)/908));return new Set(pages).size>1&&(pages.filter(k=>k===pages[0]).length<2||pages.filter(k=>k===pages.at(-1)).length<2)}).length";
 const wholeCode="[...document.querySelectorAll('#notebookDocument pre')].every(p=>{const o=document.querySelector('#notebookDocument').getBoundingClientRect().top+64,r=p.getBoundingClientRect(),k=Math.floor((r.top-o+164)/908);return r.top-o>=k*908-1&&r.bottom-o<=k*908+744+1})";
 await js(`var d=document.querySelector('#notebookDocument');d.innerHTML=${JSON.stringify(messy)};d.dispatchEvent(new Event('input',{bubbles:true}))`);
 await wait(`${linesOutside}.length===0 && ${splitParagraph} && ${strandedHeadings}===0 && ${loneLines}===0 && ${wholeCode} && +${pageText}.match(/of (\\d+)/)[1]>3`);
 assert.equal(await js("document.querySelectorAll('.notebook-sheet-edges>div').length+1"),await js("document.querySelectorAll('.notebook-sheets>div').length"));
 await shot('notebook-pages-flow.png');
 // Word-style formatting: font size in points (typed, picked, grown and shrunk), line spacing, letter spacing and
 // space before/after, applied run by run so no span ever wraps a paragraph; all of it undoes and is saved.
 const select=body=>js(`(()=>{const d=document.querySelector('#notebookDocument'),p=d.querySelectorAll('p'),r=document.createRange();${body};const s=getSelection();s.removeAllRanges();s.addRange(r);d.focus();document.dispatchEvent(new Event('selectionchange'))})()`);
 const sizeBox="document.querySelector('#notebookFontSize').value",choose=(id,v)=>js(`(()=>{const s=document.querySelector('#${id}');s.value='${v}';s.dispatchEvent(new Event('change'))})()`);
 const styles="[...document.querySelectorAll('#notebookDocument span')].map(s=>s.getAttribute('style')).join('|').replace(/\\s/g,'')";
 await js("var d=document.querySelector('#notebookDocument');d.innerHTML='<p>Alpha beta gamma</p><p>Delta epsilon zeta</p><p>Eta theta</p>';d.dispatchEvent(new Event('input',{bubbles:true}))");
 await select('r.selectNodeContents(p[0])');await wait(`${sizeBox}==='12'`);
 await js("var b=document.querySelector('#notebookFontSize');b.focus();b.value='14';b.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
 assert.equal(await js("document.querySelector('#notebookDocument p span').style.fontSize"),'14pt');await wait(`${sizeBox}==='14'`);
 await select('r.setStart(p[0].querySelector("span").firstChild,6);r.setEnd(p[1].firstChild,5)');await choose('notebookFontSizes','18');
 assert(await js("!document.querySelector('#notebookDocument span p,#notebookDocument span div,#notebookDocument span h1,#notebookDocument span h2,#notebookDocument span h3')"));
 assert.deepEqual(await js("[...document.querySelectorAll('#notebookDocument p')].map(p=>{const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),out=[];while(w.nextNode())out.push(w.currentNode.data+':'+getComputedStyle(w.currentNode.parentNode).fontSize);return out.join('|')})"),['Alpha :18.6667px|beta gamma:24px','Delta:24px| epsilon zeta:16px','Eta theta:16px']);
 await action('grow');assert(await js(`${styles}.includes('font-size:20pt')`));
 await action('undo');assert(await js(`${styles}.includes('font-size:18pt') && !${styles}.includes('20pt')`));
 await action('shrink');assert(await js(`${styles}.includes('font-size:16pt')`));await action('undo');
 await select('r.setStart(p[0].firstChild,0);r.setEnd(p[1].lastChild,3)');await choose('notebookLineSpacing','2');
 assert.deepEqual(await js("[...document.querySelectorAll('#notebookDocument p')].map(p=>p.style.lineHeight)"),['2.4','2.4','']);
 await choose('notebookLetterSpacing','1');assert(await js(`${styles}.includes('letter-spacing:1pt')`));
 await choose('notebookLineSpacing','options');await wait("!!document.querySelector('#notebookLineValue')");assert.equal(await js("document.querySelector('#notebookLineValue').value"),'2');
 await js("document.querySelector('#notebookLineValue').value='1.5';document.querySelector('#notebookBefore').value='6';document.querySelector('#notebookAfter').value='12'");await dialog('Apply');
 assert.deepEqual(await js("[...document.querySelectorAll('#notebookDocument p')].map(p=>[p.style.lineHeight,p.style.marginTop,p.style.marginBottom].join(' '))"),['1.8 6pt 12pt','1.8 6pt 12pt','  ']);
 // With only a cursor, the size applies to what is typed next (the zero-width placeholder is not saved).
 await select('r.setStart(p[2].firstChild,9);r.collapse(true)');await choose('notebookFontSizes','24');await js("document.execCommand('insertText',false,'!')");
 await action('save');await wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 const formatted=(await state()).notes.find(n=>n.id===note.id).content;
 for(const part of ['font-size:14pt','font-size:18pt','line-height:1.8','margin-top:6pt','margin-bottom:12pt','letter-spacing:1pt','font-size:24pt">!'])assert(formatted.includes(part),part+' was not saved: '+formatted);
 assert(!formatted.includes('\u200B'));
 await js("var d=document.querySelector('#notebookDocument');d.innerHTML=paginationOriginal;d.dispatchEvent(new Event('input',{bubbles:true}))");await wait(`${pageText}.endsWith('of ${editorPages}')`);
 // PDF export prints exactly page view's pages, or two per sheet as in Book View, through the browser's print window
 // (stubbed here; the PDF is made with the same print engine). Printing ends by removing the print copy.
 const pdfPages=async()=>{const pdf=Buffer.from((await call('Page.printToPDF',{preferCSSPageSize:true,printBackground:true})).data,'base64').toString('latin1');return [(pdf.match(/\/Type\s*\/Page\b(?!s)/g)||[]).length,[...new Set(pdf.match(/\/MediaBox\s*\[[^\]]*\]/g))].join()]};
 const appTitle=await js('document.title');await js("window.realPrint=window.print;window.print=()=>{window.printCalls=(window.printCalls||0)+1}");
 await action('more');await dialog('📄 Export PDF');await wait("!!document.querySelector('[name=notebookPdfLayout]')");
 assert(await js("document.querySelector('[name=notebookPdfLayout][value=pages]').checked"));await dialog('Export PDF');await wait('window.printCalls===1');
 assert.equal(await js("document.querySelectorAll('body>.notebook-print .notebook-print-page').length"),editorPages);assert.equal(await js('document.title'),'Workspace test');
 assert.deepEqual(await pdfPages(),[editorPages,'/MediaBox [0 0 540 660]']);
 await wait("!document.querySelector('.notebook-print')");assert.equal(await js('document.title'),appTitle);
 await action('book');await wait("!!document.querySelector('.notebook-book')");await js("document.querySelector('[data-book=pdf]').click()");await wait("!!document.querySelector('[name=notebookPdfLayout]')");
 assert(await js("document.querySelector('[name=notebookPdfLayout][value=book]').checked"));await dialog('Export PDF');await wait('window.printCalls===2');
 assert.equal(await js("document.querySelectorAll('body>.notebook-print .notebook-print-sheet').length"),Math.ceil(editorPages/2));
 assert.deepEqual(await pdfPages(),[Math.ceil(editorPages/2),'/MediaBox [0 0 1080 660]']);
 await wait("!document.querySelector('.notebook-print')");await js("window.print=window.realPrint;document.querySelector('[data-book=close]').click()");await wait("!document.querySelector('.notebook-book')");
 // Handwriting pages: added as the chosen page on the chosen paper, written with every tool using real stylus input
 // (pressure included), saved as a file of their own, shown on exactly one page in page view, Book View and the PDF,
 // and reopened by clicking.
 const inkBox=()=>js("(()=>{const r=document.querySelector('.ink-sheet').getBoundingClientRect();return {x:r.left,y:r.top,z:r.width/592}})()");
 const inkStroke=async(points,pointerType='pen',force=.6)=>{
   const b=await inkBox(),at=([x,y])=>({x:b.x+x*b.z,y:b.y+y*b.z}),f=i=>typeof force==='function'?force(i):force;
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',...at(points[0]),pointerType});
   await call('Input.dispatchMouseEvent',{type:'mousePressed',...at(points[0]),button:'left',buttons:1,clickCount:1,pointerType,force:f(0)});
   for(let i=1;i<points.length;i++)await call('Input.dispatchMouseEvent',{type:'mouseMoved',...at(points[i]),button:'left',buttons:1,pointerType,force:f(i)});
   await call('Input.dispatchMouseEvent',{type:'mouseReleased',...at(points.at(-1)),button:'left',buttons:0,clickCount:1,pointerType});
 };
 const wave=(x0,x1,y)=>Array.from({length:31},(_,i)=>[x0+(x1-x0)*i/30,y+8*Math.sin(i/5)]),inkFile=id=>fetch(base+'/api/notes/ink/'+id).then(r=>r.text());
 const inkTool=t=>js(`document.querySelector('.ink-editor [data-tool=${t}]').click()`),inkDo=a=>js(`document.querySelector('.ink-editor [data-do="${a}"]').click()`);
 const inkCount=async()=>+(await js("document.querySelector('.ink-sheet').getAttribute('aria-label')")).match(/(\d+) stroke/)[1];
 await action('handwriting');await wait("!!document.querySelector('#notebookInkAt')");
 assert.equal(await js("document.querySelectorAll('#notebookInkAt option').length"),editorPages+1);
 await js("document.querySelector('#notebookInkAt').value='1';document.querySelector('[name=notebookInkTemplate][value=grid]').click()");await dialog('Start writing');
 await wait("!!document.querySelector('.ink-editor .ink-sheet canvas')");assert(await js("document.querySelector('.notebook-header').inert"));
 await inkTool('p');await inkStroke(wave(70,330,100),'pen',i=>.15+.8*Math.abs(Math.sin(i/4)));
 await inkTool('n');await inkStroke(wave(70,300,160));
 await inkTool('m');await js("document.querySelector('.ink-editor [data-color=\"#e5484d\"]').click()");await inkStroke([[70,220],[320,230]]);
 await inkTool('h');await inkStroke([[64,100],[340,100]]);
 await inkTool('s');await js("document.querySelector('.ink-editor [data-shape=rect]').click()");await inkStroke([[380,80],[540,180]]);
 await inkDo('ruler');await inkTool('p');
 const edge=await js("(()=>{const r=document.querySelector('.ink-ruler').getBoundingClientRect(),s=document.querySelector('.ink-sheet').getBoundingClientRect();return (r.bottom-s.top)/(s.width/592)+6})()");
 await inkStroke([[100,edge],[180,edge+9],[260,edge-7],[400,edge+5]]);await inkDo('ruler');assert.equal(await inkCount(),6);
 await inkTool('e');await js("document.querySelector('.ink-editor [data-eraser=precise]').click()");await inkStroke([[150,85],[150,175]],'mouse');
 const rubbed=await inkCount();assert(rubbed>6,'rubbing cuts strokes in two');
 await inkTool('l');await inkStroke([[370,70],[560,70],[560,200],[370,200],[370,70]],'mouse');await wait("document.querySelector('.ink-status').textContent==='1 stroke selected'");
 await js("document.querySelector('.ink-editor [data-sel=delete]').click()");assert.equal(await inkCount(),rubbed-1);
 await inkDo('undo');assert.equal(await inkCount(),rubbed);await inkDo('redo');await inkDo('undo');
 await key('Escape');await wait("document.querySelector('#notebookDialog:not([hidden])')?.textContent.includes('Discard this handwriting')");await dialog('Keep writing');assert(await js("!!document.querySelector('.ink-editor')"));
 await shot('notebook-handwriting-editor.png');
 await inkDo('done');await wait("!document.querySelector('.ink-editor') && !!document.querySelector('#notebookDocument figure[data-ink] img')");
 await wait(`${pageText}.endsWith('of ${editorPages+1}')`);
 assert.equal(await js("(()=>{const d=document.querySelector('#notebookDocument'),f=d.querySelector('figure[data-ink]');return Math.round(f.getBoundingClientRect().top-d.getBoundingClientRect().top)})()"),908+64,'it is page 2, at the top of the text area');
 await wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 const inkId=await js("document.querySelector('#notebookDocument figure[data-ink]').dataset.ink");
 assert((await state()).notes.find(n=>n.id===note.id).content.includes(`<figure data-ink="${inkId}"></figure>`));
 const written=await js(`StudentInk.decode(${JSON.stringify(await inkFile(inkId))})`);
 assert.equal(written.template,'grid');assert.deepEqual([...new Set(written.strokes.map(s=>s.tool))].sort(),['h','m','n','p','s']);
 assert(written.strokes.some(s=>s.tool==='p'&&s.points.length===2&&s.points[0][1]===s.points[1][1]),'the ruler gave a straight line');
 assert(new Set(written.strokes.filter(s=>s.tool==='p').flatMap(s=>s.points.map(p=>p[2]))).size>3,'pen pressure is kept');
 await action('book');await wait("!!document.querySelector('.notebook-book-page figure[data-ink] img')");
 assert.equal(await js(`(${pageOfIn})(document.querySelector('.notebook-book-master .notebook-book-flow'),document.querySelector('.notebook-book-master figure[data-ink]'))`),1);
 await js("document.querySelector('[data-book=close]').click()");
 await js("window.print=()=>{window.printCalls=(window.printCalls||0)+1}");await action('more');await dialog('📄 Export PDF');await wait("!!document.querySelector('[name=notebookPdfLayout]')");await dialog('Export PDF');
 await wait("!!document.querySelector('body>.notebook-print')");assert(await js("document.querySelectorAll('body>.notebook-print .notebook-print-page')[1].querySelector('figure[data-ink] img').src.startsWith('blob:')"));
 assert.equal((await pdfPages())[0],editorPages+1);await wait("!document.querySelector('.notebook-print')");await js("window.print=window.realPrint");
 // Reopened by clicking it; a change is saved as a new file, and undo in the note brings back the earlier page.
 await js("document.querySelector('#notebookDocument figure[data-ink]').click()");await wait("!!document.querySelector('.ink-editor')");assert.equal(await inkCount(),written.strokes.length);
 await js("var s=document.querySelector('.ink-editor [data-page=template]');s.value='dotted';s.dispatchEvent(new Event('change'))");await inkDo('done');
 await wait(`!document.querySelector('.ink-editor') && document.querySelector('#notebookDocument figure[data-ink]').dataset.ink!=='${inkId}'`);
 assert((await inkFile(await js("document.querySelector('#notebookDocument figure[data-ink]').dataset.ink"))).startsWith('v1 dotted '));
 await action('undo');assert.equal(await js("document.querySelector('#notebookDocument figure[data-ink]').dataset.ink"),inkId);
 // In an empty note the handwriting page simply becomes page 1.
 await js("var d=document.querySelector('#notebookDocument');d.innerHTML='<p><br></p>';d.dispatchEvent(new Event('input',{bubbles:true}))");
 await action('handwriting');await wait("document.querySelector('#notebookDialog').textContent.includes('becomes page 1')");assert(!await js("!!document.querySelector('#notebookInkAt')"));
 await dialog('Start writing');await wait("!!document.querySelector('.ink-editor')");await inkDo('done');await wait("!document.querySelector('.ink-editor')");
 assert.equal(await js("[...document.querySelector('#notebookDocument').children].map(c=>c.tagName).join()"),'FIGURE');await wait(`${pageText}==='Page 1 of 1'`);
 await js("var d=document.querySelector('#notebookDocument');d.innerHTML=paginationOriginal;d.dispatchEvent(new Event('input',{bubbles:true}))");await wait(`${pageText}.endsWith('of ${editorPages}')`);
 await action('tab-templates');await js("document.querySelector('[data-template=\"Cornell Notes\"]').click()");await dialog('Append template');assert(await js("document.querySelector('#notebookDocument').textContent.includes('Lecture ideas') && document.querySelector('#notebookDocument').textContent.includes('Cues and questions')"));
 await action('callout');await dialog('✓ Exam Tip');assert(await js("!!document.querySelector('#notebookDocument aside[data-callout=tip]')"));
 await action('checklist');assert(await js("!!document.querySelector('#notebookDocument input[type=checkbox]')"));
 await js("document.querySelector('#notebookDocument input[type=checkbox]').click()");
 // Pasted HTML must be sanitised before entering the editable document.
 await js("var clip=new DataTransfer();clip.setData('text/html','<p onclick=alert(1)>Safe paste</p><script>window.pasteAttack=1</script><img src=x onerror=alert(1)>');document.querySelector('#notebookDocument').dispatchEvent(new ClipboardEvent('paste',{clipboardData:clip,bubbles:true,cancelable:true}))");
 assert(!await js("!!document.querySelector('#notebookDocument script,#notebookDocument [onclick],#notebookDocument img[src=x]')"));
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD3sAAAAASUVORK5CYII=';
 await js(`var dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0))],'diagram.png',{type:'image/png'}));document.querySelector('#notebookImage').files=dt.files;document.querySelector('#notebookImage').dispatchEvent(new Event('change'))`);
 await wait("!!document.querySelector('#notebookDocument img')");await action('save');await wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 note=(await state()).notes.find(n=>n.id===note.id);assert(note.content.includes('/api/notes/images/'));assert(!note.content.includes('base64'));assert(note.content.includes('checked'));
 await action('tab-outline');await shot('notebook-workspace-desktop.png');
 // Closing while dirty offers explicit safe choices, and discard does not modify SQLite.
 const savedTitle=note.title;
 await js("document.querySelector('#notebookTitle').value='Unsaved title';document.querySelector('#notebookTitle').dispatchEvent(new Event('input'));document.querySelector('[data-action=close]').click()");
 await wait("!document.querySelector('#notebookDialog').hidden");assert(await js("document.querySelector('#notebookDialog').textContent.includes('Save & Close')"));await dialog('Discard Changes');
 assert.equal((await state()).notes.find(n=>n.id===note.id).title,savedTitle);
 await js(`document.querySelector('[data-open-note="${note.id}"]').click()`);assert(await js("document.querySelector('#notebookDocument').textContent.includes('Safe paste')"));
 // Recoverable save failure keeps draft and retryable editor.
 await js("window.realNoteFetch=window.fetch;window.fetch=(url,opt)=>String(url)==='/api/portal'&&opt?.method==='POST'?Promise.reject(Error('Test server unavailable')):window.realNoteFetch(url,opt);document.querySelector('#notebookTitle').value='Recovered title';document.querySelector('#notebookTitle').dispatchEvent(new Event('input'))");
 await wait("document.querySelector('#notebookStatus').textContent.includes('Not saved')");assert.equal((await state()).notes.find(n=>n.id===note.id).title,savedTitle);
 assert(await js("!document.querySelector('#notebookSaveError').hidden && document.querySelector('[data-action=save]').textContent.includes('Retry')"));
 assert(await js("document.querySelector('#notebookSaveError').getBoundingClientRect().top>=document.querySelector('.notebook-header').getBoundingClientRect().bottom-1"));
 await js("window.oldWorkspacePage=true");await call('Page.reload');await wait("!window.oldWorkspacePage && typeof window.portalNotes?.open==='function' && !!document.querySelector('#portalDashboard .week-hour')");
 await js(`window.portalNotes.open('computing','${note.id}')`);await wait("!!document.querySelector('#notebookDialog') && !document.querySelector('#notebookDialog').hidden");
 assert(await js("document.querySelector('#notebookDialog').textContent.includes('Recover unsaved draft')"));await dialog('Restore draft');await wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 assert.equal((await state()).notes.find(n=>n.id===note.id).title,'Recovered title');
 // Edits made while an earlier request is in flight must be saved before reporting success.
 await js("window.realNoteFetch=window.fetch;window.fetch=async(url,opt)=>{if(String(url)==='/api/portal'&&opt?.method==='POST')await new Promise(r=>setTimeout(r,300));return window.realNoteFetch(url,opt)};document.querySelector('#notebookTitle').value='First revision';document.querySelector('#notebookTitle').dispatchEvent(new Event('input'));document.querySelector('[data-action=save]').click();document.querySelector('#notebookTitle').value='Latest revision';document.querySelector('#notebookTitle').dispatchEvent(new Event('input'))");
 await wait("document.querySelector('#notebookStatus').textContent==='Saved'");assert.equal((await state()).notes.find(n=>n.id===note.id).title,'Latest revision');await js("window.fetch=window.realNoteFetch");
 await action('tab-study');await js("document.querySelector('[data-study-tool=summary]').click()");await wait("!document.querySelector('#notebookDialog').hidden");assert(await js("document.querySelector('#notebookDialog').textContent.includes('AI summary')"));await dialog('Close');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 // The writing screen fits a phone: the page fills the width and the tools scroll sideways.
 await action('handwriting');await wait("!!document.querySelector('#notebookDialog:not([hidden])')");await dialog('Start writing');await wait("!!document.querySelector('.ink-editor canvas')");
 assert(await js("(()=>{const e=document.querySelector('.ink-editor').getBoundingClientRect(),s=document.querySelector('.ink-sheet').getBoundingClientRect();return e.right<=innerWidth&&s.width<=innerWidth&&s.width>300&&document.querySelector('.ink-toolbar').scrollWidth>document.querySelector('.ink-toolbar').clientWidth})()"));
 await shot('notebook-handwriting-mobile.png');await js("document.querySelector('.ink-editor [data-do=cancel]').click()");await wait("!document.querySelector('.ink-editor')");
 await action('book');await wait("document.querySelector('.notebook-book-spread')?.classList.contains('single')");
 assert.equal(await js("document.querySelector('#notebookPage').textContent"),'');
 assert(await js("var p=document.querySelector('.notebook-book-page:not([hidden])').getBoundingClientRect();document.querySelector('.notebook-book').getBoundingClientRect().right<=innerWidth && p.right<=innerWidth && p.width>250 && /^Page \\d+ of \\d+ · fitted to screen$/.test(document.querySelector('.notebook-book footer [role=status]').textContent)"));
 await shot('notebook-book-mobile.png');await js("document.querySelector('[data-book=close]').click()");assert(!await js("!!document.querySelector('.notebook-book')"));
 await action('sidebar');assert(await js("document.querySelector('.notebook-editor').getBoundingClientRect().right<=innerWidth"));assert(await js("document.querySelector('#notebookTitle').getBoundingClientRect().width>300"));assert(await js("document.querySelector('.notebook-toolbar').scrollWidth>document.querySelector('.notebook-toolbar').clientWidth"));await shot('notebook-workspace-mobile.png');
 await js("document.querySelector('#notebookWeek').value=101;document.querySelector('#notebookWeek').dispatchEvent(new Event('input',{bubbles:true}))");await action('save');await wait("!document.querySelector('#notebookSaveError').hidden");
 assert.equal(await js("document.querySelector('#notebookWeek').getAttribute('aria-invalid')"),'true');
 for(const dark of [false,true]){await js(`document.body.classList.toggle('dark',${dark})`);assert(await js("document.querySelector('#notebookSaveError').getBoundingClientRect().right<=innerWidth && document.querySelector('#notebookRetrySave').getBoundingClientRect().height>=44"))}
 await shot('notebook-save-error-mobile.png');
 await js("document.querySelector('#notebookWeek').value=4;document.querySelector('#notebookWeek').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#notebookRetrySave').click()");await wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 assert(await js("document.querySelector('#notebookSaveError').hidden && !document.querySelector('#notebookWeek').hasAttribute('aria-invalid')"));
 await action('close');await wait("!document.querySelector('.notebook-editor')");assert.notEqual(await js("document.body.style.overflow"),'hidden');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 for(const kind of ['flashcards','quiz']){
   await js(`window.portalNotes.open('computing','${note.id}')`);await action('tab-study');await js(`document.querySelector('[data-study-tool="${kind}"]').click()`);
   const field=kind==='quiz'?'topicQuestionInput':'topicFlashcardInput',button=kind==='quiz'?'addTopicQuestionsBtn':'addTopicFlashcardsBtn';
   await wait(`!!document.querySelector('#${field}')`);assert(await js(`document.querySelector('#${field}').value.length>20`));
   await js(`document.querySelector('#${button}').click()`);await new Promise(r=>setTimeout(r,1100));
 }
 assert(await js("state.flashcards.Networks.length===1 && state.topics.Networks.length===1"));
 await js(`window.portalNotes.open('computing','${note.id}')`);await action('tab-study');await js("document.querySelector('[data-study-tool=ask]').click()");await wait("document.querySelector('#view-tutor').classList.contains('active') && !document.querySelector('.notebook-editor')");
 assert(await js("document.querySelector('#tutorNoteContext').textContent.includes('Latest revision')"));
 assert.equal((await state()).notes.find(n=>n.id==='math-note').content,'Unique mathematics material.');
 assert.deepEqual(errors,[]);console.log('PASS notebook workspace: subjects, legacy Markdown, rich formatting, undo/redo, autosave, SQLite reload, metadata, pin, templates, outline, callouts, checklists, sanitised paste, image files, close choices, save failure recovery, AI summary, fullscreen, page view (every line inside a page, paragraphs split between pages, headings kept with text, widow/orphan control), book view, Word-style font size, line spacing, letter spacing, paragraph spacing, PDF export (pages and book), handwriting pages (every tool, ruler, eraser, lasso, chosen page, Book View, PDF, reopening) and mobile.');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
