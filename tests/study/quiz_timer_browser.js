const assert=require('node:assert/strict'),fetch=require('../support/authenticated_fetch.js');
// Quiz timer: no timer, count up, or count down from a chosen time limit; running out of time finishes the quiz.
(async()=>{
 const base='http://127.0.0.1:'+process.argv[2],debug='http://127.0.0.1:'+process.argv[3];
 const pages=await global.fetch(debug+'/json/list').then(r=>r.json()),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const wait=async q=>{for(let i=0;i<100;i++){if(await js(q))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timeout: '+q)};
 await fetch.browser(base,call);await call('Page.enable');await call('Page.navigate',{url:base});
 await wait("typeof startQuiz==='function' && !!document.querySelector('#portalDashboard .week-hour')");
 const K=JSON.stringify('Timer Test');
 await js(`state.topics[${K}]=[1,2,3].map(i=>({question:'Question '+i,choices:{A:'Right',B:'Wrong'},answer:'A',explain:''}));state.progress[${K}]={answered:0,correct:0};save();saveQueue`);
 const saved=expr=>js(`saveQueue.then(()=>fetch('/api/state')).then(r=>r.json()).then(d=>JSON.stringify(${expr}))`);
 const open=async()=>{await js(`startQuiz(${K})`);await wait("!!document.querySelector('#beginChosenQuiz')")};
 const choose=value=>js(`{const c=document.querySelector('#quizTimerChoice');c.value='${value}';c.dispatchEvent(new Event('change'))}`);
 const begin=async()=>{await js("document.querySelector('#beginChosenQuiz').click()");await wait("currentView==='quiz'&&!document.querySelector('.modal')")};
 const button=()=>js("document.querySelector('#quizTimerBtn').textContent");

 // The start window offers no timer, count up or count down; minutes are asked only for count down.
 await open();
 assert.equal(await js("[...document.querySelectorAll('#quizTimerChoice option')].map(o=>o.value).join()"),'none,up,down');
 assert.equal(await js("document.querySelector('#quizTimerChoice').value"),'none');
 const shown=sel=>js(`getComputedStyle(document.querySelector('${sel}')).display!=='none'`);
 assert.equal(await shown('#quizTimerMinutesRow'),false);
 assert.equal(await shown('#masteryTargetRow'),false,'the mastery target is only shown for Mastery');
 await choose('down');
 assert.equal(await shown('#quizTimerMinutesRow'),true);
 assert.equal(await js("document.querySelector('#quizTimerMinutes').value"),'30');
 await js("document.querySelector('#quizTimerMinutes').value='0';document.querySelector('#beginChosenQuiz').click()");
 assert.match(await js("document.querySelector('#quizTypeError').textContent"),/1 to 600 whole minutes/);
 assert(await js("!!document.querySelector('#beginChosenQuiz')"),'an invalid time limit keeps the window open');
 await js("document.querySelector('#quizTimerMinutes').value='30'");await begin();
 assert.match(await button(),/^⏸ (30:00|29:5\d) left$/);
 assert.match(await js("document.querySelector('#attemptTime').textContent"),/ left$/);
 assert.equal(await saved(`[d.quizSettings[${K}].timer,d.quizSettings[${K}].minutes,d.sessions[${K}].timer.limitMs]`),'["down",30,1800000]');

 // Pausing keeps the time left; reopening the saved attempt keeps its countdown and says so.
 await js("submitAnswer('A')");
 await js("document.querySelector('#quizTimerBtn').click()");
 assert.match(await button(),/^▶ (30:00|29:\d\d) left$/);
 const left=await js("timerRemaining()");
 await js("showView('dashboard')");await open();
 assert.match(await js("document.querySelector('#quizTimerLocked').textContent"),/left of 30:00\. Restart the quiz to change it\./);
 assert.equal(await js("!!document.querySelector('#quizTimerChoice')"),false);
 await begin();
 assert.match(await button(),/^▶ /,'a countdown you paused stays paused');
 assert.equal(await js("timerRemaining()"),left);

 // The last minute is highlighted; reaching 0:00 finishes the quiz and leaves the rest unanswered.
 await js("document.querySelector('#quizTimerBtn').click();{const t=state.attempt.timer;t.startedAt=Date.now()-(t.limitMs-t.elapsedMs-2500)}");
 await wait("document.querySelector('#quizTimerBtn').classList.contains('low')");
 assert.match(await button(),/^⏸ 0:0[1-3] left$/);
 await wait("currentView==='results'");
 assert.equal(await js("document.querySelector('#resultsMessage').textContent"),"Time's up! Your 30:00 time limit ran out after 1 of 3 questions. You answered 1 correctly.");
 assert.equal(await js("document.querySelector('#resultsTime').textContent"),'30:00 / 30:00');
 assert.equal(await js("document.querySelector('#resultsEyebrow').textContent"),"Time's up");
 assert.equal(await js("[...document.querySelectorAll('#resultsQuestions .result-badge')].filter(b=>b.textContent==='Not answered').length"),2);
 assert.equal(await js(`isQuizComplete(${K})`),false,'an attempt cut short by the timer is not a completed quiz');
 assert.equal(await saved(`[d.latestResults[${K}].timeUp,d.latestResults[${K}].limitMs,d.latestResults[${K}].answered,!!d.sessions[${K}]]`),'[true,1800000,1,false]');

 // The last timer choice is remembered; finishing in time shows the time used out of the limit.
 await open();
 assert.equal(await js("document.querySelector('#quizTimerChoice').value"),'down');
 await js("document.querySelector('#quizTimerMinutes').value='2'");await begin();
 assert.match(await button(),/^⏸ (2:00|1:59) left$/);
 await js("submitAnswer('A');goNextQuestion();submitAnswer('B');goNextQuestion();submitAnswer('A');goNextQuestion()");
 await wait("currentView==='results'");
 assert.match(await js("document.querySelector('#resultsMessage').textContent"),/^You answered 2 correctly out of 3 answered questions\. Completed in 0:0\d of your 2:00 time limit\.$/);
 assert.match(await js("document.querySelector('#resultsTime').textContent"),/^0:0\d \/ 2:00$/);
 assert.equal(await js(`isQuizComplete(${K})`),true);
 assert.equal(await js("document.querySelector('#resultsEyebrow').textContent"),'Quiz complete');

 // Counting up still works; the in-quiz timer button asks which kind of timer to start.
 await open();await choose('none');await begin();
 assert.equal(await button(),'⏱ Start timer');
 await js("document.querySelector('#quizTimerBtn').click()");await wait("!!document.querySelector('#startAttemptTimer')");
 assert.equal(await js("[...document.querySelectorAll('#quizTimerChoice option')].map(o=>o.value).join()"),'up,down');
 await choose('up');await js("document.querySelector('#startAttemptTimer').click()");await wait("!document.querySelector('.modal')");
 assert.match(await button(),/^⏸ 0:0\d$/);
 assert.equal(await js("state.attempt.timer.limitMs"),0);
 assert.equal(await saved(`[d.quizSettings[${K}].timer,d.sessions[${K}].timer.enabled]`),'["up",true]');

 // A saved countdown that already ran out finishes as soon as it is opened.
 await js(`showView('dashboard');state.sessions[${K}]={currentIndex:1,answers:{0:'A'},flags:{},timer:{enabled:true,elapsedMs:60000,resumeOnOpen:true,limitMs:60000}};save()`);
 await open();
 assert.match(await js("document.querySelector('#quizTimerLocked').textContent"),/0:00 left of 1:00/);
 await js("document.querySelector('#beginChosenQuiz').click()");await wait("currentView==='results'");
 assert.match(await js("document.querySelector('#resultsMessage').textContent"),/^Time's up! Your 1:00 time limit ran out after 1 of 3 questions\./);

 // Phone width in dark mode: the start window and the countdown fit without sideways scrolling.
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await js("document.body.classList.add('dark')");
 await open();await choose('down');
 assert(await js("document.querySelector('.modal').scrollWidth<=document.querySelector('.modal').clientWidth"));
 await begin();
 assert.match(await button(),/ left$/);
 assert(await js("document.documentElement.scrollWidth<=innerWidth"));
 console.log('PASS quiz timer: no timer / count up / count down choice, time limit validation and memory, pause and resume, saved countdown, last-minute warning, time running out finishes the quiz, results show time used of the limit, phone width in dark mode.');ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
