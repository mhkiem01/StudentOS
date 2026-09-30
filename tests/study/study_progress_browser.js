const assert=require('node:assert/strict');
module.exports=async(js,call)=>{
 const wait=async q=>{for(let i=0;i<100;i++){if(await js(q))return;await new Promise(r=>setTimeout(r,100))}throw Error('Study UI timeout: '+q)};
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await wait("!!subjectForTopic('Design Principles')");
 await js("window.studyTestSubject=subjectForTopic('Design Principles').id;openSubject(studyTestSubject)");
 await wait("!!document.querySelector('#view-subject [data-subject-tab=progress]')");
 await js("document.querySelector('#view-subject [data-subject-tab=progress]').click()");
 await wait("!!document.querySelector('#subjectTopics .study-stats')");
 assert(await js("document.querySelector('#subjectTopics').textContent.includes('Recent Quiz Activity')"));
 await js("portalProgress.open(studyTestSubject,'Design Principles')");
 await wait("document.querySelectorAll('#topicModes .study-topic-card').length===1");
 assert(await js("document.querySelector('#topicModes').textContent.includes('Completed')"));
 await js("document.querySelector('#topicModes [data-study-result]').click()");
 assert(await js("document.querySelector('.study-result-dialog').open"));
 await js("document.querySelector('.study-result-dialog button').click();document.querySelector('#view-topic [data-study-tab=notes]').click()");
 await wait("document.querySelector('#portalNotes h1')?.textContent==='Design Principles Notes'");
 assert.equal(await js("document.querySelectorAll('#notebookCards [data-open-note]').length"),0);
 await js("document.querySelector('[data-new-note]').click()");
 assert.equal(await js("document.querySelector('#notebookTopic').value"),'Design Principles');
 await js("document.querySelector('#notebookTopic').value='';document.querySelector('#notebookTitle').value='Organised topic note';document.querySelector('#notebookDocument').textContent='Keep this draft';document.querySelector('#notebookDocument').dispatchEvent(new Event('input'));document.querySelector('[data-action=save]').click()");
 await wait("document.querySelector('#notebookStatus').textContent.includes('Topic or Week')");
 assert.equal(await js("document.querySelector('#notebookDocument').textContent"),'Keep this draft');
 await js("document.querySelector('#notebookTopic').value='Design Principles';document.querySelector('[data-action=save]').click()");
 await wait("document.querySelector('#notebookStatus').textContent==='Saved'");
 await js("document.querySelector('[data-action=close]').click()");
 await wait("!document.querySelector('.notebook-editor')");
 assert.equal(await js("document.querySelectorAll('#notebookCards [data-open-note]').length"),1);
 await js("document.querySelector('#portalNotes [data-subject-tab=progress]').click()");
 await wait("document.querySelector('#topicModes .study-metrics')?.textContent.includes('1Notes')");
 for(const dark of [false,true]){
  await js(`document.body.classList.toggle('dark',${dark})`);
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await js("document.documentElement.scrollWidth<=innerWidth"));
 }
 console.log('PASS scoped study workspace: subject/topic tabs, saved results, topic notes isolation, metadata guidance, draft preservation, live note counts, light/dark mobile.');
};
