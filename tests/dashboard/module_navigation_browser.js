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

 await wait("!!document.querySelector('#gymEnabled')&&!document.querySelector('#gymEnabled').disabled&&!!document.querySelector('#tutorComposer')");
 for(const module of ['gym','finance']){
  const response=await fetch(base+'/api/'+module,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'profile',data:{enabled:true}})});
  assert(response.ok);
  await js("window.showView('"+module+"-overview')");
  await wait("!!document.querySelector('#"+module+"Nav:not([hidden]) [data-view="+module+"-overview]')");
 }
 for(const width of [1440,390,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<760});
  for(const module of ['gym','finance']){
   const nav='#'+module+'Nav',toggle='#'+module+'Toggle',sub='#'+module+'Subnav';
   if(width<760)await js("if(!document.body.classList.contains('nav-open'))document.querySelector('#menuToggle').click()");
   assert.equal(await js("document.querySelectorAll('"+sub+" [data-view="+module+"-overview]').length"),0);
   const previous=await js("document.querySelector('.view.active').id");
   await js("if(document.querySelector('"+toggle+"').getAttribute('aria-expanded')==='true')document.querySelector('"+toggle+"').click()");
   assert.equal(await js("document.querySelector('.view.active').id"),previous);
   assert(await js("document.querySelector('"+sub+"').hidden"));
   assert(await js("(()=>{const a=document.querySelector('"+nav+" .module-nav-head>button:first-child').getBoundingClientRect(),b=document.querySelector('"+toggle+"').getBoundingClientRect();return a.right<=b.left+1&&b.width>=44})()"));
   await js("document.querySelector('"+nav+" [data-view="+module+"-overview]').click()");
   await wait("document.querySelector('#view-"+module+"-overview').classList.contains('active')");
   assert.equal(await js("document.body.classList.contains('nav-open')"),false);
   assert.equal(await js("document.querySelector('"+toggle+"').getAttribute('aria-expanded')"),'false');
   if(width<760)await js("document.querySelector('#menuToggle').click()");
   await js("document.querySelector('"+toggle+"').click()");
   assert.equal(await js("document.querySelector('"+toggle+"').getAttribute('aria-expanded')"),'true');
   assert.equal(await js("document.activeElement.id"),module+'Toggle');
   const child=module==='gym'?'workouts':'goals';
   await js("document.querySelector('"+sub+" [data-view="+module+"-"+child+"]').click()");
   await wait("document.querySelector('#view-"+module+"-"+child+"').classList.contains('active')");
   assert.equal(await js("document.body.classList.contains('nav-open')"),false);
  }
 }
 console.log('PASS module navigation: direct overview, independent dropdowns, no duplicate Overview, keyboard focus and desktop/mobile layout');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
