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

 await wait("!!document.querySelector('#tutorComposer')");
 await require('./finance_browser.js')(js,call);
 await wait("!!document.querySelector('#portalDashboard .week-hour') && !!document.querySelector('#tutorComposer')");
 const route=async name=>{await js("showView('finance-"+name+"')");await wait("!!document.querySelector('#view-finance-"+name+" .fin-hero')")};
 const click=async action=>js("document.querySelector('.finance-view.active [data-fin="+JSON.stringify(action)+"]').click()");
 const submit=async values=>{await js("(()=>{const f=document.querySelector('.fin-dialog form');for(const [k,v] of Object.entries("+JSON.stringify(values)+")){f.elements[k].value=v;f.elements[k].dispatchEvent(new Event('change'))}f.requestSubmit()})()");for(let i=0;i<100;i++){if(await js("!document.querySelector('.fin-dialog').open"))return;await new Promise(r=>setTimeout(r,100))}throw Error(await js("document.querySelector('.fin-error').textContent"))};
 const current=()=>fetch(base+'/api/finance').then(r=>r.json());
 const today=await js("(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()");
 await route('overview');await click('account');await submit({opening_amount:'500',opening_date:'2026-09-01'});
 assert.equal((await current()).balance.recorded,239500,JSON.stringify((await current()).account));
 await click('income');assert.deepEqual(await js("[...document.querySelector('.fin-dialog [name=frequency]').options].map(o=>o.value)"),['none','weekly','monthly']);
 await submit({amount:'250',description:'Weekly job',date:today,frequency:'weekly',record_first:'false'});
 let data=await current();assert.equal(data.balance.recorded,239500);assert.equal(data.income_schedules.length,1);
 await click('receive-income');await submit({amount:'240',paid_date:today});
 data=await current();assert.equal(data.balance.recorded,263500);assert.equal(data.income_receipts.length,1);
 await click('income');await submit({amount:'100',description:'Monthly support',date:today,frequency:'monthly',record_first:'true'});
 data=await current();assert.equal(data.balance.recorded,273500);assert.equal(data.income_schedules.length,2);
 await click('go-goals');await wait("!!document.querySelector('#view-finance-goals [data-goal-totals]')");
 await click('goal');await submit({name:'Active laptop',target:'1200',starting:'0',monthly:'100',target_date:'2027-12-01'});
 data=await current();assert.equal(data.goal_totals.active,1);assert(data.goal_totals.weekly>0);
 assert(await js("document.querySelector('.finance-view.active [data-goal-totals]').textContent.includes('Total to save / week')"));
 await route('transactions');assert(await js("document.querySelector('[data-fin-history]').textContent.includes('Balance after entry')"));
 for(const width of [320,390,744]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  for(const dark of [false,true]){await js("document.body.classList.toggle('dark',"+dark+")");await route('overview');assert(await js("document.documentElement.scrollWidth<=innerWidth"),'Planner mobile overflow '+width)}
 }
 await js("window.beforeFinanceReload=true");await call('Page.reload');await wait("!window.beforeFinanceReload && !!document.querySelector('#financeNav')&&!document.querySelector('#financeNav').hidden");
 data=await current();assert.equal(data.balance.recorded,273500);assert.equal(data.income_schedules.length,2);
 console.log('PASS Finance planner: opening balance, weekly/monthly pay, confirmed receipt, active savings totals, account statement, mobile themes and reload persistence.');
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
