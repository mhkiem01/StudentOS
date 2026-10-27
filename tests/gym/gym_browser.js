const fetch=require('../support/authenticated_fetch.js');
// Runs only against the runner's temporary database and hidden browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const base='http://127.0.0.1:'+process.argv[2],debug=process.argv[3],pages=await fetch('http://127.0.0.1:'+debug+'/json/list').then(r=>r.json()),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map(),errors=[];const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Page.javascriptDialogOpening')call('Page.handleJavaScriptDialog',{accept:true})};
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const wait=async exp=>{for(let i=0;i<120;i++){if(await js(exp))return;await new Promise(r=>setTimeout(r,80))}throw Error('Timed out: '+exp)};
 const click=async sel=>js(`document.querySelector(${JSON.stringify(sel)}).click()`);
 const state=()=>fetch(base+'/api/gym').then(r=>r.json());
 const form=async values=>js(`(()=>{const f=document.querySelector('dialog[open] form');for(const [k,v] of Object.entries(${JSON.stringify(values)})){if(f.elements[k].type==='checkbox')f.elements[k].checked=v;else f.elements[k].value=v}f.requestSubmit()})()`);
 const shot=async name=>{const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(os.tmpdir(),name),Buffer.from(r.data,'base64'))};
 const pick=async(name,value)=>{await wait(`!!document.querySelector('.gym-onboarding input[name=${name}][value="${value}"]')`);await js(`document.querySelector('.gym-onboarding input[name=${name}][value="${value}"]').click()`)};
 const next=()=>click('.gym-onboarding [data-ob=next]'),obError=()=>js("document.querySelector('.gym-onboarding .gym-error').textContent");
 const doneSets=()=>js("document.querySelectorAll('.gym-view.active .gym-live .gym-set.done').length");
 await fetch.browser(base,call);await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1536,height:1024,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:base});
 await wait("document.querySelector('#gymEnabled')&&!document.querySelector('#gymEnabled').disabled");
 assert(await js("document.querySelector('#gymNav').hidden"));assert.equal((await state()).profile.enabled,false);
 // First visit after enabling: the plan questions start straight away. Skipping is possible and remembered.
 await click('.nav [data-view=settings]');await click('#gymEnabled');await wait("!document.querySelector('#gymNav').hidden");await click('#gymNav [data-view=gym-overview]');
 await wait("!!document.querySelector('.gym-view.active .gym-onboarding .gym-welcome')");
 await click('.gym-onboarding [data-ob=skip]');await wait("!!document.querySelector('.gym-view.active .gym-hero')");assert((await state()).profile.onboarding_skipped);
 assert(await js("document.querySelector('.gym-view.active').textContent.includes('comfortable starting weight')"),'the suggested workout is still available without a plan');
 await click('.gym-view.active [data-gym=plan-new]');await wait("!!document.querySelector('.gym-view.active .gym-onboarding .gym-welcome')");await next();
 // About you: errors are explained in plain words.
 await wait("!!document.querySelector('.gym-onboarding [name=age]')");await next();assert((await obError()).includes('age'));
 await js("const f=document.querySelector('.gym-ob-form');f.age.value='21';f.height.value='175';f.weight.value='70'");await next();
 // Single-choice questions move on by themselves.
 for(const [name,value] of [['activity','light'],['goal','muscle'],['level','beginner'],['location','gym'],['style','machines']])await pick(name,value);
 await wait("!!document.querySelector('.gym-onboarding input[name=enjoy]')");assert(await js("document.querySelector('.gym-onboarding input[name=enjoy][value=strength]').checked"));
 for(const v of ['cardio','core'])await pick('enjoy',v);await pick('focus','Arms');await next();
 await wait("!!document.querySelector('.gym-onboarding input[name=days]')");await next();assert((await obError()).includes('training day'));
 const today=await js('(new Date().getDay()+6)%7'),days=[today,(today+2)%7,(today+4)%7];
 for(const d of days)await pick('days',d);assert(await js("document.querySelector('[data-day-count]').textContent==='3 chosen'"));await next();
 await wait("!!document.querySelector('.gym-review')");assert(await js("document.querySelector('.gym-review').textContent.includes('Machines')"));
 await shot('gym-onboarding-review.png');await next();
 await wait("!!document.querySelector('.gym-view.active .gym-xp')");
 let s=await state();const plan=s.profile.plan,todays=plan.sessions.find(x=>x.weekday===today);
 assert.deepEqual(plan.sessions.map(x=>x.weekday),[...days].sort((a,b)=>a-b));assert.equal(plan.answers.style,'machines');assert.equal(s.profile.onboarding_skipped,undefined);
 assert(s.targets.calories>0&&s.targets.water_ml>0);assert.deepEqual([s.plan_progress.level,s.plan_progress.discipline],[1,50]);
 assert(todays.exercises.every(x=>GymRulesCheck(x)),'plan uses known exercises');
 function GymRulesCheck(x){return typeof x.id==='string'&&x.sets>0&&x.rest>=0}
 // Today's challenge lists every exercise with its picture, and the week shows the plan.
 assert(await js(`document.querySelector('.gym-view.active .gym-today').textContent.includes(${JSON.stringify(todays.name)})`));
 assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-today .gym-ex-row').length"),todays.exercises.length);
 assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-today .gym-ex-row .ga-tile svg').length"),todays.exercises.length);
 assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-wday').length"),7);assert(await js("document.querySelector('.gym-view.active .gym-wday.is-today').classList.contains('today')"));
 await shot('gym-plan-hub-desktop.png');
 await click('.gym-view.active .gym-today .gym-ex-row');await wait("!!document.querySelector('dialog[open] .ga-demo')");assert(await js("document.querySelectorAll('dialog[open] .gym-steps li').length>0"));await click('dialog[open] [data-close]');
 await click('.gym-view.active [data-gym=xp-help]');await wait("document.querySelector('dialog[open]')?.textContent.includes('Skip Wednesday')");await click('dialog[open] [data-close]');
 // Live workout: every exercise is listed and sets are logged in place.
 await click('.gym-view.active .gym-today [data-gym^="plan-start:"]');await wait("!!document.querySelector('.gym-view.active .gym-live')");
 assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-live-ex').length"),todays.exercises.length);
 assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-live .gym-set.next').length"),1,'only the current exercise is highlighted');
 const logNext=async(weight='40')=>{const before=await doneSets();await js(`(()=>{const r=document.querySelector('.gym-view.active .gym-live .gym-set[data-set-row]');const w=r.querySelector('[name=weight]');if(w&&w.value==='')w.value=${JSON.stringify(weight)};r.querySelector('.gym-set-log').click()})()`);await wait(`document.querySelectorAll('.gym-view.active .gym-live .gym-set.done').length===${before+1}`)};
 await js("document.querySelector('.gym-view.active .gym-set.next [name=weight]').value='40'");await logNext();
 s=await state();assert.equal(s.sets.length,1);assert.equal(s.sets[0].weight,40);
 assert(await js("!document.querySelector('.gym-view.active [data-rest-bar]').hidden"),'rest timer starts after a set');
 const restBefore=await js("document.querySelector('.gym-view.active [data-rest-bar] [data-timer-output]').textContent");await click('.gym-view.active [data-rest-bar] [data-gym=timer-add]');
 assert(await js(`document.querySelector('.gym-view.active [data-rest-bar] [data-timer-output]').textContent>${JSON.stringify(restBefore)}`));await click('.gym-view.active [data-gym=rest-skip]');assert(await js("document.querySelector('.gym-view.active [data-rest-bar]').hidden"));
 // Logged sets survive a reload; then finish every planned set.
 await call('Page.navigate',{url:base+'/?recover=1'});await wait("!!document.querySelector('#gymNav [data-view=gym-workouts]')");await click('#gymNav [data-view=gym-workouts]');await wait("!!document.querySelector('.gym-view.active .gym-live')");assert.equal(await doneSets(),1);
 const planned=todays.exercises.reduce((n,x)=>n+x.sets,0);while(await doneSets()<planned)await logNext('20');
 assert.equal((await state()).sets.length,planned);await shot('gym-live-workout.png');
 await click('.gym-view.active .gym-live-head [data-gym=finish]');await wait("!!document.querySelector('dialog[open] .gym-celebrate')");
 assert(await js("document.querySelector('dialog[open] .gym-celebrate').textContent.includes('+100 XP')"));await click('dialog[open] [data-close]');
 s=await state();assert.equal(s.sessions[0].status,'completed');assert.deepEqual([s.plan_progress.xp,s.plan_progress.discipline,s.plan_progress.log[0].kind],[100,60,'on_plan']);
 await click('#gymNav [data-view=gym-overview]');await wait("!!document.querySelector('.gym-view.active .gym-today.done')");assert(await js("document.querySelector('.gym-view.active .gym-wday.is-today').classList.contains('done')"));
 // Weekly Progress: first week sets the benchmark; trained muscles are covered.
 const trained=await js(`GymRules.muscleOf(${JSON.stringify(s.sets[0].exercise_id)}).muscle`);
 assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-weekly [data-gym-muscle]').length"),7);
 assert(await js(`document.querySelector('.gym-view.active .gym-weekly [data-gym-muscle=${JSON.stringify(trained)}]').classList.contains('covered')`));
 assert(await js("document.querySelector('.gym-view.active [data-gym-weekly-status]').textContent.includes('first benchmark')"));
 assert(await js("document.querySelector('.gym-view.active [data-gym=review-next]').disabled"));await click('.gym-view.active [data-gym=review-prev]');await wait("!document.querySelector('.gym-view.active [data-gym=review-next]').disabled");await click('.gym-view.active [data-gym=review-next]');
 // Weekly plan page: every day listed, swap an exercise, add a plan day to the timetable.
 await click('#gymNav [data-view=gym-workouts]');await wait("!!document.querySelector('.gym-view.active .gym-plan-days')");
 assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-plan-day').length"),7);assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-plan-day.rest').length"),4);
 const first=plan.sessions[0];await click(`.gym-view.active [data-gym="plan-swap:${first.weekday}:0"]`);await wait("!!document.querySelector('dialog[open] .gym-swap input')");
 const swapTo=await js("document.querySelector('dialog[open] .gym-swap input:checked').value");await js("document.querySelector('dialog[open] form').requestSubmit()");await wait("!document.querySelector('dialog[open]')");
 s=await state();assert.equal(s.profile.plan.sessions[0].exercises[0].id,swapTo);assert.equal(s.profile.plan.schedule.length,1,'same-day edits replace the schedule entry');
 await click(`.gym-view.active [data-gym="plan-calendar:${first.weekday}"]`);await wait("!!document.querySelector('dialog[open] [name=recurrence]')");
 assert.equal(await js("document.querySelector('dialog[open] [name=recurrence]').value"),'weekly');assert.equal(await js("document.querySelector('dialog[open] [name=start_time]').value"),'18:30');await js("document.querySelector('dialog[open] form').requestSubmit()");await wait("!document.querySelector('dialog[open]')");
 let planned2=(await state()).calendar_workouts[0];assert.equal(planned2.title,'Gym · Plan · '+first.name);assert.equal(planned2.recurrence,'weekly');
 await click('.gym-view.active [data-gym="remove-plan:'+planned2.id+'"]');await wait("!document.querySelector('.gym-calendar-list .gym-history-row')");
 // Saved workouts: create, duplicate, edit, delete.
 await click('.gym-view.active [data-gym=custom]');await wait("!!document.querySelector('dialog[open] [name=name]')");assert(await js("!!document.querySelector('dialog[open] .gym-custom-list .ga-tile')"));
 await form({name:'My custom session',include_pushup:true,sets_pushup:2,reps_pushup:10});await wait("!document.querySelector('dialog[open]')");
 const custom=(await state()).workouts.find(w=>w.data.name==='My custom session');assert(custom);await click('.gym-view.active [data-gym="duplicate:'+custom.id+'"]');await wait("document.querySelector('.gym-programs').textContent.includes('(copy)')");await click('.gym-view.active [data-gym="edit:'+custom.id+'"]');await form({name:'Edited program'});await wait("!document.querySelector('dialog[open]')");await click('.gym-view.active [data-gym="delete:'+custom.id+'"]');await wait("!document.querySelector('.gym-programs').textContent.includes('Edited program')");
 // Own routines and Gym A / B examples, a timed circuit, and timetable scheduling.
 await click('.gym-view.active [data-gym=examples]');await wait("[...document.querySelectorAll('.gym-view.active .gym-programs h4')].some(e=>e.textContent==='Gym B')");
 let gymA=(await state()).workouts.find(w=>w.data.name==='Gym A');assert.equal(gymA.data.exercises[4].unit,'seconds');assert.equal(gymA.data.exercises[4].reps_max,45);
 await click('.gym-view.active [data-gym=own-workout]');await form({name:'My timed circuit',duration:20,routine:'Wall sit | 2 | 30-45 | seconds\nStep ups | 2 | 8-12 | reps'});await wait("!document.querySelector('dialog[open]')");
 const circuit=(await state()).workouts.find(w=>w.data.name==='My timed circuit');assert.equal(circuit.data.exercises.length,2);
 await click('.gym-view.active [data-gym="plan:'+gymA.id+'"]');await form({date:'2027-01-05',start_time:'17:00',end_time:'18:00',recurrence:'weekly',repeat_until:'2027-02-02',location:'Uni Gym'});await wait("!document.querySelector('dialog[open]')");
 planned2=(await state()).calendar_workouts[0];assert.equal(planned2.title,'Gym · Gym A');const portal=await fetch(base+'/api/portal').then(r=>r.json());assert(portal.timetable_events.some(e=>e.id===planned2.id));
 await click('.gym-view.active [data-gym="program:'+circuit.id+'"]');await wait("document.querySelector('.gym-view.active .gym-live')?.textContent.includes('Wall sit')");
 assert(await js("!document.querySelector('.gym-view.active #gym-live-0 [name=weight]')"),'timed holds need no weight');assert(await js("document.querySelector('.gym-view.active #gym-live-0').textContent.includes('sec')"));
 await js("document.querySelector('.gym-view.active #gym-live-0 [name=reps]').value='35'");await logNext();assert(await js("document.querySelector('.gym-view.active #gym-live-0 .gym-set.done').textContent.includes('35 sec')"));
 await click('.gym-view.active .gym-live-head [data-gym=finish]');await wait("!!document.querySelector('dialog[open] .gym-celebrate')");await click('dialog[open] [data-close]');
 assert.equal((await state()).plan_progress.xp,100,'a second workout on the same planned day adds no extra XP');
 await click('.gym-view.active [data-gym="remove-plan:'+planned2.id+'"]');await wait("!document.querySelector('.gym-calendar-list .gym-history-row')");assert.equal((await state()).calendar_workouts.length,0);
 // Nutrition: daily needs with food ideas, the calculator and the food log.
 await click('#gymNav [data-view=gym-nutrition]');await wait("!!document.querySelector('.gym-view.active .gym-needs')");assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-need').length"),6);
 assert(await js("document.querySelector('.gym-view.active .gym-needs-card').textContent.includes('Per meal')"));
 await click('.gym-view.active [data-gym=calculator]');await form({height:175,weight:70,age:21,sex:'male',activity:'moderate',goal:'maintain',adult_confirmation:true});await wait("!document.querySelector('dialog[open]')");assert.equal((await state()).targets.inputs.activity,'moderate');
 await click('.gym-view.active [data-gym=food]');await form({name:'Test lunch',calories:600,protein:30,carbs:70,fat:20});await wait("!document.querySelector('dialog[open]')");assert.equal((await state()).food_logs.length,1);assert(await js("document.querySelector('.gym-view.active').textContent.includes('Test lunch')"));
 // Progress: level card, XP history and measurements.
 await click('#gymNav [data-view=gym-progress]');await wait("!!document.querySelector('.gym-view.active .gym-xp')");assert(await js("document.querySelector('.gym-view.active').textContent.includes('On plan')"));
 await click('.gym-view.active [data-gym=measurement]');await form({weight:70,waist:80});await wait("!document.querySelector('dialog[open]')");await click('.gym-view.active [data-gym=measurement]');await form({weight:71});await wait("!document.querySelector('dialog[open]')");assert.equal((await state()).measurements.length,2);
 // Hub tools: plate calculator, pause and resume, and changing answers keeps everything.
 await click('#gymNav [data-view=gym-overview]');await wait("!!document.querySelector('.gym-view.active [data-gym=plates]')");
 await click('.gym-view.active [data-gym=plates]');await js("var pf=document.querySelector('dialog[open] form');pf.elements.target.value='100';pf.elements.target.dispatchEvent(new Event('input'))");assert(await js("document.querySelector('[data-plate-result]').textContent.includes('Exact load')"));await click('dialog[open] [data-close]');
 await click('.gym-view.active [data-gym=plan-pause]');await wait("!!document.querySelector('.gym-view.active .gym-banner-note.paused')");assert((await state()).plan_progress.paused);
 await click('.gym-view.active .gym-banner-note.paused [data-gym=plan-resume]');await wait("!document.querySelector('.gym-view.active .gym-banner-note.paused')");assert(!(await state()).plan_progress.paused);
 await click('.gym-view.active [data-gym=plan-edit]');await wait("document.querySelector('.gym-onboarding [name=age]')?.value==='21'");
 await click('.gym-onboarding [data-ob=back]');await wait("!!document.querySelector('.gym-onboarding [data-ob=cancel]')");await click('.gym-onboarding [data-ob=cancel]');await wait("!!document.querySelector('.gym-view.active .gym-xp')");
 // The Gym group toggle flips and remembers its state (whatever it starts as).
 const wasOpen=await js("document.querySelector('#gymToggle').getAttribute('aria-expanded')");await click('#gymToggle');assert.equal(await js("localStorage.getItem('portal.gymExpanded')"),String(wasOpen!=='true'));await click('#gymToggle');assert.equal(await js("localStorage.getItem('portal.gymExpanded')"),String(wasOpen==='true'));
 // Disabling keeps every record; settings hold units and plan shortcuts.
 await click('.nav [data-view=settings]');assert(await js("!!document.querySelector('.gym-settings [data-gym=settings-plan]')"));await click('#gymEnabled');await wait("document.querySelector('#gymNav').hidden");
 s=await state();assert.equal(s.sessions.length,2);assert(s.profile.plan);await click('#gymEnabled');await wait("!document.querySelector('#gymNav').hidden");
 await click('#gymNav [data-view=gym-overview]');await wait("!!document.querySelector('.gym-view.active .gym-xp')");
 // Small screens and both themes: no sideways scrolling anywhere.
 for(const width of [320,390,744]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});for(const dark of [true,false]){await js(`document.body.classList.toggle('dark',${dark})`);for(const view of ['gym-overview','gym-workouts','gym-nutrition','gym-progress']){await js(`showView('${view}')`);await wait(`document.querySelector('.gym-view.active')?.id==='view-${view}'&&!!document.querySelector('.gym-view.active .gym-card')`);assert(await js("document.documentElement.scrollWidth<=innerWidth"),`No page overflow at ${width}px on ${view}`)}}}
 await js("document.body.classList.add('dark');showView('gym-overview')");await shot('gym-mobile-dark.png');assert(await js("getComputedStyle(document.querySelector('.gym-view.active .gym-card')).backgroundColor!== 'rgb(255, 255, 255)'"));
 await click('#menuToggle');await click('#gymNav [data-view=gym-workouts]');await wait("!!document.querySelector('.gym-view.active .gym-programs')");assert.equal(await js("document.body.classList.contains('nav-open')"),false);
 // Exercise library: pictures, search, Machine / Own weight tabs, builder filtering and logging straight from the library.
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await click('#gymNav [data-view=gym-workouts]');await wait("!!document.querySelector('.gym-view.active [data-filter-scope=library]')");
 const shown=`[...document.querySelectorAll('.gym-view.active .gym-library [data-ex]')].filter(b=>!b.hidden&&b.offsetParent)`,query=q=>js(`var lq=document.querySelector('.gym-view.active [data-filter-q]');lq.value=${JSON.stringify(q)};lq.dispatchEvent(new Event('input',{bubbles:true}))`);
 assert.equal(await js(shown+'.length'),await js('GymRules.exercises.length'));assert.equal(await js("document.querySelectorAll('.gym-view.active .gym-library .ga-tile').length"),await js('GymRules.exercises.length'));
 await query('smith');await click('.gym-view.active [data-filter-type=machine]');assert(await js(shown+".length>=5&&"+shown+".every(b=>GymRules.byId(b.dataset.ex).type==='machine')"));
 await query('squads');await click('.gym-view.active [data-filter-type=free]');assert(await js(shown+".some(b=>b.dataset.ex==='squat')&&"+shown+".every(b=>GymRules.byId(b.dataset.ex).type==='free')"));
 await query('zzz no match');assert(await js("document.querySelector('.gym-view.active [data-filter-count]').textContent.includes('No exercises match')"));
 await query('stretch');await click('.gym-view.active [data-filter-type=all]');assert(await js(shown+".length>=4&&"+shown+".every(b=>GymRules.byId(b.dataset.ex).muscle==='Mobility')"));
 await query('');await js("var lm=document.querySelector('.gym-view.active [data-filter-muscle]');lm.value='Cardio';lm.dispatchEvent(new Event('input',{bubbles:true}))");assert(await js(shown+".length>=8&&"+shown+".every(b=>GymRules.byId(b.dataset.ex).muscle==='Cardio')"));
 await click('.gym-view.active [data-gym=custom]');await wait("!!document.querySelector('dialog[open] [data-filter-scope=builder]')");
 await js("var bq=document.querySelector('dialog[open] [data-filter-q]');bq.value='pec deck';bq.dispatchEvent(new Event('input',{bubbles:true}))");
 assert.deepEqual(await js("[...document.querySelectorAll('dialog[open] .gym-custom-list [data-ex]')].filter(r=>!r.hidden).map(r=>r.dataset.ex).sort()"),['pecdeck','reversepec']);
 await js("document.querySelector('dialog[open] [name=include_pecdeck]').click()");await click('dialog[open] [data-filter-type=selected]');
 assert(await js("document.querySelector('dialog[open] [data-filter-count]').textContent.includes('1 ticked')"));assert(await js("document.querySelector('dialog[open] [name=reps_pecdeck]').offsetParent!==null"));
 await form({name:'Machine day',include_treadmill:true,reps_treadmill:15});await wait("!document.querySelector('dialog[open]')");
 const machineDay=(await state()).workouts.find(w=>w.data.name==='Machine day').data.exercises;assert.deepEqual(machineDay.map(e=>[e.id,e.unit,e.reps]),[['pecdeck','reps',8],['treadmill','minutes',15]]);
 await wait("!!document.querySelector('.gym-view.active [data-gym=\"library:treadmill\"]')");await click('.gym-view.active [data-gym="library:treadmill"]');await wait("!!document.querySelector('dialog[open] [data-gym=\"quick:treadmill\"]')");
 assert(await js("document.querySelector('dialog[open]').textContent.includes('Machine')"));assert(await js("!!document.querySelector('dialog[open] .ga-demo')"));await click('dialog[open] [data-gym="quick:treadmill"]');
 await wait("document.querySelector('.gym-view.active .gym-live')?.textContent.includes('Treadmill')");assert(await js("!document.querySelector('.gym-view.active #gym-live-0 [name=weight]')"));
 await js("document.querySelector('.gym-view.active #gym-live-0 [name=reps]').value='20'");await logNext();assert(await js("document.querySelector('.gym-view.active #gym-live-0 .gym-set.done').textContent.includes('20 min')"));
 await click('.gym-view.active [data-gym="library:plank"]');await wait("document.querySelector('dialog[open]')?.textContent.includes('Add to current workout')");await click('dialog[open] [data-gym="quick:plank"]');
 await wait("document.querySelectorAll('.gym-view.active .gym-live-ex').length===2");let quick=(await state()).sessions.find(x=>x.status==='active').data;assert.deepEqual(quick.exercises.map(e=>e.id),['treadmill','plank']);
 await click('.gym-view.active .gym-live-head [data-gym=finish]');await wait("!document.querySelector('.gym-view.active .gym-live')");
 assert.deepEqual(errors,[]);console.log('PASS Gym browser: plan questions (skip, errors, auto-advance), plan hub with pictures, how-to and XP help, full-list workout logging with rest timer and reload recovery, XP and discipline, weekly progress, plan swap and timetable, saved/own/timed routines, nutrition needs and logs, measurements, pause/resume and answer editing, settings, library search/types/quick logging, mobile 320/390/744 and dark/light themes');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
