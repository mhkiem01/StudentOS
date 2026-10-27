const assert=require('node:assert/strict'),adminFetch=require('../support/authenticated_fetch.js');
// Two accounts in one browser (separate contexts): share a note from its ••• menu, the card in Messages,
// save into your own subject, live updates, asking for and granting edit permission, editing, and revoking.
// Run with: python tests/support/run_browser_check.py --share
(async()=>{
 const base='http://127.0.0.1:'+process.argv[2],debug='http://127.0.0.1:'+process.argv[3];
 const connect=async url=>{const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map(),errors=[];
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
  const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,600));return r.result.value};
  const wait=async(q,ms=15000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await js(q))return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('Timeout: '+q)};
  return {ws,call,js,wait,errors}};
 const shots=require('node:path').join(require('node:os').tmpdir(),'portal-note-share');require('node:fs').mkdirSync(shots,{recursive:true});
 const shot=async(page,name)=>{const x=await page.call('Page.captureScreenshot',{format:'png'});require('node:fs').writeFileSync(require('node:path').join(shots,name+'.png'),Buffer.from(x.data,'base64'))};
 const json=r=>r.json().then(j=>{if(!r.ok)throw Error(JSON.stringify(j));return j});
 const post=(f,url,body)=>f(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(json);

 // Accounts: the fixture admin and a friend with their own subject.
 await post(adminFetch,'/api/admin/users',{username:'notefriend',display_name:'Casey Friend',password:'Temporary-pass-123!'});
 const login=async password=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Portal-Request':'1'},body:JSON.stringify({username:'notefriend',password})});const j=await json(r);return {cookie:r.headers.get('set-cookie').split(';')[0],id:j.user.id,must:j.user.must_change}};
 let friend=await login('Temporary-pass-123!');
 if(friend.must){await fetch(base+'/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json','X-Portal-Request':'1','X-Portal-Account':friend.id,Cookie:friend.cookie},body:JSON.stringify({current_password:'Temporary-pass-123!',new_password:'Fixture-password-456!'})});friend=await login('Fixture-password-456!')}
 const friendFetch=(url,o={})=>fetch(url,{...o,headers:{...o.headers,Cookie:friend.cookie,'X-Portal-Request':'1','X-Portal-Account':friend.id}});
 await friendFetch(base+'/api/state').then(json);
 await post(friendFetch,'/api/state',{subjects:{mine:{name:'Security',topics:['Pwn']}},topics:{Pwn:[]}});
 const social=(f,action,data={},id)=>post(f,'/api/social',{action,data,id});
 await social(adminFetch,'profile',{enabled:true,discoverable:true});await social(friendFetch,'profile',{enabled:true,discoverable:true});
 await social(adminFetch,'friend',{user_id:friend.id,operation:'request'});await social(friendFetch,'friend',{user_id:'admin',operation:'accept'});
 await post(adminFetch,'/api/portal',{table:'notes',item:{id:'n-share',subject_id:'computing',topic_name:'Networks',title:'TCP handshake',content:'<p>SYN, SYN-ACK, ACK.</p>',content_format:'html'}});

 // Two pages: A = admin, B = Casey in a separate browser context.
 const version=await fetch(debug+'/json/version').then(r=>r.json()),browser=await connect(version.webSocketDebuggerUrl);
 const {browserContextId}=await browser.call('Target.createBrowserContext');const {targetId}=await browser.call('Target.createTarget',{url:'about:blank',browserContextId});
 const list=await fetch(debug+'/json/list').then(r=>r.json());
 const A=await connect(list.find(p=>p.type==='page'&&p.id!==targetId).webSocketDebuggerUrl),B=await connect(list.find(p=>p.id===targetId).webSocketDebuggerUrl);
 for(const page of [A,B]){await page.call('Runtime.enable');await page.call('Page.enable');await page.call('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false})}
 await adminFetch.browser(base,A.call);await B.call('Network.setCookie',{name:'portal_session',value:friend.cookie.slice('portal_session='.length),url:base,path:'/',httpOnly:true,sameSite:'Strict'});
 for(const page of [A,B]){await page.call('Page.navigate',{url:base});await page.wait("!!window.portalNoteShares&&!!window.portalSocialCalls&&!!document.querySelector('#portalDashboard .week-hour')",20000);await new Promise(r=>setTimeout(r,600))}
 const more=async(page,label)=>{await page.js("document.querySelector('.notebook-editor [data-action=more]').click()");await page.wait(`[...document.querySelectorAll('#notebookDialog button')].some(b=>b.textContent.includes(${JSON.stringify(label)}))`);await page.js(`[...document.querySelectorAll('#notebookDialog button')].find(b=>b.textContent.includes(${JSON.stringify(label)})).click()`)};
 const openOwn=async()=>{await A.js("portalNotes.open('computing','n-share')");await A.wait("!!document.querySelector('.notebook-editor')&&document.querySelector('#notebookTitle').value==='TCP handshake'")};
 const card="document.querySelector('#socialMessages .share-card')";

 // A shares the note from its ••• menu.
 await openOwn();await more(A,'Share with friends');
 await A.wait("document.querySelector('.share-dialog')?.open&&!!document.querySelector('.share-dialog [name=friend]')");
 assert.match(await A.js("document.querySelector('.share-dialog').textContent"),/Casey Friend/);await shot(A,'share-dialog');
 await A.js("document.querySelector('.share-dialog [name=friend]').click();document.querySelector('.share-dialog form').requestSubmit()");
 await A.wait("!document.querySelector('.share-dialog').open&&document.querySelector('#shareToast')?.textContent.includes('Casey Friend')");

 // B finds the card in Messages, saves the note into their own subject and opens it view-only.
 await B.js("showView('social-messages')");await B.wait("!!document.querySelector('.social-view.active [data-social=chat]')");
 await B.js("document.querySelector('.social-view.active [data-social=chat]').click()");
 await B.wait(card+"?.textContent.includes('TCP handshake')&&"+card+".textContent.includes('View only')");
 await B.js(card+".querySelector('[data-share-save]').click()");await B.wait("document.querySelector('.share-dialog')?.open&&!!document.querySelector('.share-dialog [name=subject]')");
 await B.js("{const f=document.querySelector('.share-dialog form');f.elements.subject.value='mine';f.elements.subject.dispatchEvent(new Event('change'));f.elements.topic.value='Pwn';f.requestSubmit()}");
 await B.wait(card+".textContent.includes('In your subjects')");await shot(B,'message-card');
 await B.js("portalNotes.open('mine')");await B.wait("!!document.querySelector('#notebookCards [data-open-shared]')");
 assert.match(await B.js("document.querySelector('#notebookCards .shared-group').textContent"),/Shared with you.*TCP handshake.*Pwn.*View only/s);
 await B.js("document.querySelector('#notebookCards [data-open-shared]').click()");
 await B.wait("!!document.querySelector('.notebook-editor .notebook-shared-badge')&&document.querySelector('#notebookDocument').textContent.includes('SYN-ACK')");
 assert.equal(await B.js("document.querySelector('#notebookDocument').contentEditable"),'false');await shot(B,'shared-viewer');
 assert(await B.js("['.notebook-toolbar','.notebook-inserts','[data-action=save]'].every(sel=>getComputedStyle(document.querySelector('.notebook-editor '+sel)).display==='none')"),'view-only notes show no editing tools');
 assert.match(await B.js("document.querySelector('.notebook-shared-badge').textContent"),/Shared by Test Student · View only · Live/);

 // Live: A's save shows up in B's open note.
 const type=async(page,text)=>page.js(`{const d=document.querySelector('#notebookDocument');d.innerHTML=${JSON.stringify(text)};d.dispatchEvent(new Event('input'));document.querySelector('.notebook-editor [data-action=save]').click()}`);
 await type(A,'<p>SYN, SYN-ACK, ACK. Then data flows.</p>');
 await B.wait("document.querySelector('#notebookDocument').textContent.includes('Then data flows.')",15000);

 // B asks to edit; A allows it from the card in Messages; B's edit reaches A live.
 await more(B,'Ask to edit');await B.wait("document.querySelector('#notebookStatus').textContent.includes('Asked to edit')");
 await A.wait("document.querySelector('#notebookStatus').textContent==='Saved'");await A.js("document.querySelector('.notebook-editor [data-action=close]').click()");await A.wait("!document.querySelector('.notebook-editor')");
 await A.js("showView('social-messages')");await A.wait("!!document.querySelector('.social-view.active [data-social=chat]')");
 await A.js("document.querySelector('.social-view.active [data-social=chat]').click()");
 await A.wait("[...document.querySelectorAll('#socialMessages .share-card')].some(c=>c.textContent.includes('Wants to edit'))");await shot(A,'edit-request');
 await A.js("[...document.querySelectorAll('#socialMessages [data-share-allow]')].at(-1).click()");
 await A.wait("[...document.querySelectorAll('#socialMessages .share-card')].some(c=>c.textContent.includes('Editing allowed'))");
 await B.wait(card+"&&!"+card+".querySelector('[data-share-request]')",15000);
 await openOwn();
 await B.js("document.querySelector('.notebook-editor [data-action=close]').click()");await B.wait("!document.querySelector('.notebook-editor')");
 await B.js("document.querySelector('#notebookCards [data-open-shared]').click()");
 await B.wait("document.querySelector('#notebookDocument')?.contentEditable==='true'&&document.querySelector('.notebook-shared-badge').textContent.includes('You can edit')");
 await type(B,'<p>SYN, SYN-ACK, ACK. Then data flows. Casey: FIN closes it.</p>');
 await B.wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 await A.wait("document.querySelector('#notebookDocument').textContent.includes('Casey: FIN closes it.')",15000);
 assert.match(await A.js("fetch('/api/portal').then(r=>r.json()).then(d=>d.notes.find(n=>n.id==='n-share').content)"),/Casey: FIN closes it\./);

 // A stops sharing: B's open note closes and the card says so.
 await more(A,'Share with friends');await A.wait("!!document.querySelector('.share-dialog [data-share-revoke]')");
 await A.js("window.confirm=()=>true;document.querySelector('.share-dialog [data-share-revoke]').click()");
 await B.wait("[...document.querySelectorAll('#notebookDialog h3')].some(h=>h.textContent.includes('no longer available'))",15000);
 await B.js("[...document.querySelectorAll('#notebookDialog button')].find(b=>b.textContent==='Close').click()");
 await B.wait(card+".textContent.includes('no longer shared')");
 assert.equal(await B.js("fetch('/api/note-shares').then(r=>r.json()).then(d=>d.received.length)"),0);
 for(const [name,page] of [['admin',A],['friend',B]])assert.deepEqual(page.errors,[],name+' page had script errors');
 console.log('Screenshots: '+shots);console.log('PASS note sharing: share from the ••• menu, card in Messages, save into own subject, view-only live viewer, owner edits appear live, ask to edit, allow from the card, friend edits reach the owner live, stop sharing closes the friend\'s copy.');
 for(const c of [A,B,browser])c.ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
