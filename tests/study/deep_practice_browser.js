const assert=require('node:assert/strict'),fetch=require('../support/authenticated_fetch.js'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
// Deep Practice end to end with the supplied COMP1521 workbook: import preview, practice, reveal, revision,
// self-assessment, assessment mode, reload persistence, mobile layout, sanitising and the multiple-choice importer.
(async()=>{
 const base='http://127.0.0.1:'+process.argv[2],debug='http://127.0.0.1:'+process.argv[3];
 const pages=await global.fetch(debug+'/json/list').then(r=>r.json()),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+' '+(m.params.exceptionDetails.exception?.description||''));else if(m.method==='Page.javascriptDialogOpening')call('Page.handleJavaScriptDialog',{accept:true})};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const wait=async(q,label)=>{for(let i=0;i<150;i++){if(await js(q))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timeout: '+(label||q)+' | notice: '+await js("document.querySelector('[data-dp-notice]')?.textContent||''")+' | save: '+await js("document.querySelector('[data-dp-save]')?.textContent||''"))};
 const click=sel=>js(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)throw Error('Missing '+${JSON.stringify(sel)});el.click()})()`);
 const dialog=async value=>{await wait("document.querySelector('.dp-dialog').open");await click(`.dp-dialog button[value="${value}"]`);await wait("!document.querySelector('.dp-dialog').open")};
 const shot=async name=>{const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(os.tmpdir(),name),Buffer.from(r.data,'base64'))};
 const api=payload=>js(`fetch('/api/deep-practice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(payload)})}).then(r=>r.json())`);
 const body=()=>js('document.body.innerText');
 const source=fs.readFileSync(path.join(__dirname,'fixtures','COMP1521_Part_1_Workbook.md'),'utf8');
 const load=async()=>{await call('Page.navigate',{url:base});await wait("typeof showView==='function'&&!!window.portalDeepPractice&&!!document.querySelector('#portalDashboard .week-hour')")};
 const question=k=>wait(`document.querySelector('#dpQTitle')?.textContent===${JSON.stringify(k)}`,'question '+k);
 const goto=async k=>{await click(`[data-nav="${k}"]`);await question(k)};
 const typeText=(sel,text)=>js(`(()=>{const t=document.querySelector(${JSON.stringify(sel)});t.value=${JSON.stringify(text)};t.dispatchEvent(new Event('input',{bubbles:true}))})()`);
 const saved=()=>wait("document.querySelector('[data-dp-save]')?.textContent==='All changes saved'",'autosave');
 await fetch.browser(base,call);await call('Runtime.enable');await call('Page.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 await load();

 // Import: the Deep Practice option in quiz creation, a full preview, and an editable type before saving.
 assert(await js("!!document.querySelector('#subjectsSubnav [data-view=deep-practice]')"),'Deep Practice is in the Subjects menu');
 await js("showView('import')");await click('#openDeepPracticeImport');await wait("!!document.querySelector('#dpSource')");
 await typeText('#dpSource',source);await js("(()=>{const s=document.querySelector('#dpSubject');s.value='computing';s.dispatchEvent(new Event('change'))})()");
 assert.equal(await js("document.querySelector('#dpSource').value.length"),source.replace(/\r\n/g,'\n').length,'The pasted workbook survives choosing a subject');
 await click('[data-dp=preview]');await wait("!!document.querySelector('.dp-preview')");
 const stats=await js("Object.fromEntries([...document.querySelectorAll('.dp-preview .dp-stats>div')].map(d=>[d.querySelector('dt').textContent,d.querySelector('dd').textContent]))");
 assert.deepEqual(stats,{'Questions':'48','Matched to answers':'48 / 48','Multiple choice':'11 (11 auto-marked)','Topics':'7','Code blocks kept':'45','Checklist items':'12'});
 assert(await js("document.querySelector('.dp-banner.ok').textContent.includes('all 48 questions were matched')"));
 assert(!await js("!!document.querySelector('.dp-issues.error,.dp-issues.warning')"),'No errors or warnings for the supplied workbook');
 assert.equal(await js("document.querySelectorAll('.dp-type-table tbody tr').length"),48);
 const chipText=await js("[...document.querySelectorAll('.dp-breakdown .dp-chips>span')].map(s=>s.textContent)");
 for(const t of ['Registers and memory 11','Part 1 mastery assessment 2','Multiple choice 11','Debugging 8','Fill in the blank 1','Challenging 9','Integration 4'])assert(chipText.includes(t),'Preview shows '+t+' in '+JSON.stringify(chipText));
 assert(!(await body()).includes('Zero constant'),'Solutions are not shown in the import preview');
 await js("(()=>{const s=document.querySelector('[data-override=\"P1-007\"][data-field=type]');s.value='explain';s.dispatchEvent(new Event('change'))})()");
 await click('[data-dp=save-import]');await wait("document.querySelector('.dp-overview-head h1')?.textContent.startsWith('COMP1521 mastery quizzes')");
 await shot('deep-practice-overview.png');
 assert.equal(await js("document.querySelectorAll('.dp-path li').length"),7);assert.equal(await js("document.querySelectorAll('[data-checklist]').length"),12);
 assert(await js("document.querySelector('.dp-col-side').textContent.includes('Coverage map')&&document.querySelector('.dp-col-side').textContent.includes('Corrections and assumptions')"));
 await click('[data-checklist="0"]');await wait("document.querySelector('[data-dp-notice]').textContent==='Checklist saved.'");
 const quizId=(await api({action:'open',quiz_id:(await js("fetch('/api/deep-practice').then(r=>r.json())")).quizzes[0].id})).id;

 // Practice: no solution before the student acts; autosave; navigation keeps answers; no feedback before submitting.
 await click('[data-dp=practice-all]');await question('P1-001');
 assert(!(await js('document.body.innerHTML')).includes('Zero constant'),'Solution is not in the page before reveal');
 assert.equal(await js("document.querySelectorAll('.dp-nav-item[data-nav]').length"),48);
 assert(await js("document.querySelector('[data-nav=\"P1-001\"]').textContent.includes('Not started')"));
 await typeText('#dpText','A register is CPU storage; $zero is always 0.');await saved();
 assert(await js("document.querySelector('[data-nav=\"P1-001\"]').textContent.includes('Draft saved')"));
 await click('[data-dp=next]');await question('P1-002');
 await js("document.querySelector('[data-choice][value=B]').click()");await saved();
 assert(!(await body()).match(/Correct|Not correct/),'No correctness feedback before submitting');
 await click('[data-dp=prev]');await question('P1-001');
 assert.equal(await js("document.querySelector('#dpText').value"),'A register is CPU storage; $zero is always 0.');
 // Reload: the draft is restored from the server.
 await load();await js("showView('deep-practice')");await wait("!!document.querySelector('.dp-card')");await click('[data-dp=resume-card]');await question('P1-001');
 assert.equal(await js("document.querySelector('#dpText').value"),'A register is CPU storage; $zero is always 0.');

 // Submit, reveal, compare, revise after seeing the solution (the original stays), self-assess.
 await js("document.querySelector('input[name=dpConfidence][value=partly]').click()");
 await click('[data-dp=submit]');await wait("!!document.querySelector('.dp-submitted')");
 await click('[data-dp=reveal]');await wait("!!document.querySelector('.dp-review')");
 const review=await js("document.querySelector('.dp-review').innerText");
 for(const t of ['Your answer','Worked answer','Zero constant','Explanation','Key rule','Common mistakes','Check your solution','Your own assessment — not automated marking'])assert(review.includes(t),'Review shows '+t);
 assert(!review.includes('Marked automatically'),'Open responses are not auto-graded');
 await typeText('#dpText','Revised: registers are named CPU storage; memory is addressed bytes.');await saved();
 let attemptId=(await api({action:'open',quiz_id:quizId})).attempts.find(a=>a.status==='active').id,att=await api({action:'attempt',attempt_id:attemptId});
 assert.equal(att.responses['P1-001'].original.response.text,'A register is CPU storage; $zero is always 0.');
 assert.equal(att.responses['P1-001'].original.confidence,'partly');
 assert.equal(att.responses['P1-001'].revision.response.text,'Revised: registers are named CPU storage; memory is addressed bytes.');
 assert(att.responses['P1-001'].revision.after_reveal);
 await click('[data-dp=outcome][data-outcome=independent]');await wait("document.querySelector('[data-nav=\"P1-001\"]').textContent.includes('Independent (self-assessed)')");

 // Multiple choice is marked from the answer key after submitting.
 await goto('P1-002');assert.equal(await js("document.querySelector('[data-choice]:checked').value"),'B');
 await click('[data-dp=submit]');await wait("!!document.querySelector('.dp-submitted')");await click('[data-dp=reveal]');await wait("document.querySelector('.dp-review .dp-banner')?.textContent.startsWith('✓ Correct')");
 assert((await js("document.querySelector('.dp-review').innerText")).includes('loads 37.'),'Why the other options are wrong');
 // Revealing without an attempt is allowed and recorded.
 await goto('P1-003');await click('[data-dp=reveal]');await dialog('reveal');await wait("!!document.querySelector('.dp-review')");
 assert(await js("document.querySelector('[data-nav=\"P1-003\"]').textContent.includes('Solution revealed (no attempt)')"));
 // Fill in the blank: inputs only where the workbook has ___ in code.
 await goto('P1-029');assert.equal(await js("document.querySelectorAll('.dp-prompt .dp-blank').length"),4);
 await js("[...document.querySelectorAll('.dp-prompt .dp-blank')].forEach((b,i)=>{b.value=['1','bgt','1','cond'][i];b.dispatchEvent(new Event('input',{bubbles:true}))})");await saved();
 att=await api({action:'attempt',attempt_id:attemptId});assert.deepEqual(att.responses['P1-029'].draft.blanks,['1','bgt','1','cond']);
 // Code editor: Tab indents inside the editor.
 await goto('P1-036');await js("(()=>{const t=document.querySelector('[data-editor]');t.focus();t.setSelectionRange(0,0)})()");
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await call('Input.insertText',{text:'li $v0, 5'});await saved();
 assert.equal(await js("document.querySelector('[data-editor]').value"),'    li $v0, 5');
 await shot('deep-practice-workspace.png');

 // Long code on a phone: single column, navigator drawer, code scrolls inside its block.
 await goto('P1-047');await click('[data-dp=reveal]');await dialog('reveal');await wait("!!document.querySelector('.dp-review')");
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,300));
 assert(await js('document.documentElement.scrollWidth<=innerWidth'),'No page overflow at 390px with long code');
 assert(await js("[...document.querySelectorAll('.dp-review pre')].some(p=>p.scrollWidth>=p.clientWidth)"));
 assert(await js("getComputedStyle(document.querySelector('#dpNav')).visibility==='hidden'"),'Navigator is a drawer on phones');
 await click('[data-dp=toggle-nav]');await wait("getComputedStyle(document.querySelector('#dpNav')).visibility==='visible'");await shot('deep-practice-mobile-nav.png');
 await click('[data-dp=close-nav]');await js('scrollTo(0,0)');await shot('deep-practice-mobile.png');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});

 // Assessment: answers save, no solutions or marks until the whole assessment is submitted.
 await click('[data-dp=back-overview]');await wait("!!document.querySelector('.dp-overview-head')");
 const progress=await js("document.querySelector('#dpProgressTitle').parentElement.innerText");
 assert(progress.includes('1 / 1 correct')&&progress.includes('Revealed without an attempt\n2'),progress);
 await click('[data-dp=assessment]');await dialog('ok');await question('P1-001');
 assert(!await js("!!document.querySelector('[data-dp=reveal],[data-dp=submit]')"),'No reveal or submit buttons during an assessment');
 await goto('P1-005');await js("document.querySelector('[data-choice][value=A]').click()");await saved();
 assert(!(await body()).match(/Correct|Not correct|Three letters/),'No marks or solutions during the assessment');
 await click('[data-dp=finish]');await wait("document.querySelector('.dp-dialog').open");
 assert((await js("document.querySelector('.dp-dialog').innerText")).includes('47 unanswered questions'));
 await click('.dp-dialog button[value="ok"]');await wait("document.querySelector('#dpQTitle')?.textContent==='Attempt summary'");
 assert((await js("document.querySelector('.dp-summary').innerText")).includes('0 / 1 correct'));
 await goto('P1-005');await wait("document.querySelector('.dp-review .dp-banner')?.textContent.startsWith('✕ Not correct')");
 assert((await js("document.querySelector('.dp-review').innerText")).includes('Three letters + one newline'));

 // Sanitising: HTML in an imported workbook is shown as text and never runs.
 const evil='Evil workbook\nPart 1 — Questions\nSafety\nX-001 · Foundation · Recall\nQuestion: <img src=x onerror="window.dpXss=1"> <script>window.dpXss=2</script> What is safe?\nPart 1 — Answers\nX-001\nAnswer:\n\n<b onclick="window.dpXss=3">Text</b>\n';
 const imported=await api({action:'import',source:evil,source_name:'evil.md'});assert(imported.ok);
 await click('[data-dp=back-overview]');await wait("!!document.querySelector('.dp-overview-head')");await click('[data-dp=library]');await wait(`!!document.querySelector('[data-dp=open][data-id="${imported.id}"]')`);
 await click(`[data-dp=open][data-id="${imported.id}"]`);await wait("!!document.querySelector('.dp-overview-head')");await click('[data-dp=practice-all]');await question('X-001');
 await click('[data-dp=reveal]');await dialog('reveal');await wait("!!document.querySelector('.dp-review')");
 assert(await js("!document.querySelector('.dp-main img,.dp-main script,.dp-main [onclick],.dp-main [onerror]')&&window.dpXss===undefined"));
 assert((await body()).includes('<img src=x onerror="window.dpXss=1">'),'Imported HTML is visible as text');

 // The subject Quizzes tab lists the linked workbook; the multiple-choice importer still works.
 await js("openSubject('computing');renderSubjectQuizzes()");await wait("document.querySelector('.dp-subject')?.textContent.includes('COMP1521 mastery quizzes')");
 await js("showView('import')");await typeText('#quizInput','Topic: Networks\nQuestion: Which layer routes packets?\nAnswer choices:\nA. Network\nB. Physical\nAnswer: A\nExplain: Routing is a network-layer job.');
 await click('#generateBtn');await wait("(state.topics.Networks||[]).some(q=>q.question.includes('routes packets'))",'MCQ import');
 assert.equal(await js("state.topics.Networks.find(q=>q.question.includes('routes packets')).answer"),'A');
 assert.deepEqual(errors,[]);
 console.log('PASS Deep Practice: workbook preview (48/48 matched, 11 MCQ), editable types, practice autosave/navigation/reload, hidden solutions, original kept after revision, self-assessment, MCQ marking, reveal without attempt, blanks, code editor, assessment delays feedback, 390px long code, sanitised HTML, subject tab, MCQ importer intact.');
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
