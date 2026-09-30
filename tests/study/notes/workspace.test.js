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
 await js("document.querySelector('#notebookTitle').value='Workspace test';document.querySelector('#notebookTopic').value='Networks';document.querySelector('#notebookWeek').value=4;var d=document.querySelector('#notebookDocument');d.innerHTML='<h1>Lecture ideas</h1><h2>Core concepts</h2><p>Continuous writing</p>';d.dispatchEvent(new Event('input',{bubbles:true}))");
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
 await action('handwriting');assert(await js("document.querySelector('#notebookDialog').textContent.includes('Coming Soon')"));await dialog('Close');
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
 assert.deepEqual(errors,[]);console.log('PASS notebook workspace: subjects, legacy Markdown, rich formatting, undo/redo, autosave, SQLite reload, metadata, pin, templates, outline, callouts, checklists, sanitised paste, image files, close choices, save failure recovery, AI summary, fullscreen and mobile.');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
