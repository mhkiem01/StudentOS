const assert=require('node:assert/strict');
module.exports=async function(js,call){
 await call('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
 assert.equal(await js("document.querySelectorAll('.nav [data-view=dashboard]').length"),0);
 assert(await js("getComputedStyle(document.querySelector('#menuToggle')).display!=='none'"));
 await js("document.querySelector('.nav [data-view=settings]').click();document.querySelector('.portal-home').click()");
 assert(await js("document.querySelector('#view-dashboard').classList.contains('active')"));
 const mainWidth=await js("document.querySelector('.main').getBoundingClientRect().width");
 await js("document.querySelector('#menuToggle').click()");
 assert(await js("document.body.classList.contains('sidebar-hidden')&&document.querySelector('.sidebar').inert&&document.querySelector('#menuToggle').getAttribute('aria-expanded')==='false'"));
 assert(await js("document.querySelector('.main').getBoundingClientRect().width")>mainWidth);
 await js("window.navigationBeforeReload=true");await call('Page.reload');
 for(let i=0;i<80;i++){if(await js("!window.navigationBeforeReload&&!!document.querySelector('.portal-home')&&!!document.body&&document.body.classList.contains('sidebar-hidden')"))break;await new Promise(r=>setTimeout(r,100))}
 assert(await js("document.body.classList.contains('sidebar-hidden')"));
 await js("document.querySelector('#menuToggle').click()");
 assert(await js("!document.body.classList.contains('sidebar-hidden')&&!document.querySelector('.sidebar').inert&&document.querySelector('#menuToggle').getAttribute('aria-expanded')==='true'"));
 await js("document.querySelector('.nav [data-view=settings]').click()");
 for(let i=0;i<80;i++){if(await js("!!document.querySelector('#gymEnabled')&&!document.querySelector('#gymEnabled').disabled"))break;await new Promise(r=>setTimeout(r,100))}
 await js("if(!document.querySelector('#gymEnabled').checked)document.querySelector('#gymEnabled').click()");
 for(let i=0;i<80;i++){if(await js("!!document.querySelector('#gymNav')&&!document.querySelector('#gymNav').hidden"))break;await new Promise(r=>setTimeout(r,100))}
 for(const width of [320,390,430,744]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  await new Promise(r=>setTimeout(r,100)); // Let the media-query drawer reset finish before opening it.
  await js("if(document.querySelector('#subjectsToggle').getAttribute('aria-expanded')!=='true')document.querySelector('#subjectsToggle').click();if(document.querySelector('#gymToggle').getAttribute('aria-expanded')!=='true')document.querySelector('#gymToggle').click();document.querySelector('#menuToggle').click()");
  await new Promise(r=>setTimeout(r,300));
  const layout=await js(`(()=>{const sidebar=document.querySelector('.sidebar'),nav=document.querySelector('.sidebar .nav');return {display:getComputedStyle(nav).display,direction:getComputedStyle(nav).flexDirection,width:sidebar.getBoundingClientRect().width,overflow:nav.scrollWidth>nav.clientWidth+1,close:getComputedStyle(document.querySelector('.mobile-nav-close')).display,rows:[...nav.children].filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}})}})()`);
  assert.equal(layout.display,'flex');assert.equal(layout.direction,'column');assert(!layout.overflow,'No sideways drawer overflow at '+width);assert(layout.width<=width-40);assert.notEqual(layout.close,'none');
  for(let i=1;i<layout.rows.length;i++)assert(layout.rows[i].top>=layout.rows[i-1].bottom-1,'Navigation sections must not overlap at '+width);
  assert(await js("getComputedStyle(document.body).overflow==='hidden'"));
  if(width===390){
   await js("document.body.classList.add('dark')");
   const shot=await call('Page.captureScreenshot',{format:'png'});require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(),'portal-mobile-navigation.png'),Buffer.from(shot.data,'base64'));
  }
  await js("document.querySelector('.mobile-nav-close').click()");
  assert(await js("!document.body.classList.contains('nav-open') && document.activeElement.id==='menuToggle' && document.querySelector('.sidebar').inert"));
  await js("document.querySelector('#menuToggle').click();document.querySelector('.nav [data-view=notes]').click()");assert(!await js("document.body.classList.contains('nav-open')"));
  assert(await js("document.documentElement.scrollWidth<=innerWidth"));
  await js("document.querySelector('.portal-home').click()");
  assert(await js("document.querySelector('#view-dashboard').classList.contains('active')"));
  assert(await js("(()=>{const logo=document.querySelector('.portal-home').getBoundingClientRect(),bell=document.querySelector('.notification-button').getBoundingClientRect();return logo.right<=bell.left&&logo.width>80})()"));
 }
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await js("document.querySelector('.portal-home').click()");
 const shot=await call('Page.captureScreenshot',{format:'png'});require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(),'portal-mobile-refresh.png'),Buffer.from(shot.data,'base64'));
 await js("document.querySelector('#menuToggle').click();document.querySelector('.nav-backdrop').click()");assert(!await js("document.body.classList.contains('nav-open')"));
 await js("document.querySelector('#menuToggle').click()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});assert(!await js("document.body.classList.contains('nav-open')"));
 console.log('PASS mobile navigation: 320/390/430/744px, expanded Subjects and Gym, vertical non-overlapping rows, scroll lock, close/focus, selection, backdrop and Escape.');
};
