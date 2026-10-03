const assert=require('node:assert/strict');
// One feature script failing to load (e.g. an outdated server that cannot serve it)
// must not stop the other modules from starting: their Settings toggles stay usable.
module.exports=async(js,call)=>{
 const wait=async q=>{for(let i=0;i<100;i++){try{if(await js(q))return}catch{/* page may still be reloading */}await new Promise(r=>setTimeout(r,100))}throw Error('Startup resilience timeout: '+q)};
 const base=await js('location.origin');
 await call('Network.enable');
 await call('Network.setBlockedURLs',{urls:['*voice-tutor.js*']});
 try{
  await call('Page.navigate',{url:base+'/?reload=blocked-voice'});
  await wait("typeof showView==='function'&&document.querySelectorAll('.week-hour').length===24");
  assert.equal(await js("typeof StudentVoiceTutor"),'undefined','the voice script really was blocked');
  await js("showView('settings')");
  await wait("!!document.querySelector('#gymEnabled')&&!document.querySelector('#gymEnabled').disabled");
  await wait("!!document.querySelector('#generalTodosEnabled')&&!document.querySelector('#generalTodosEnabled').disabled");
  await wait("!!document.querySelector('#financeEnabled')&&!document.querySelector('#financeEnabled').disabled");
  await js("showView('voice')");  // the broken feature's page must not crash navigation
  assert.equal(await js("currentView"),'voice');
 }finally{
  await call('Network.setBlockedURLs',{urls:[]});
  await call('Page.navigate',{url:base+'/?reload=restored'});
  await wait("typeof StudentVoiceTutor==='object'&&document.querySelectorAll('.week-hour').length===24");
 }
 console.log('PASS startup resilience: a missing feature script leaves Gym, General To-Do and Finance settings usable.');
};
