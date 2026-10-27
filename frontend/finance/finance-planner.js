/* Finance planner cards for the Overview: plan ahead to any date, week-by-week
   plan, recent activity and money flow. The forecast itself is calculated on
   the server (finance_forecast.py); these views only filter and add it up. */
(function(global){
 'use strict';
 const KEY='portal.financePlanner';
 let view={horizon:'next',custom:'',flow:'month',weeks:8};
 try{view={...view,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
 const remember=()=>{try{localStorage.setItem(KEY,JSON.stringify(view))}catch{}};
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
 const monthEnd=s=>{const d=new Date(s+'T12:00:00');return iso(new Date(d.getFullYear(),d.getMonth()+1,0,12))};
 // No sign on zero: "$0.00", never "−$0.00".
 const signed=(c,n,sign)=>n?sign+c.money(n):c.money(0);
 const KIND={income:'Pay',bill:'Bill',planned:'Planned',everyday:'Everyday',goal:'Goal saving'};

 function horizons(fc){
   return [['week','End of this week',fc.weeks[0].end],['next','End of next week',fc.weeks[1].end],['month','End of this month',monthEnd(fc.as_of)],['4w','In 4 weeks',addDays(fc.as_of,28)],['custom','Pick a date',view.custom&&view.custom>=fc.as_of&&view.custom<=fc.horizon?view.custom:fc.weeks[1].end]];
 }
 // Where the balance stands on `target`, from the server's dated forecast items.
 function project(fc,target){
   const items=fc.events.filter(e=>e.date<=target);
   const total=k=>items.filter(k).reduce((n,e)=>n+e.delta,0);
   let lowest=fc.start_balance,lowestDate=fc.as_of,lowestFree=fc.start_balance-fc.start_set_aside;
   for(const e of items){if(e.balance<lowest){lowest=e.balance;lowestDate=e.date}lowestFree=Math.min(lowestFree,e.free)}
   const last=items[items.length-1];
   return {items,balance:last?last.balance:fc.start_balance,free:last?last.free:fc.start_balance-fc.start_set_aside,lowest,lowestDate,lowestFree,
     income:total(e=>e.delta>0),bills:-total(e=>e.kind==='bill'),planned:-total(e=>e.kind==='planned'&&e.delta<0),everyday:-total(e=>e.kind==='everyday'),
     aside:fc.start_set_aside+items.reduce((n,e)=>n+e.set_aside,0),
     shortBills:Math.max(0,fc.buffer-lowest),short:Math.max(0,fc.buffer-lowestFree)};
 }

 function planAhead(c){
   const fc=c.data.forecast,options=horizons(fc),chosen=options.find(o=>o[0]===view.horizon)||options[1],target=chosen[2],r=project(fc,target);
   const keep=fc.buffer?` and keep ${c.money(fc.buffer)}`:'';
   const status=r.shortBills?`<p class="fin-plan-status bad" role="status">⚠ Not enough to pay everything. You'd drop to ${c.money(r.lowest)} on ${c.dateText(r.lowestDate)}. <b>Earn ${c.money(r.shortBills)} more by ${c.dateText(r.lowestDate)}</b> to cover it${keep}.</p>`
     :r.short?`<p class="fin-plan-status warn" role="status">Bills are covered, but staying on track for your goals${keep} needs <b>${c.money(r.short)} more</b> by ${c.dateText(target)}.</p>`
     :`<p class="fin-plan-status ok" role="status">✓ Covered. Everything is paid, goal savings are on track, and your lowest point is ${c.money(r.lowest)} on ${c.dateText(r.lowestDate)}.</p>`;
   const line=(label,value,sign='',cls='')=>`<span class="${cls}">${label}<b>${sign}${c.money(value)}</b></span>`;
   const rows=r.items.filter(e=>e.kind!=='goal'||e.set_aside).map(e=>`<li><span class="fin-plan-kind ${e.kind}">${KIND[e.kind]}</span><div><b>${c.E(e.label)}</b><small>${c.dateText(e.date)}${e.category&&e.category!=='Income'&&e.category!=='Goal'?' · '+c.E(e.category):''} · ${c.E(e.note)}</small></div><strong class="${e.delta>0?'fin-income':''}">${e.kind==='goal'?'set aside '+c.money(e.set_aside):(e.delta>0?'+':'−')+c.money(Math.abs(e.delta))}</strong><small class="fin-plan-after">${c.money(e.balance)}</small></li>`).join('');
   return c.card('🔮 Plan ahead',`
     <div class="fin-chips" role="group" aria-label="Plan up to">${options.map(([k,label])=>`<button type="button" class="fin-chip${k===chosen[0]?' active':''}" aria-pressed="${k===chosen[0]}" data-plan-horizon="${k}">${label}</button>`).join('')}${chosen[0]==='custom'?`<input type="date" class="fin-chip-date" data-plan-date value="${target}" min="${fc.as_of}" max="${fc.horizon}" aria-label="Plan up to date">`:''}</div>
     <div class="fin-plan-answer"><div><small>By ${c.dateText(target)} you'll have</small><strong data-plan-balance class="${r.balance<0?'fin-negative':''}">${c.money(r.balance)}</strong></div><div><small>Free after goal savings</small><strong data-plan-free class="${r.free<0?'fin-negative':''}">${c.money(r.free)}</strong></div><div><small>Lowest point</small><strong class="${r.lowest<fc.buffer?'fin-negative':''}">${c.money(r.lowest)}</strong><small>${c.dateText(r.lowestDate)}</small></div></div>
     ${status}
     <div class="fin-plan-lines">${line('Now',fc.start_balance)}${line('Expected pay',r.income,'+ ')}${line('Bills',r.bills,'− ')}${r.planned?line('Planned expenses',r.planned,'− '):''}${fc.include_everyday?line('Everyday spending (from budgets)',r.everyday,'− '):''}${line('Balance on '+c.dateText(target),r.balance,'','fin-plan-total')}${line('Set aside for goals',r.aside,'− ')}${line('Free to spend',r.free,'','fin-plan-total')}</div>
     <details class="fin-plan-items"><summary>See every item (${r.items.filter(e=>e.kind!=='goal'||e.set_aside).length})</summary>${rows?`<ul>${rows}</ul>`:'<p>Nothing scheduled before then.</p>'}</details>
     <form class="fin-plan-settings" data-plan-settings><label>Warn me below<input name="buffer" type="number" min="0" step="0.01" value="${(fc.buffer/c.factor()).toFixed(c.factor()===1?0:2)}" inputmode="decimal"></label><label class="fin-check"><input type="checkbox" name="everyday" ${fc.include_everyday?'checked':''}> Count everyday spending from my budgets</label><button class="fin-button">Save</button></form>
     <p class="fin-plan-caption">Uses your recorded balance, scheduled pay not yet received, unpaid bills, future-dated entries${fc.include_everyday?' and your budget limits as everyday spending':''}. Goal savings stay in your balance but aren't free to spend.${fc.unconfirmed_income?` ${c.money(fc.unconfirmed_income)} of overdue pay isn't counted until you mark it received.`:''}${c.data.account.configured?'':' Set your opening balance for an accurate starting point.'}</p>`,'','fin-plan');
 }

 function weekPlan(c){
   const fc=c.data.forecast,weeks=fc.weeks.slice(0,view.weeks),first=fc.weeks[0];
   const label=w=>w===first?'This week':w===fc.weeks[1]?'Next week':`${c.dateText(w.start).replace(/ \d{4}$/,'')} – ${c.dateText(w.end).replace(/ \d{4}$/,'')}`;
   const verdict=w=>w.extra_this_week>0?`<span class="fin-week-flag bad">Earn ${c.money(w.extra_this_week)} more</span>`:w.lowest_free<fc.buffer?'<span class="fin-week-flag warn">Needs the extra above</span>':'<span class="fin-week-flag ok">✓ On track</span>';
   const headline=first.extra_this_week>0?`This week you need to earn <b>${c.money(first.extra_this_week)}</b> more than you have planned.`:fc.weeks.slice(0,8).some(w=>w.extra_this_week>0)?(()=>{const w=fc.weeks.slice(0,8).find(x=>x.extra_this_week>0);return `You're fine this week. By ${c.dateText(w.end)} you'll need <b>${c.money(w.needed)}</b> more.`})():'Your planned income covers the next 8 weeks.';
   return c.card('📅 Week by week',`
     <div class="fin-week-head"><p data-week-headline>${headline}</p>${fc.goal_weekly?`<p>To reach every goal on time, save <b>${c.money(fc.goal_weekly)}/week</b> (${c.money(fc.goal_monthly)}/month).</p>`:''}</div>
     <div class="fin-week-table" role="table" aria-label="Week by week plan"><div class="fin-week-row head" role="row"><span role="columnheader">Week</span><span role="columnheader">Money in</span><span role="columnheader">Money out</span><span role="columnheader">Goal savings</span><span role="columnheader">End balance</span><span role="columnheader">Free</span><span role="columnheader">Status</span></div>
     ${weeks.map(w=>`<div class="fin-week-row" role="row"><span role="cell" data-label="Week"><b>${label(w)}</b></span><span role="cell" data-label="Money in" class="fin-income">${signed(c,w.money_in,'+')}</span><span role="cell" data-label="Money out">${signed(c,w.bills+w.planned_out+w.everyday,'−')}</span><span role="cell" data-label="Goal savings">${c.money(w.goals)}</span><span role="cell" data-label="End balance" class="${w.closing<0?'fin-negative':''}">${c.money(w.closing)}</span><span role="cell" data-label="Free" class="${w.closing_free<0?'fin-negative':''}">${c.money(w.closing_free)}</span><span role="cell" data-label="Status">${verdict(w)}</span></div>`).join('')}</div>
     <button type="button" class="fin-button" data-plan-weeks>${view.weeks>8?'Show 8 weeks':'Show 26 weeks'}</button>
     <p class="fin-plan-caption">"Earn more" is extra income needed by the end of that week so you never drop below ${c.money(fc.buffer)} while keeping goal savings on track. It's counted once: "Needs the extra above" means that week is covered if you earn it.</p>`,'','fin-weeks');
 }

 function recentActivity(c){
   const entries=c.data.ledger.filter(t=>t.included).slice(0,10),today=c.data.balance.as_of,yesterday=addDays(today,-1);
   const groups=[];for(const t of entries){const g=groups[groups.length-1];if(g&&g.date===t.date)g.items.push(t);else groups.push({date:t.date,items:[t]})}
   const day=d=>d===today?'Today':d===yesterday?'Yesterday':c.dateText(d);
   const body=groups.map(g=>`<div class="fin-activity-day"><h4>${day(g.date)}<small>${(n=>`${n<0?'−':'+'}${c.money(Math.abs(n))}`)(g.items.reduce((n,t)=>n+t.delta,0))}</small></h4>${g.items.map(t=>`<div class="fin-activity-row"><span class="fin-activity-icon ${t.kind}" aria-hidden="true">${t.kind==='income'?'↓':'↑'}</span><div><b>${c.E(t.description)}</b><small>${c.E(t.kind==='income'?'Income':t.category)}${t.source==='bill'?' · bill payment':''}</small></div><div class="fin-activity-amount"><strong class="${t.kind==='income'?'fin-income':''}">${t.kind==='income'?'+':'−'}${c.money(t.amount)}</strong><small>Balance ${c.money(t.running_balance)}</small></div></div>`).join('')}</div>`).join('');
   return c.card('🧾 Recent activity',body||c.empty('No transactions yet.','Add income or an expense to start your history.'),c.button('View all →','go-transactions'),'fin-activity');
 }

 function moneyFlow(c){
   const asof=c.data.balance.as_of,d=new Date(asof+'T12:00:00'),monday=addDays(asof,-((d.getDay()+6)%7));
   const periods={week:['This week',monday,asof,addDays(monday,-7),addDays(monday,-1)],month:['This month',asof.slice(0,8)+'01',asof],last:['Last month',iso(new Date(d.getFullYear(),d.getMonth()-1,1,12)),iso(new Date(d.getFullYear(),d.getMonth(),0,12))],quarter:['Last 3 months',iso(new Date(d.getFullYear(),d.getMonth()-2,1,12)),asof]};
   const [name,from,to]=periods[view.flow]||periods.month;
   const span=Math.round((new Date(to)-new Date(from))/864e5)+1,prevTo=periods[view.flow]?.[4]||addDays(from,-1),prevFrom=periods[view.flow]?.[3]||addDays(from,-span);
   const pick=(a,b)=>c.data.ledger.filter(t=>t.included&&a<=t.date&&t.date<=b);
   const now=pick(from,to),before=pick(prevFrom,prevTo);
   const sum=(list,kind)=>list.filter(t=>t.kind===kind).reduce((n,t)=>n+t.amount,0);
   const income=sum(now,'income'),spent=sum(now,'expense'),prevSpent=sum(before,'expense');
   const group=(list,key)=>{const m=new Map();for(const t of list){const k=key(t);const g=m.get(k)||{name:k,total:0,items:new Map()};g.total+=t.amount;g.items.set(t.description,(g.items.get(t.description)||0)+t.amount);m.set(k,g)}return [...m.values()].sort((a,b)=>b.total-a.total)};
   const bars=(groups,total,tone)=>groups.length?groups.map(g=>`<div class="fin-flow-row"><div class="fin-flow-label"><b>${c.E(g.name)}</b><span>${c.money(g.total)} · ${Math.round(g.total*100/total)}%</span></div><div class="fin-flow-bar ${tone}"><span style="width:${Math.max(2,g.total*100/total)}%"></span></div>${tone==='out'&&g.items.size>1?`<small>${[...g.items].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>c.E(k)+' '+c.money(v)).join(' · ')}</small>`:''}</div>`).join(''):'<p>Nothing recorded.</p>';
   const change=prevSpent?Math.round((spent-prevSpent)*100/prevSpent):null;
   return c.card('🔀 Money flow',`
     <div class="fin-chips" role="group" aria-label="Money flow period">${Object.entries(periods).map(([k,[label]])=>`<button type="button" class="fin-chip${(periods[view.flow]?view.flow:'month')===k?' active':''}" aria-pressed="${view.flow===k}" data-plan-flow="${k}">${label}</button>`).join('')}</div>
     <div class="fin-flow-totals"><div><small>Came in</small><strong class="fin-income" data-flow-in>${signed(c,income,'+')}</strong></div><div><small>Went out</small><strong data-flow-out>${signed(c,spent,'−')}</strong></div><div><small>Net</small><strong class="${income-spent<0?'fin-negative':'fin-income'}">${c.money(income-spent)}</strong></div></div>
     ${change===null?'':`<p class="fin-plan-caption">Spending is ${change===0?'the same as':Math.abs(change)+'% '+(change>0?'higher':'lower')+' than'} the previous ${span} days (${c.money(prevSpent)}).${income?` You kept ${Math.max(0,Math.round((income-spent)*100/income))}% of what came in.`:''}</p>`}
     <h4>Where it came from</h4>${bars(group(now.filter(t=>t.kind==='income'),t=>t.description),income,'in')}
     <h4>Where it went</h4>${bars(group(now.filter(t=>t.kind==='expense'),t=>t.category),spent,'out')}
     <p class="fin-plan-caption">${c.E(name)}: ${c.dateText(from)} – ${c.dateText(to)}.</p>`,'','fin-flow');
 }

 function bind(host,c){
   host.querySelectorAll('[data-plan-horizon]').forEach(b=>b.onclick=()=>{view.horizon=b.dataset.planHorizon;if(view.horizon==='custom'&&!view.custom)view.custom=c.data.forecast.weeks[1].end;remember();c.rerender()});
   host.querySelector('[data-plan-date]')?.addEventListener('change',ev=>{if(ev.target.value){view.custom=ev.target.value;remember();c.rerender()}});
   host.querySelectorAll('[data-plan-flow]').forEach(b=>b.onclick=()=>{view.flow=b.dataset.planFlow;remember();c.rerender()});
   host.querySelector('[data-plan-weeks]')?.addEventListener('click',()=>{view.weeks=view.weeks>8?8:26;remember();c.rerender()});
   const form=host.querySelector('[data-plan-settings]');
   if(form)form.onsubmit=async ev=>{ev.preventDefault();const data=new FormData(form);try{await c.save('profile',{buffer:data.get('buffer')||'0',forecast_everyday:data.get('everyday')==='on'});c.rerender()}catch(err){c.feedback(err.message)}};
 }

 global.StudentFinancePlanner={planAhead,weekPlan,recentActivity,moneyFlow,bind,project};
})(window);
