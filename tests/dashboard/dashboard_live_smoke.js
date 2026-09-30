// Read-only smoke check of the running app. No form submissions or data writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const pages=await fetch('http://127.0.0.1:9333/json/list').then(r=>r.json()),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const js=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true})).result.value;
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 for(const port of [8765,8766]){
  const portal=await fetch(`http://127.0.0.1:${port}/api/portal`).then(r=>r.json());
  for(const asset of ['dashboard/dashboard.js','dashboard/dashboard.css','planner/reminders.js'])assert((await fetch(`http://127.0.0.1:${port}/frontend/${asset}`)).ok);
  await call('Page.navigate',{url:`http://127.0.0.1:${port}`});await new Promise(r=>setTimeout(r,1200));
  assert.equal(await js("document.querySelectorAll('.week-hour').length"),24);
  assert.equal(await js("document.querySelectorAll('.dash-reminder').length"),portal.reminders.length);
  assert.equal(await js("document.querySelector('[data-display-name]').textContent"),portal.settings.display_name||'Student');
  assert(await js("document.querySelector('.week-scroll').scrollLeft>400"));
  if(port===8765){const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(os.tmpdir(),'student-dashboard-live.png'),Buffer.from(shot.data,'base64'))}
  console.log(`PASS live port ${port}: new dashboard assets, 24-hour grid, saved display name and ${portal.reminders.length} real reminders`);
 }
 assert.deepEqual(errors,[]);ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
