const assert=require('node:assert/strict'),fetch=require('../support/authenticated_fetch.js');
(async()=>{
 const base='http://127.0.0.1:'+process.argv[2],debug='http://127.0.0.1:'+process.argv[3];
 const pages=await global.fetch(debug+'/json/list').then(r=>r.json()),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const wait=async q=>{for(let i=0;i<100;i++){if(await js(q))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timeout: '+q+'; '+await js("document.querySelector('.qr-dialog [data-qr-error]')?.textContent"))};
 await fetch.browser(base,call);await call('Page.enable');await call('Page.navigate',{url:base});

 await wait("!!document.querySelector('#tutorComposer')&&!!document.querySelector('#portalDashboard .week-hour')");
 for(const module of ['finance','gym'])await fetch(base+'/api/'+module,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'profile',data:{enabled:true}})});
 await js("showView('tutor')");
 await js("document.querySelector('#tutorInput').value='Test app actions: I earned $500, paid $200 rent, spent $35.50 on groceries, and ate breakfast with 600 calories, 60g protein, 50g carbs and 18g fat.';document.querySelector('#tutorComposer').requestSubmit()");
 await wait("document.querySelectorAll('.assistant-app-proposal').length===4");
 const finance=()=>fetch(base+'/api/finance').then(r=>r.json()),gym=()=>fetch(base+'/api/gym').then(r=>r.json());
 assert.equal((await finance()).transactions.length,0);assert.equal((await gym()).food_logs.length,0);
 await js("document.querySelector('.assistant-app-proposal [data-review]').click()");
 await wait("!!document.querySelector('.assistant-review [data-field=amount]')");
 await js("document.querySelector('.assistant-review [data-close]').click()");
 assert.equal((await finance()).transactions.length,0);
 for(let i=0;i<4;i++){
  await js("document.querySelectorAll('.assistant-app-proposal')["+i+"].querySelector('[data-review]').click()");
  await wait("!!document.querySelector('.assistant-review')");
  if(i===2)await js("var a=document.querySelector('.assistant-review [data-field=amount]');a.value='40.25';a.dispatchEvent(new Event('input'))");
  await js("document.querySelector('.assistant-review').requestSubmit()");
  await wait("!document.querySelector('.assistant-review')");
  await wait("document.querySelectorAll('.assistant-app-proposal')["+i+"].classList.contains('saved')");
  await new Promise(r=>setTimeout(r,300));
 }
 const f=await finance();assert.equal(f.transactions.length,3);assert(f.transactions.some(t=>t.amount===4025&&t.category==='Groceries'));assert.equal((await gym()).food_logs[0].data.protein,60);
 // Reuse the exact applied receipt after a lost response: no duplicate ledger entry.
 const replay=await js("fetch('/api/assistant/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:'browser_replay_123456',proposal:{operation:'finance.transactions',data:{kind:'income',amount:'10',date:new Date().toLocaleDateString('en-CA'),description:'Replay test'}}})}).then(r=>r.json())");assert(replay.ok);
 for(let n=0;n<2;n++)assert((await js("fetch('/api/assistant/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:'browser_replay_123456',confirmed:true})}).then(r=>r.json())")).ok);
 assert.equal((await finance()).transactions.length,4);
 await js("document.querySelector('#tutorCapabilities').click()");await wait("!!document.querySelector('#assistantCapabilitySearch')");
 await js("var s=document.querySelector('#assistantCapabilitySearch');s.value='social';s.dispatchEvent(new Event('input'))");
 assert(await js("[...document.querySelectorAll('[data-capability]')].filter(a=>!a.hidden).length>5"));await js("document.querySelector('.assistant-review [data-close]').click()");
 for(const width of [390,320]){await call('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:true});assert(await js("document.documentElement.scrollWidth<=innerWidth"),'No mobile overflow');}
 // Saved content is visible through its real page after refresh.
 await js("showView('finance-overview')");await wait("document.querySelector('.finance-view.active')?.textContent.includes('Recorded balance')");
 assert(await js("document.querySelector('.finance-view.active').textContent.includes('Finance')"));
 await js("showView('tutor');document.querySelector('#tutorNew').click();document.querySelector('#tutorInput').value='Test study action: create a note, a question and a flashcard in Networks';document.querySelector('#tutorComposer').requestSubmit()");
 await wait("document.querySelectorAll('.assistant-app-proposal').length===3");
 for(let i=0;i<3;i++){await js("document.querySelectorAll('.assistant-app-proposal')["+i+"].querySelector('[data-review]').click()");await wait("!!document.querySelector('.assistant-review')");await js("document.querySelector('.assistant-review').requestSubmit()");await wait("!document.querySelector('.assistant-review')");await new Promise(r=>setTimeout(r,300));}
 assert.equal(await js("state.flashcards.Networks[0].back"),'TCP');assert.equal(await js("state.topics.Networks[0].answer"),'A');
 const portal=await fetch(base+'/api/portal').then(r=>r.json());assert(portal.notes.some(n=>n.title==='Assistant revision'));
 await fetch(base+'/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'profile',data:{enabled:true}})});
 await js("document.querySelector('#tutorNew').click();document.querySelector('#tutorInput').value='Test shared action: post a study update to my friends';document.querySelector('#tutorComposer').requestSubmit()");await wait("document.querySelectorAll('.assistant-app-proposal').length===1");
 await js("document.querySelector('.assistant-app-proposal [data-review]').click()");await wait("!!document.querySelector('#assistantAcknowledge')");
 assert.equal(await js("document.querySelector('.assistant-review').checkValidity()"),false);
 const shot=await call('Page.captureScreenshot',{format:'png'});require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(),'assistant-shared-review-mobile.png'),Buffer.from(shot.data,'base64'));
 await js("document.querySelector('#assistantAcknowledge').checked=true;document.querySelector('.assistant-review').requestSubmit()");await wait("!document.querySelector('.assistant-review')");
 const social=await fetch(base+'/api/social').then(r=>r.json());assert.equal(social.posts.length,1);assert.equal(social.posts[0].audience,'friends');
 console.log('PASS assistant browser: mixed finance/meal actions, study content, shared review acknowledgement, cancel, edits, persistence, replay safety, capabilities and mobile');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
