const assert=require('node:assert/strict');
// Voice Tutor page: choose subject/topic/mode, then run Quiz, Oral practice and Ask sessions.
// Speech is stubbed (instant) and the AI endpoints are faked, so this is fast and uses no quota.
// Relies on the note study_progress_browser.js saves in Design Principles (practice needs notes).
module.exports=async(js,call)=>{
 const wait=async q=>{for(let i=0;i<100;i++){try{if(await js(q))return}catch{/* page may still be reloading */}await new Promise(r=>setTimeout(r,100))}throw Error('Voice tutor timeout: '+q)};
 const type=text=>js(`(()=>{const f=document.querySelector('#view-voice [data-type]');f.querySelector('input').value=${JSON.stringify(text)};f.requestSubmit()})()`);
 const logText="document.querySelector('#view-voice [data-log]').textContent";
 await js(`(()=>{
   window.voiceTestRestore={fetch:window.fetch,speak:speechSynthesis.speak.bind(speechSynthesis)};
   speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),0);
   window.voiceTestCalls=[];
   const replies={
     '/api/ai/voice/practice/question':{question:'What is cohesion?',answer:'How closely related a module’s parts are.',key_points:['related parts'],chunk:'vt1#1',source:'Voice test note',excerpt:'Cohesion is how closely related a module’s parts are.',asked_by:'test · fake'},
     '/api/ai/voice/practice/grade':{verdict:'partial',feedback:'You missed that the parts are related.',answer:'How closely related a module’s parts are.',graded_by:'test · fake'},
     '/api/ai/voice/ask':{answer:'Cohesion means a module’s parts belong together.',code:'',in_notes:true,sources:['Voice test note'],verified:true,answered_by:'test · fake',checked_by:'test · checker'}};
   window.fetch=(url,init)=>{if(replies[url]){voiceTestCalls.push({url,body:JSON.parse(init.body)});return Promise.resolve(new Response(JSON.stringify(replies[url]),{headers:{'Content-Type':'application/json'}}))}return voiceTestRestore.fetch(url,init)};
   const subject=subjectForTopic('Design Principles');
   window.voiceTestSubject=subject.id;
 })()`);
 try{
  // Setup: subject, topic and mode, with counts for what each mode can use.
  await js("showView('voice')");
  await wait("!document.querySelector('#view-voice [data-setup]').hidden");
  await js("(()=>{const s=document.querySelector('#view-voice [data-subject]');s.value=voiceTestSubject;s.dispatchEvent(new Event('change'))})()");
  await js("(()=>{const t=document.querySelector('#view-voice [data-topic]');t.value='Design Principles';t.dispatchEvent(new Event('change'))})()");
  assert.equal(await js("document.querySelectorAll('#view-voice [data-mode]').length"),3);
  assert(await js("document.querySelector('#view-voice [data-mode=quiz]').textContent.includes('2 questions')"));

  // Quiz me: saved questions, answered by letter, graded exactly.
  await js("document.querySelector('#view-voice [data-mode=quiz]').click();document.querySelector('#view-voice [data-begin]').click()");
  await wait("!!document.querySelector('#view-voice .voice-card-question')");
  assert(await js("document.querySelector('#view-voice [data-title]').textContent.includes('Design Principles · Quiz me')"));
  const visible=sel=>js(`getComputedStyle(document.querySelector('#view-voice ${sel}')).display!=='none'`);
  assert.deepEqual([await visible('[data-setup]'),await visible('[data-session]')],[false,true],'only the session is visible during a session');
  const answer=await js("(()=>{const text=document.querySelector('#view-voice .voice-card-question').textContent;return state.topics['Design Principles'].find(q=>q.question===text).answer})()");
  await type(answer);
  await wait(`${logText}.includes('Correct!')`);
  await wait("document.querySelector('#view-voice [data-score]').textContent.includes('Score 1/1')");
  await type('end session');
  await wait("!document.querySelector('#view-voice [data-setup]').hidden");
  assert(await js("document.querySelector('#view-voice [data-summary]').textContent.includes('You got 1 out of 1')"));
  assert.deepEqual([await visible('[data-setup]'),await visible('[data-session]'),await visible('[data-summary]')],[true,false,true],'only setup and its summary are visible after a session');

  // Oral practice: the AI asks, a typed answer is marked partly right.
  await js("document.querySelector('#view-voice [data-mode=practice]').click();document.querySelector('#view-voice [data-begin]').click()");
  await wait("document.querySelector('#view-voice .voice-card-question')?.textContent==='What is cohesion?'");
  const asked=await js("voiceTestCalls.find(c=>c.url.endsWith('/question')).body");
  assert.deepEqual([asked.subject_id,asked.topic],[await js('voiceTestSubject'),'Design Principles']);
  await type('it is about modules');
  await wait("document.querySelector('#view-voice .voice-verdict')?.textContent.includes('Partly right')||voiceTestCalls.filter(c=>c.url.endsWith('/question')).length>1");
  const graded=await js("voiceTestCalls.find(c=>c.url.endsWith('/grade')).body");
  assert.equal(graded.answer,'it is about modules');
  assert.equal(graded.question.chunk,'vt1#1');
  await wait(`${logText}.includes('Partly right. You missed that the parts are related.')`);
  assert(await js("document.querySelector('#view-voice [data-score]').textContent.includes('½ 1')"));
  await wait("voiceTestCalls.filter(c=>c.url.endsWith('/question')).length===2");  // moves on to the next question
  assert.deepEqual(await js("voiceTestCalls.filter(c=>c.url.endsWith('/question'))[1].body.used"),['vt1#1']);
  await js("document.querySelector('#view-voice [data-end]').click()");
  await wait("document.querySelector('#view-voice [data-summary]').textContent.includes('1 partly right')");

  // Ask me: answers from the chosen topic's notes, with who answered and checked.
  await js("document.querySelector('#view-voice [data-mode=ask]').click();document.querySelector('#view-voice [data-begin]').click()");
  await wait("!document.querySelector('#view-voice [data-session]').hidden");
  await type('what is cohesion?');
  await wait(`${logText}.includes('Cohesion means')`);
  assert(await js(`${logText}.includes('checked by test · checker')`));
  assert.equal(await js("voiceTestCalls.find(c=>c.url.endsWith('/ask')).body.topic"),'Design Principles');
  await js("document.querySelector('#view-voice [data-end]').click()");
  await wait("!document.querySelector('#view-voice [data-setup]').hidden");
 }finally{
  await js("window.fetch=voiceTestRestore.fetch;speechSynthesis.speak=voiceTestRestore.speak;showView('dashboard')");
 }
 console.log('PASS voice tutor: subject/topic/mode setup, quiz graded by letter, oral practice asked and marked, ask answered from the chosen topic.');
};
