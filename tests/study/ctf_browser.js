const assert=require('node:assert/strict'),fetch=require('../support/authenticated_fetch.js');
// CTF practice: turn it on for a subject, paste challenges, reveal hints, submit flags, notes, files,
// flagless challenges, editing, topic-page entry points, turning it off, and phone layout.
(async()=>{
 const base='http://127.0.0.1:'+process.argv[2],debug='http://127.0.0.1:'+process.argv[3];
 const pages=await global.fetch(debug+'/json/list').then(r=>r.json()),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,500));return r.result.value};
 const wait=async(q,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await js(q))return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('Timeout: '+q)};
 const dlg="document.querySelector('.ctf-dialog')";
 await fetch.browser(base,call);await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1400,height:950,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:base});// Wait for start-up to finish (it ends on the dashboard) before navigating.
 await wait("typeof openSubjectCtf==='function'&&!!state.subjects.computing&&!!window.portalCtf&&!!document.querySelector('#portalDashboard .week-hour')",20000);await new Promise(r=>setTimeout(r,500));

 // Turn CTF practice on in Edit subject: a CTF tab appears.
 await js("openSubject('computing');openEditSubjectModal('computing')");await wait("!!document.querySelector('#editSubjectCtf')");
 assert.equal(await js("document.querySelector('#editSubjectCtf').checked"),false);
 await js("document.querySelector('#editSubjectCtf').click();document.querySelector('#saveSubjectBtn').click()");
 try{await wait("!!document.querySelector('#view-subject [data-subject-tab=ctf]')")}
 catch(e){throw Error(e.message+' | '+await js("fetch('/api/ctf').then(r=>r.json()).then(d=>JSON.stringify({view:currentView,current:state.currentSubject,enabled:portalCtf.enabled('computing'),server:d.subjects,modal:!!document.querySelector('#editSubjectCtf'),tabs:[...document.querySelectorAll('#view-subject [data-subject-tab]')].map(b=>b.textContent)}))"))}
 assert.equal(await js("[...document.querySelectorAll('#view-subject [data-subject-tab]')].map(b=>b.textContent).join()"),'Topics,Quizzes,Flashcards,CTF,Notes,Progress');
 await js("document.querySelector('#view-subject [data-subject-tab=ctf]').click()");
 await wait("!!document.querySelector('#subjectCtf .ctf-empty')&&document.querySelector('#subjectSectionTitle').textContent==='CTF practice'");
 assert(await js("document.querySelector('#subjectTopics').hidden&&document.querySelector('#view-subject [data-subject-tab=ctf]').classList.contains('active')"));
 assert.match(await js("document.querySelector('#subjectCtf .ctf-empty').textContent"),/Start practising with AI.*Choose.*Copy.*Paste/s);

 // Paste two challenges: preview first, then import.
 const paste=`Challenge: Return address offset
Category: pwn
Difficulty: easy
Flag: FLAG{72}
Flag format: FLAG{...}
Connect: nc localhost 1337
Hint: Count the buffer first.
Hint: Then add the saved frame pointer.
Description:
How many bytes reach the saved return address?
\`\`\`c
void vuln(){ char buf[64]; gets(buf); }
\`\`\`
Solution:
64 bytes of buffer + 8 bytes of saved RBP = 72.

Challenge: Course wargame: blind
Category: misc
Difficulty: hard
Description: From the week 3 wargame. Solve it on the course server.`;
 await js("document.querySelector('#subjectCtf [data-ctf=import]').click()");await wait(dlg+".open&&!!document.querySelector('.ctf-dialog textarea[name=text]')");
 // Step 2 shows the whole prompt, built from step 1's choices.
 const promptText=()=>js("document.querySelector('.ctf-dialog [data-prompt]').textContent");
 assert.match(await promptText(),/^Create 5 capture-the-flag practice challenges for the topic "Networks" in my Computing course\.\nMix the difficulties/);
 await js("{const f=document.querySelector('.ctf-dialog form');f.elements.focus.value='format strings';f.elements.focus.dispatchEvent(new Event('input'));f.elements.level.value='hard';f.elements.level.dispatchEvent(new Event('change'));f.elements.count.value='3';f.elements.count.dispatchEvent(new Event('change'))}");
 assert.match(await promptText(),/^Create 3 .*focusing on: format strings\.\nMake every challenge hard difficulty\./);
 assert.match(await promptText(),/Challenge: \[short title\][\s\S]*Solution:\n\[step-by-step solution ending with the flag\]/);
 await js("document.querySelector('.ctf-dialog [data-ctf=prompt]').click()");await wait("/Copied|Copy failed/.test(document.querySelector('.ctf-dialog [data-ctf=prompt]').textContent)");
 // Step 3 checks a paste by itself.
 await js(`{const t=document.querySelector('.ctf-dialog textarea[name=text]');t.value=${JSON.stringify(paste)};t.dispatchEvent(new Event('input'))}`);
 await wait("document.querySelector('.ctf-preview').textContent.includes('2 challenges ready')");
 assert.match(await js("document.querySelector('.ctf-preview').textContent"),/Return address offset.*flag checked.*2 hints.*solution/s);
 // Start practising opens the first new challenge; Next challenge moves on, like a quiz.
 await js("document.querySelector('.ctf-dialog form').requestSubmit()");
 await wait(dlg+".open&&document.querySelector('.ctf-dialog h2')?.textContent==='Return address offset'&&document.querySelectorAll('#subjectCtf .ctf-card').length===2");
 await js("document.querySelector('.ctf-dialog [data-ctf=next]').click()");await wait("document.querySelector('.ctf-dialog h2')?.textContent==='Course wargame: blind'");
 await js("document.querySelector('.ctf-dialog [data-ctf=close]').click()");await wait("!"+dlg+".open");
 assert.match(await js("document.querySelector('#subjectCtf .ctf-score').textContent"),/0 \/ 2 solved.*0 of 400 points/s);
 const state=await js("fetch('/api/ctf').then(r=>r.text())");
 for(const secret of ['FLAG{72}','64 bytes of buffer','Then add the saved','flag_hash'])assert(!state.includes(secret),'never sent to the browser before it is earned: '+secret);

 // Open the first challenge: code, connection, one hint at a time, wrong and right flags, then the solution.
 const open=title=>js(`[...document.querySelectorAll('#subjectCtf .ctf-card')].find(c=>c.textContent.includes(${JSON.stringify(title)})).click()`);
 await open('Return address offset');await wait(dlg+".open&&!!document.querySelector('.ctf-dialog .ctf-desc pre code')");
 assert.equal(await js("document.querySelector('.ctf-dialog .ctf-desc pre code').textContent"),'void vuln(){ char buf[64]; gets(buf); }');
 assert.equal(await js("document.querySelector('.ctf-dialog .ctf-connect code').textContent"),'nc localhost 1337');
 await js("document.querySelector('.ctf-dialog [data-ctf=hint]').click()");await wait("document.querySelectorAll('.ctf-dialog .ctf-hint').length===1");
 assert.match(await js("document.querySelector('.ctf-dialog [data-ctf=hint]').textContent"),/hint 2 of 2/);
 const submit=async flag=>js(`{const f=document.querySelector('.ctf-dialog [data-ctf-flag]');f.elements.flag.value=${JSON.stringify(flag)};f.requestSubmit()}`);
 await submit('72');await wait("document.querySelector('.ctf-dialog .ctf-feedback').textContent.includes('look like FLAG{...}')");
 await submit('FLAG{64}');await wait("document.querySelector('.ctf-dialog .ctf-feedback').textContent==='Not quite. Keep going.'");
 await submit('FLAG{72}');await wait("document.querySelector('.ctf-dialog .ctf-status').textContent.includes('Correct')");
 assert.match(await js("document.querySelector('.ctf-dialog .ctf-status').textContent"),/Solved.*100 points/);
 assert.match(await js("document.querySelector('.ctf-dialog .ctf-solution').textContent"),/64 bytes of buffer/);
 assert.equal(await js("document.querySelectorAll('.ctf-dialog .ctf-history li').length"),3);

 // Notes save automatically; a file attaches and downloads unchanged.
 await js("{const n=document.querySelector('.ctf-dialog [data-ctf-notes]');n.value='cyclic 100 then cyclic -l';n.dispatchEvent(new Event('input'))}");
 await wait("document.querySelector('[data-ctf-notes-status]').textContent==='Saved ✓'");
 await js(`(async()=>{const input=document.querySelector('.ctf-dialog [data-ctf-file]'),dt=new DataTransfer();dt.items.add(new File([new Uint8Array([127,69,76,70,1,2,3])],'vuln',{type:'application/octet-stream'}));input.files=dt.files;input.dispatchEvent(new Event('change'))})()`);
 await wait("!!document.querySelector('.ctf-dialog .ctf-files a')");
 assert.equal(await js("fetch(document.querySelector('.ctf-dialog .ctf-files a').href).then(r=>r.arrayBuffer()).then(b=>[...new Uint8Array(b)].join())"),'127,69,76,70,1,2,3');
 assert.match(await js("fetch(document.querySelector('.ctf-dialog .ctf-files a').href).then(r=>r.headers.get('content-disposition'))"),/attachment/);

 // Solution code box autosaves; "Check my code" asks the AI mentor and renders a verdict, or a graceful message when no model is reachable.
 await js("{const ed=document.querySelector('.ctf-dialog [data-ctf-code]');ed.value='payload = b\"A\"*72 + p64(0x401176)  # ret2win';ed.dispatchEvent(new Event('input'))}");
 await wait("document.querySelector('[data-ctf-code-status]').textContent==='Saved ✓'");
 await js("document.querySelector('.ctf-dialog [data-ctf=review]').click()");
 await wait("!!document.querySelector('.ctf-review-out .ctf-verdict, .ctf-review-out .ctf-feedback')",45000);
 assert((await js("document.querySelector('.ctf-review-out').textContent.trim().length"))>0,'the review panel shows a result or a reason');
 // the typed code survives closing and reopening the challenge
 await js("document.querySelector('.ctf-dialog [data-ctf=close]').click()");await wait("!"+dlg+".open");
 await open('Return address offset');await wait(dlg+".open&&!!document.querySelector('.ctf-dialog [data-ctf-code]')");
 assert.match(await js("document.querySelector('.ctf-dialog [data-ctf-code]').value"),/p64\(0x401176\)/);
 await js("document.querySelector('.ctf-dialog [data-ctf=close]').click()");
 await wait("document.querySelector('#subjectCtf .ctf-card.solved')?.textContent.includes('Return address offset')");
 assert.match(await js("document.querySelector('#subjectCtf .ctf-score').textContent"),/1 \/ 2 solved.*100 of 400 points/s);

 // A challenge without a stored flag is marked solved by hand.
 await open('Course wargame');await wait(dlg+".open&&!!document.querySelector('.ctf-dialog [data-ctf-solve]')");
 await js("{const f=document.querySelector('.ctf-dialog [data-ctf-solve]');f.elements.found.value='COMP6447{blind}';f.requestSubmit()}");
 await wait("document.querySelector('.ctf-dialog .ctf-status').textContent.includes('Solved')");

 // Editing keeps the stored flag and hidden extras.
 await js("document.querySelector('.ctf-dialog [data-ctf=edit]').click()");await wait("!!document.querySelector('.ctf-dialog form input[name=title]')");
 await js("{const f=document.querySelector('.ctf-dialog form');f.elements.title.value='Week 3 wargame: blind';f.elements.points.value='450';f.requestSubmit()}");
 await wait("document.querySelector('.ctf-dialog h2')?.textContent==='Week 3 wargame: blind'");
 await js("document.querySelector('.ctf-dialog [data-ctf=close]').click()");
 await wait("document.querySelector('#subjectCtf .ctf-score').textContent.includes('2 / 2 solved')");

 // Topic page: a CTF card and a CTF tab lead to the same board, filtered to the topic.
 await js("openTopic('Networks')");await wait("!!document.querySelector('#topicModes .ctf-mode')");
 assert.match(await js("document.querySelector('#topicModes .ctf-mode').textContent"),/2 \/ 2 solved/);
 assert(await js("[...document.querySelectorAll('#view-topic [data-study-tab]')].some(b=>b.textContent==='CTF')"));
 await js("document.querySelector('#topicModes [data-ctf-topic-open]').click()");
 await wait("currentView==='subject'&&document.querySelector('#subjectCtf [data-ctf-filter=topic]')?.value==='Networks'");

 // Phone width in dark mode: the board and a challenge fit without sideways scrolling.
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await js("document.body.classList.add('dark')");
 assert(await js("document.documentElement.scrollWidth<=innerWidth"));
 await open('Return address offset');await wait(dlg+".open");
 assert(await js("(()=>{const d=document.querySelector('.ctf-dialog');return d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().right<=innerWidth})()"));
 await js("document.querySelector('.ctf-dialog [data-ctf=close]').click()");
 await call('Emulation.setDeviceMetricsOverride',{width:1400,height:950,deviceScaleFactor:1,mobile:false});

 // Turning CTF practice off hides it without deleting challenges.
 await js("window.portalCtf.setEnabled('computing',false)");await wait("!document.querySelector('#view-subject [data-subject-tab=ctf]')");
 await js("openTopic('Networks')");await wait("currentView==='topic'");assert.equal(await js("!!document.querySelector('#topicModes .ctf-mode')"),false);
 assert.equal(await js("fetch('/api/ctf').then(r=>r.json()).then(d=>d.challenges.length)"),2);
 assert.deepEqual(errors,[]);
 console.log('PASS CTF practice: subject opt-in, CTF tab, paste import with preview and AI prompt, hidden flags/hints/solutions, hint reveal, flag checks with format help, scoring, notes autosave, file download, flagless challenges, editing, topic card and tab, solution-code autosave and AI mentor review, phone dark layout, turning it off.');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
