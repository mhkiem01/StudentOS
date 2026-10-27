const assert=require('node:assert/strict'),fetch=require('../support/authenticated_fetch.js');
// Reshuffle: a new question order for the questions not answered yet; answers stay with their questions through resume, results and the manager.
(async()=>{
 const base='http://127.0.0.1:'+process.argv[2],debug='http://127.0.0.1:'+process.argv[3];
 const pages=await global.fetch(debug+'/json/list').then(r=>r.json()),ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Page.javascriptDialogOpening')call('Page.handleJavaScriptDialog',{accept:true})};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const wait=async q=>{for(let i=0;i<100;i++){if(await js(q))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timeout: '+q)};
 await fetch.browser(base,call);await call('Runtime.enable');await call('Page.enable');
 const load=async()=>{await call('Page.navigate',{url:base});await wait("typeof startQuiz==='function' && !!document.querySelector('#portalDashboard .week-hour')")};
 await load();
 const K=JSON.stringify('Shuffle Test'),N=8;
 await js(`state.topics[${K}]=Array.from({length:${N}},(_,i)=>({question:'Question '+(i+1),choices:{A:'Yes '+(i+1),B:'No '+(i+1)},answer:i%2?'B':'A',explain:''}));state.progress[${K}]={answered:0,correct:0};save();saveQueue`);
 const begin=async()=>{await js(`startQuiz(${K})`);await wait("!!document.querySelector('#beginChosenQuiz')");await js("document.querySelector('#beginChosenQuiz').click()");await wait("currentView==='quiz'&&!document.querySelector('.modal')")};
 const shown=()=>js("document.querySelector('#questionText').textContent");
 const counter=()=>js("document.querySelector('#questionCounter').textContent");
 const order=()=>js("state.attempt.order");
 const answerShown=()=>js(`submitAnswer(state.topics[${K}][currentQuestionIndex()].answer)`);
 const saved=expr=>js(`saveQueue.then(()=>fetch('/api/state')).then(r=>r.json()).then(d=>JSON.stringify(${expr}))`);

 // A new attempt starts in the usual order; Reshuffle at the start changes which question comes first.
 await begin();
 assert.equal(await shown(),'Question 1');assert.equal(await counter(),`Question 1 of ${N}`);
 assert.equal(await js("document.querySelector('#reshuffleQuizBtn').disabled"),false);
 await js("document.querySelector('#reshuffleQuizBtn').click()");
 let o=await order();assert.deepEqual([...o].sort((a,b)=>a-b),[...Array(N).keys()],'order is a permutation of the questions');
 assert.notDeepEqual(o,[...Array(N).keys()]);
 assert.equal(await shown(),`Question ${o[0]+1}`);assert.equal(await counter(),`Question 1 of ${N}`);
 assert.equal(await js("document.querySelector('#reshuffleQuizBtn').textContent"),'🔀 Reshuffled ✓');

 // Answers are recorded against the question shown, and reshuffling later keeps answered questions in place.
 await answerShown();assert(await js("document.querySelector('#feedbackTitle').textContent.startsWith('Correct')"));
 assert.deepEqual(Object.keys(await js('state.attempt.answers')),[String(o[0])]);
 const first=o[0];await js("document.querySelector('#reshuffleQuizBtn').click()");o=await order();
 assert.equal(o[0],first,'the answered question keeps its position');
 assert.equal(await shown(),`Question ${first+1}`,'the answered question stays on screen');
 await js('goNextQuestion()');assert.equal(await counter(),`Question 2 of ${N}`);assert.equal(await shown(),`Question ${o[1]+1}`);
 await answerShown();await js('goNextQuestion()');

 // The saved attempt keeps its order through a reload and resumes on the same question.
 assert.equal(await saved(`d.sessions[${K}].order`),JSON.stringify(o));
 await load();await begin();
 assert.deepEqual(await order(),o);assert.equal(await counter(),`Question 3 of ${N}`);assert.equal(await shown(),`Question ${o[2]+1}`);
 assert.deepEqual(Object.keys(await js('state.attempt.answers')).map(Number).sort(),[o[0],o[1]].sort());

 // With one question left there is nothing to shuffle.
 for(let i=2;i<N-1;i++){await answerShown();await js('goNextQuestion()')}
 assert.equal(await js("document.querySelector('#reshuffleQuizBtn').disabled"),true);
 await answerShown();await js('goNextQuestion()');await wait("currentView==='results'");

 // Results count every answer as correct and list questions in the order they were asked.
 assert.equal(await js(`state.latestResults[${K}].correct`),N);
 assert.deepEqual(await js("[...document.querySelectorAll('#resultsQuestions .result-q-title')].map(e=>e.textContent)"),o.map((q,i)=>`${i+1}. Question ${q+1}`));

 // Restart begins again in the usual order.
 await js(`restartQuiz(${K},false)`);await wait("!!document.querySelector('#beginChosenQuiz')");await js("document.querySelector('#beginChosenQuiz').click()");await wait("currentView==='quiz'&&!document.querySelector('.modal')");
 assert.equal(await order(),null);assert.equal(await shown(),'Question 1');

 // Moving or deleting questions in the manager keeps a saved shuffled attempt showing the same questions in the same places.
 await js("document.querySelector('#reshuffleQuizBtn').click()");await answerShown();await js('saveAttemptCheckpoint(1);save()');
 const sequence=`state.sessions[${K}].order.map(i=>state.topics[${K}][i].question)`,answered=`Object.keys(state.sessions[${K}].answers).map(i=>state.topics[${K}][i].question)`;
 const before=await js(sequence),answeredBefore=await js(answered);
 await js(`moveManagedQuestion(${K},0,1)`);
 assert.deepEqual(await js(sequence),before);assert.deepEqual(await js(answered),answeredBefore);
 const removed=await js(`state.topics[${K}][3].question`);
 await js(`state.topics[${K}].splice(3,1);adjustSessionAfterQuestionDelete(${K},3)`);
 assert.deepEqual(await js(sequence),before.filter(q=>q!==removed));
 assert.deepEqual(errors,[]);
 console.log('PASS quiz reshuffle: shuffle at the start, keep answered questions in place, answers follow their questions, resume after reload, results in asked order, restart in usual order, manager move/delete keep the saved order.');
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
