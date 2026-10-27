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
 // Plan ahead / week by week / recent activity / money flow on the Overview.
 const post=body=>fetch(base+'/api/finance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
 const inDays=n=>js(`(()=>{const d=new Date();d.setDate(d.getDate()+${n});return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()`);
 const rentDay=await inDays(3);
 assert.equal((await post({action:'bills',data:{name:'Big rent',amount:'5000',category:'Rent',start_date:rentDay,frequency:'none'}})).ok,true);
 const shown=sel=>js(`document.querySelector('.finance-view.active ${sel}')?.textContent.trim()`);
 const fmt=minor=>js(`new Intl.NumberFormat(undefined,{style:'currency',currency:'AUD'}).format(${minor}/100)`);
 await route('overview');await wait("!!document.querySelector('.finance-view.active .fin-plan')");
 assert.equal(await js("document.querySelectorAll('.finance-view.active [data-plan-horizon]').length"),5);
 await js("document.querySelector('.finance-view.active [data-plan-horizon=custom]').click()");
 await wait("!!document.querySelector('.finance-view.active [data-plan-date]')");
 const target=await inDays(10);
 await js(`(()=>{const i=document.querySelector('.finance-view.active [data-plan-date]');i.value='${target}';i.dispatchEvent(new Event('change'))})()`);
 await wait(`document.querySelector('.finance-view.active [data-plan-date]')?.value==='${target}'`);
 data=await current();
 const expected=data.forecast.start_balance+data.forecast.events.filter(e=>e.date<=target).reduce((n,e)=>n+e.delta,0);
 assert.equal(await shown('[data-plan-balance]'),await fmt(expected),'plan-ahead balance matches the server forecast');
 assert(data.forecast.events.some(e=>e.kind==='bill'&&e.label==='Big rent'&&e.date===rentDay));
 assert(/Not enough to pay everything[\s\S]*Earn/.test(await shown('.fin-plan-status')),'a bill larger than the balance is flagged with how much to earn');
 assert.equal(await js("document.querySelectorAll('.finance-view.active .fin-week-row:not(.head)').length"),8);
 await js("document.querySelector('.finance-view.active [data-plan-weeks]').click()");
 await wait("document.querySelectorAll('.finance-view.active .fin-week-row:not(.head)').length===26");
 assert((await shown('.fin-activity')).includes('Weekly job'),'recent activity lists received pay');
 assert((await shown('.fin-activity')).includes('Balance'),'recent activity shows the balance after each entry');
 assert((await shown('.fin-flow')).includes('Weekly job'),'money flow shows where income came from');
 await js("(()=>{const f=document.querySelector('.finance-view.active [data-plan-settings]');f.elements.buffer.value='100';f.elements.everyday.checked=false;f.requestSubmit()})()");
 for(let i=0;i<50&&(await current()).forecast.buffer!==10000;i++)await new Promise(r=>setTimeout(r,100));
 data=await current();assert.deepEqual([data.forecast.buffer,data.forecast.include_everyday],[10000,false]);
 await wait("document.querySelector('.finance-view.active [data-plan-settings] [name=everyday]')?.checked===false");
 await route('transactions');assert(await js("document.querySelector('[data-fin-history]').textContent.includes('Balance after entry')"));
 for(const width of [320,390,744]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  for(const dark of [false,true]){await js("document.body.classList.toggle('dark',"+dark+")");await route('overview');assert(await js("document.documentElement.scrollWidth<=innerWidth"),'Planner mobile overflow '+width)}
 }
 await js("window.beforeFinanceReload=true");await call('Page.reload');await wait("!window.beforeFinanceReload && !!document.querySelector('#financeNav')&&!document.querySelector('#financeNav').hidden");
 data=await current();assert.equal(data.balance.recorded,273500);assert.equal(data.income_schedules.length,2);
 // Reset lists what will be deleted, needs RESET typed, then deletes every record while Finance stays on.
 await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1050,deviceScaleFactor:1,mobile:false});await js("document.body.classList.remove('dark')");
 for(const name of ['overview','goals','budget','currency','insights','transactions']){await route(name);assert(await js("!!document.querySelector('.finance-view.active .fin-reset-row [data-fin=reset]')"),'Reset button on '+name)}
 await route('overview');await click('reset');await wait("document.querySelector('.fin-dialog').open");
 const list=await js("document.querySelector('.fin-dialog .fin-reset-list').textContent");
 for(const item of ['transactions','savings goal','budget','bill','pay schedules','your opening balance'])assert(list.includes(item),'Reset lists '+item+': '+list);
 const typeConfirm=value=>js(`(()=>{const i=document.querySelector('.fin-dialog [name=confirm]');i.value=${JSON.stringify(value)};i.dispatchEvent(new Event('input',{bubbles:true}));return document.querySelector('.fin-dialog [type=submit]').disabled})()`);
 assert.equal(await js("document.querySelector('.fin-dialog [type=submit]').disabled"),true);assert.equal(await typeConfirm('reset'),true);assert.equal(await typeConfirm('RESET'),false);
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os');const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(os.tmpdir(),'finance-reset-dialog.png'),Buffer.from(shot.data,'base64'));
 await js("document.querySelector('.fin-dialog form').requestSubmit()");await wait("!document.querySelector('.fin-dialog').open");
 data=await current();
 for(const table of ['transactions','goals','contributions','budgets','bills','payments','income_schedules'])assert.equal(data[table].length,0,table+' after reset');
 assert.equal(data.account.configured,false);assert.equal(data.balance.recorded,0);assert.equal(data.profile.enabled,true);
 assert(await js("document.querySelector('.finance-view.active [data-fin-status]').textContent.startsWith('All Finance records were deleted. Backup saved as before-finance-reset-')"));
 assert(await js("!document.querySelector('#financeNav').hidden"));
 // With nothing left, Reset says so instead of offering to delete.
 await click('reset');await wait("document.querySelector('.fin-dialog').open");assert(await js("document.querySelector('.fin-dialog').textContent.includes('Nothing to reset') && !document.querySelector('.fin-dialog [type=submit]')"));
 await js("document.querySelector('.fin-dialog [data-close]').click()");
 console.log('PASS Finance planner: opening balance, weekly/monthly pay, confirmed receipt, active savings totals, account statement, mobile themes, reload persistence and reset with backup.');
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
