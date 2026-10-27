const assert=require('node:assert/strict');
// Subject page: the Topics tab keeps full topic cards; the Quizzes tab lists quizzes only.
module.exports=async(js,call)=>{
 const wait=async q=>{for(let i=0;i<100;i++){try{if(await js(q))return}catch{/* page may still be reloading */}await new Promise(r=>setTimeout(r,100))}throw Error('Subject quizzes timeout: '+q)};
 await js("showView('dashboard');openSubject(subjectForTopic('Design Principles').id)");
 await wait("!!document.querySelector('#view-subject [data-subject-tab=quizzes]')");

 // A subject always opens on its Topics tab, even after visiting its Notes; there is no separate Overview tab.
 await js("document.querySelector('#view-subject [data-subject-tab=notes]').click()");
 await wait("currentView==='notes'");
 await js(`showView('home');document.querySelector('[data-subject-open="'+subjectForTopic('Design Principles').id+'"] h3').click()`);
 await wait("currentView==='subject'");
 assert.equal(await js("[...document.querySelectorAll('#view-subject .subject-tabs button.active')].map(b=>b.dataset.subjectTab).join()"),'topics');
 assert.equal(await js("[...document.querySelectorAll('#view-subject [data-subject-tab]')].map(b=>b.dataset.subjectTab).join()"),'topics,quizzes,flashcards,notes,progress');
 assert.equal(await js("document.querySelectorAll('#view-subject .subject-tabs').length"),1);
 // The ••• menu button draws its dots inside its own box.
 assert(await js("(()=>{const b=document.querySelector('#subjectTopics .dots'),r=b.getBoundingClientRect(),d=getComputedStyle(b,'::before');return b.scrollWidth<=b.clientWidth&&parseFloat(d.width)+14<r.width})()"),'dots fit inside the menu button');

 await js("document.querySelector('#view-subject [data-subject-tab=topics]').click()");
 await wait("document.querySelectorAll('#subjectTopics [data-topic-open]').length>0");
 assert.equal(await js("document.querySelector('#subjectSectionTitle').textContent"),'Topics');
 assert.equal(await js("document.querySelectorAll('#subjectTopics .quiz-card').length"),0);

 await js("document.querySelector('#view-subject [data-subject-tab=quizzes]').click()");
 await wait("document.querySelectorAll('#subjectTopics .quiz-card').length>0");
 assert.equal(await js("document.querySelector('#subjectSectionTitle').textContent"),'Quizzes');
 assert.equal(await js("document.querySelectorAll('#subjectTopics [data-topic-open],#subjectTopics [data-open-topic]').length"),0,'no topic study-mode cards on the Quizzes tab');
 assert(!(await js("/cards|Learn/.test(document.querySelector('#subjectTopics').textContent)")),'no flashcard or Learn content on the Quizzes tab');
 assert(await js("document.querySelector('#view-subject [data-subject-tab=quizzes]').classList.contains('active')"));
 const card="[...document.querySelectorAll('#subjectTopics .quiz-card')].find(c=>c.querySelector('h3').textContent==='Design Principles')";
 assert(await js(`${card}.textContent.includes('2 questions')`));

 // Clicking the card itself starts that quiz instead of opening the topic page.
 await js(`${card}.querySelector('h3').click()`);
 await wait("!!document.querySelector('#quizTypeChoice')");
 assert.equal(await js("currentView"),'subject');
 await js("document.querySelector('#beginChosenQuiz').click()");
 await wait("currentView==='quiz'");
 assert.equal(await js("state.currentTopic"),'Design Principles');

 // Timed starts a timed quiz from the same card; Manage opens the question manager.
 await js("openSubject(subjectForTopic('Design Principles').id);document.querySelector('#view-subject [data-subject-tab=quizzes]').click()");
 await wait("document.querySelectorAll('#subjectTopics .quiz-card').length>0");
 await js(`${card}.querySelector('[data-quiz-timed]').click()`);
 await wait("!!document.querySelector('#quizTypeChoice')");
 await js("document.querySelector('[data-close-modal]').click()");
 await js(`${card}.querySelector('[data-manage-quiz]').click()`);
 await wait("!!document.querySelector('.modal')");
 await js("document.querySelector('[data-close-modal]')?.click();showView('dashboard')");

 // A topic can hold more than one quiz: add one from the Quizzes tab and choose its topic.
 const key='Design Principles › Practice exam',K=JSON.stringify(key);
 await js("openSubject(subjectForTopic('Design Principles').id);document.querySelector('#view-subject [data-subject-tab=quizzes]').click()");
 await wait("!!document.querySelector('#subjectAddQuizBtn')");
 await js("document.querySelector('#subjectAddQuizBtn').click()");
 await wait("!!document.querySelector('#newQuizTopic')");
 assert(await js("[...document.querySelectorAll('#newQuizTopic option')].some(o=>o.value==='Design Principles')"));
 await js("const t=document.querySelector('#newQuizTopic');t.value='Design Principles';t.dispatchEvent(new Event('change'))");
 assert.equal(await js("document.querySelector('#newQuizName').value"),'Quiz 2');
 const pasted="Question: Which principle groups related items?\nAnswer choices:\nA. Proximity\nB. Noise\nAnswer: A\nExplain: Items placed close together read as a group.\n\nQuestion: Which principle repeats patterns?\nAnswer choices:\nA. Randomness\nB. Consistency\nAnswer: B\nExplain: Consistency repeats patterns users can learn.";
 await js(`document.querySelector('#newQuizName').value='Practice exam';document.querySelector('#newQuizQuestions').value=${JSON.stringify(pasted)};document.querySelector('#createQuizBtn').click()`);
 await wait(`!document.querySelector('.modal')&&state.topics[${K}]?.length===2`);
 assert.equal(await js(`state.topicMeta[${K}].parent`),'Design Principles');
 assert.equal(await js(`saveQueue.then(()=>fetch('/api/state')).then(r=>r.json()).then(d=>d.topicMeta[${K}]?.parent+'|'+d.topics[${K}]?.length)`),'Design Principles|2');
 assert.equal(await js("currentView"),'subject');
 assert(await js("document.querySelector('#view-subject [data-subject-tab=quizzes]').classList.contains('active')"),'stays on the Quizzes tab');
 const titles=await js("[...document.querySelectorAll('#subjectTopics .quiz-card h3')].map(h=>h.textContent)");
 assert(titles.includes('Quiz 1')&&titles.includes('Practice exam'),titles.join());
 assert.equal(await js(`state.subjects[subjectForTopic('Design Principles').id].topics.includes(${K})`),false,'a quiz is not a topic');

 // Each quiz keeps its own attempt and result.
 const firstResult=await js("JSON.stringify(state.latestResults['Design Principles'])");
 await js(`startQuiz(${K},false,true);submitAnswer('A');goNextQuestion();submitAnswer('A');goNextQuestion()`);
 await wait("currentView==='results'");
 assert.equal(await js("document.querySelector('#resultsTopic').textContent"),'Design Principles › Practice exam');
 assert.equal(await js(`state.latestResults[${K}].correct`),1);
 assert.equal(await js("JSON.stringify(state.latestResults['Design Principles'])"),firstResult);

 // The topic page lists both quizzes; rename and delete live in the quiz manager.
 await js("openTopic('Design Principles')");
 await wait("document.querySelectorAll('#topicModes .topic-quiz-list .quiz-card').length===2");
 assert(await js("document.querySelector('#topicSummary').textContent.includes('in 2 quizzes')"));
 await js(`window.__prompt=window.prompt;window.__confirm=window.confirm;window.prompt=()=>'Mock exam';window.confirm=()=>true;openQuestionManager(${K});document.querySelector('#managerRenameQuiz').click()`);
 assert.equal(await js(`quizTitle(${K})`),'Design Principles › Mock exam');
 await js(`openQuestionManager(${K});document.querySelector('#managerRemoveQuiz').click()`);
 await wait(`!state.topics[${K}]&&!document.querySelector('.modal')`);
 await js("window.prompt=window.__prompt;window.confirm=window.__confirm");
 assert.equal(await js("state.topics['Design Principles'].length"),2);
 assert.equal(await js("document.querySelectorAll('#topicModes .topic-quiz-list').length"),0);
 assert.equal(await js(`saveQueue.then(()=>fetch('/api/state')).then(r=>r.json()).then(d=>String(!!d.topics[${K}]))`),'false');
 await js("showView('dashboard')");
 console.log('PASS subject quizzes: subjects open on the Topics tab (no Overview tab), ••• fits its button, Topics tab unchanged, Quizzes tab lists quizzes only and starts them directly, extra quizzes per topic can be added, taken separately, renamed and deleted.');
};
