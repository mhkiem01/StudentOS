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
 await wait("!!document.querySelector('#calendarNew')");
 await js("showView('timetable');document.querySelector('#calendarNew').click()");
 assert.equal(await js("document.querySelectorAll('[data-event-colour]').length"),9);
 assert.equal(await js("document.querySelector('.calendar-custom-colour').open"),false);
 assert.equal(await js("document.querySelector('.calendar-form').elements.color.offsetParent===null"),true);
 assert.equal(await js("document.querySelector('[data-event-colour][aria-pressed=true]').getAttribute('aria-label')"),'Purple');
 await js("document.querySelector('[data-event-colour][aria-label=Blue]').click()");
 assert.equal(await js("document.querySelector('.calendar-form').elements.color.value"),'#3b82f6');
 assert.equal(await js("document.querySelectorAll('[data-event-colour][aria-pressed=true]').length"),1);
 await js("var f=document.querySelector('.calendar-form');f.elements.subject_id.value='computing';f.elements.subject_id.dispatchEvent(new Event('change'))");
 assert.equal(await js("document.querySelector('.calendar-form').elements.color.value"),'#3b82f6');
 await js("var f=document.querySelector('.calendar-form');f.elements.title.value='Colour test';f.requestSubmit()");
 await wait("!document.querySelector('.calendar-form')");
 let data=await fetch(base+'/api/portal').then(r=>r.json());const event=data.timetable_events.find(e=>e.title==='Colour test');assert.equal(event.color,'#3b82f6');
 await js("document.querySelector('[data-calendar-event="+JSON.stringify(event.id)+"]').click()");
 await wait("!!document.querySelector('.calendar-form')");
 assert.equal(await js("document.querySelector('[data-event-colour][aria-pressed=true]').getAttribute('aria-label')"),'Blue');
 await js("document.querySelector('.calendar-custom-colour summary').click();var f=document.querySelector('.calendar-form');f.elements.color.value='#1a2b3c';f.elements.color.dispatchEvent(new Event('input'))");
 assert.equal(await js("document.querySelectorAll('[data-event-colour][aria-pressed=true]').length"),0);
 assert.equal(await js("document.querySelector('[data-colour-label]').textContent"),'Custom colour selected');
 await js("document.querySelector('.calendar-form').requestSubmit()");await wait("!document.querySelector('.calendar-form')");
 data=await fetch(base+'/api/portal').then(r=>r.json());assert.equal(data.timetable_events.find(e=>e.id===event.id).color,'#1a2b3c');
 await js("document.querySelector('[data-calendar-event="+JSON.stringify(event.id)+"]').click()");
 assert.equal(await js("document.querySelector('.calendar-form').elements.color.value"),'#1a2b3c');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const dark of [false,true]){
  await js("document.body.classList.toggle('dark',"+dark+")");
  assert(await js("[...document.querySelectorAll('[data-event-colour]')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.left>=0&&r.right<=innerWidth})"));
 }
 await js("document.querySelector('[data-event-colour][aria-label=Green]').click()");
 assert.equal(await js("document.querySelector('.calendar-form').elements.color.value"),'#22c55e');
 console.log('PASS calendar colours: presets, selected indicator, optional custom picker, subject override, save/edit persistence, mobile light/dark.');
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});

