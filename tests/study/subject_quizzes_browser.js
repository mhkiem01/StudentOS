const assert=require('node:assert/strict');
// Subject page: the Topics tab keeps full topic cards; the Quizzes tab lists quizzes only.
module.exports=async(js,call)=>{
 const wait=async q=>{for(let i=0;i<100;i++){try{if(await js(q))return}catch{/* page may still be reloading */}await new Promise(r=>setTimeout(r,100))}throw Error('Subject quizzes timeout: '+q)};
 await js("showView('dashboard');openSubject(subjectForTopic('Design Principles').id)");
 await wait("!!document.querySelector('#view-subject [data-subject-tab=quizzes]')");

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
 console.log('PASS subject quizzes: Topics tab unchanged, Quizzes tab lists quizzes only and starts them directly.');
};
