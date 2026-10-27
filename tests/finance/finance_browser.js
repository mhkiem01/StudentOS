const assert=require('node:assert/strict');
module.exports=async function(js,call){
 const wait=async exp=>{for(let i=0;i<100;i++){if(await js(exp))return;await new Promise(r=>setTimeout(r,100))}throw Error('Finance timed out: '+exp)};
 const click=async a=>js(`document.querySelector('.finance-view.active [data-fin="${a}"]').click()`);
 const state=()=>js("fetch('/api/finance?date=2026-09-21').then(r=>r.json())");
 const submit=async values=>{await js(`(()=>{const f=document.querySelector('.fin-dialog form');for(const [k,v] of Object.entries(${JSON.stringify(values)})){f.elements[k].value=v;f.elements[k].dispatchEvent(new Event('change'))}f.requestSubmit()})()`);try{await wait("!document.querySelector('.fin-dialog').open")}catch(e){throw Error(e.message+' '+await js("document.querySelector('.fin-error').textContent+' Invalid fields: '+[...document.querySelectorAll('.fin-dialog :invalid')].map(x=>x.name).join(',')"))}};
 const route=async p=>{await js(`showView('finance-${p}')`);await wait(`!!document.querySelector('#view-finance-${p} .fin-hero')`)};
 await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1050,deviceScaleFactor:1,mobile:false});
 await js("showView('settings')");await wait("!!document.querySelector('#financeEnabled')&&!document.querySelector('#financeEnabled').disabled");
 assert(await js("document.querySelector('#financeNav').hidden"));
 const academicBefore=await js("fetch('/api/portal').then(r=>r.json()).then(p=>JSON.stringify([p.reminders,p.timetable_events,p.notes]))");
 await js("document.querySelector('#financeEnabled').click()");await wait("!document.querySelector('#financeNav').hidden");
 await route('overview');
 await js("(()=>{const e=document.querySelector('.finance-view.active [name=anchor]');e.value='2026-09-21';e.dispatchEvent(new Event('change'))})()");await wait("document.querySelector('.finance-view.active [name=anchor]').value==='2026-09-21'");
 await click('income');await submit({amount:'2000',date:'2026-09-21',description:'Fixture work'});
 await click('expense');await submit({amount:'31.50',date:'2026-09-21',description:'Fixture groceries',category:'Groceries'});
 let data=await state();assert.equal(data.summary.income,200000);assert.equal(data.summary.spending,3150);
 await click('goal');await submit({name:'Fixture trip',type:'travel',target:'5000',starting:'1000',monthly:'200',target_date:'2027-04-01',destination:'Japan',flights:'700'});
 await click('contribute');await submit({amount:'100',date:'2026-09-21'});data=await state();assert.equal(data.goals[0].saved,110000);assert.equal(data.goals[0].data.travel.flights,70000);
 await route('budget');await click('budget');await submit({category:'Groceries',weekly:'50',monthly:'200'});
 data=await state();assert.equal(data.budgets[0].weekly_remaining,1850);
 await click('bill');await submit({name:'Fixture phone',amount:'45',category:'Bills',start_date:'2026-09-21',frequency:'monthly'});
 await click('pay');await submit({paid_date:'2026-09-21',record_expense:'true'});data=await state();assert.equal(data.payments.length,1);assert.equal(data.transactions.length,3);
 await route('currency');await click('rates');await wait("document.querySelector('.finance-view.active [data-conversion]').textContent.includes('Test fixture')");
 await js("(()=>{const s=document.querySelector('.finance-view.active [name=fx_to]');s.value='JPY';s.dispatchEvent(new Event('input'))})()");assert(await js("document.querySelector('.finance-view.active [data-conversion]').textContent.includes('JPY')"));
 await click('reverse');assert.equal(await js("document.querySelector('.finance-view.active [name=fx_from]').value"),'JPY');
 await js("window.finTestFetch=window.fetch;window.fetch=(url,...args)=>url==='/api/finance/rates'?Promise.reject(Error('Test offline')):window.finTestFetch(url,...args)");await click('rates');await wait("document.querySelector('.finance-view.active [data-fin-status]').textContent.includes('Test offline')");assert(await js("document.querySelector('.finance-view.active [data-conversion]').textContent.includes('Test fixture')"));await js("window.fetch=window.finTestFetch;delete window.finTestFetch");
 await route('transactions');await js("(()=>{const s=document.querySelector('.fin-filters [name=search]');s.value='Fixture groceries';s.dispatchEvent(new Event('input'))})()");assert.equal(await js("document.querySelectorAll('[data-fin-history] .fin-transaction').length"),1);
 await click('transaction');await submit({amount:'60'});data=await state();assert.equal(data.budgets[0].weekly_remaining,-1000);
 await route('goals');await js("document.querySelector('.fin-goal [data-fin=goal]').click()");await submit({paused:'1'});assert.equal((await state()).goals[0].paused,1);
 await route('insights');assert(await js("document.querySelector('.finance-view.active .fin-tips').textContent.includes('more than your weekly limit')"));
 // Upcoming expenses: its own page and an Overview section, a this week / this month / next month picker,
 // red negative amounts, and a total matching the payments the server lists for that period (counted from today).
 await route('expenses');assert(await js("!!document.querySelector('#financeNav [data-view=finance-expenses]')"));
 const expected=await js("fetch('/api/finance').then(r=>r.json()).then(d=>{const x=d.expenses,out={};for(const p of ['week','month','next_month']){const r=x.periods[p],items=x.items.filter(i=>i.overdue&&p!=='next_month'||i.date>=r.start&&i.date<=r.end),t=items.reduce((n,i)=>n+i.amount,0);out[p]={names:items.map(i=>i.name),total:(t?'−':'')+new Intl.NumberFormat(undefined,{style:'currency',currency:'AUD'}).format(t/100),overdue:items.some(i=>i.overdue)}}return out})");
 assert(expected.next_month.names.includes('Fixture phone'),'A monthly bill is due next month');assert(!expected.next_month.overdue,'Overdue bills are not shown under next month');
 for(const period of ['week','month','next_month']){
  await js(`document.querySelector('.finance-view.active [data-fin=expense-period][data-id=${period}]').click()`);
  const shown=await js("(()=>{const v=document.querySelector('.finance-view.active'),rows=[...v.querySelectorAll('.fin-expense')];return {pressed:v.querySelector('[data-fin=expense-period][aria-pressed=true]').dataset.id,focused:document.activeElement.dataset.id,names:rows.map(a=>a.querySelector('.fin-expense-what b').textContent),red:rows.every(a=>{const s=a.querySelector('strong');return s.classList.contains('fin-negative')&&s.textContent.startsWith('−')}),total:v.querySelector('[data-expense-total] strong').textContent,overdueLabel:rows.filter(a=>a.classList.contains('overdue')).every(a=>a.querySelector('.fin-expense-when b').textContent==='Overdue')}})()");
  assert.equal(shown.pressed,period);assert.equal(shown.focused,period);assert.deepEqual(shown.names,expected[period].names,period);assert(shown.red,'Amounts are negative and red: '+period);assert.equal(shown.total,expected[period].total);assert(shown.overdueLabel,'Overdue rows say so in text');
 }
 await route('overview');assert.equal(await js("document.querySelector('.finance-view.active .fin-expenses-card [aria-pressed=true]').dataset.id"),'next_month','The chosen period is shared and remembered');
 await js("document.querySelector('.finance-view.active [data-fin=expense-period][data-id=week]').click()");
 await js("showView('settings');document.querySelector('#financeEnabled').click()");await wait("document.querySelector('#financeNav').hidden");assert.equal((await state()).transactions.length,3);
 await js("document.querySelector('#financeEnabled').click()");await wait("!document.querySelector('#financeNav').hidden");
 await route('overview');await js("document.body.classList.add('dark')");
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
 const screenshot=async name=>{const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(os.tmpdir(),name),Buffer.from(shot.data,'base64'))};await screenshot('finance-desktop-dark.png');
 for(const width of [320,390,744]){await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});for(const p of ['overview','expenses','goals','budget','currency','insights','transactions']){await route(p);assert(await js("document.documentElement.scrollWidth<=innerWidth"),'No Finance overflow: '+width+' '+p)}await js("document.querySelector('#menuToggle').click()");assert(await js("!document.querySelector('#financeNav').hidden"));await js("if(document.querySelector('#financeSubnav').hidden)document.querySelector('#financeToggle').click();document.querySelector('#financeToggle').click()");assert(await js("document.querySelector('#financeSubnav').hidden"));await js("document.querySelector('#financeToggle').click();document.querySelector('.mobile-nav-close').click()")}
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await route('overview');await js("document.body.classList.remove('dark')");await screenshot('finance-mobile-light.png');
 await call('Page.reload');await wait("!!document.querySelector('#financeNav')&&!document.querySelector('#financeNav').hidden");assert.equal((await state()).transactions.length,3);
 assert.equal(await js("fetch('/api/portal').then(r=>r.json()).then(p=>JSON.stringify([p.reminders,p.timetable_events,p.notes]))"),academicBefore);
 console.log('PASS Finance: optional toggle, real summaries, income/expense, travel goal/contribution, budgets, bill payment, cached conversion, offline preservation, editing, insights, persistence and 320/390/744px layouts.');
};
