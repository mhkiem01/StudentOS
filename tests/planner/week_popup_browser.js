const assert=require('node:assert/strict');
module.exports=async function(js,call){
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
  await js(`(async()=>{
    const monday=StudentCalendar.monday(new Date()),key=StudentCalendar.key;
    for(const item of [{id:'popup-done',title:'Popup completed occurrence',due_at:key(monday)+'T10:00',series_id:'popup-series',completed:1,status:'done'},
      {id:'popup-future',title:'Popup future occurrence',due_at:key(StudentCalendar.addDays(monday,7))+'T10:00',series_id:'popup-series',completed:0,status:'no_progress'},
      {id:'popup-allday',title:'All day deadline',due_at:key(monday),completed:0,status:'in_progress'}]){
      const r=await fetch('/api/portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table:'reminders',item})});if(!r.ok)throw Error('Fixture reminder failed');
    }
  })()`);
  await js("window.weekTestOldPage=true");await call('Page.reload');
  for(let i=0;i<100;i++){if(await js("!window.weekTestOldPage && !!document.querySelector('#calendarViewWeek') && !!document.querySelector('.dash-timetable .dash-header-actions button:last-child')"))break;await new Promise(r=>setTimeout(r,100))}
  await js("document.querySelector('.dash-timetable .dash-header-actions button:last-child').click()");
  assert.equal(await js("document.querySelectorAll('.detailed-week-day').length"),7);
  assert.equal(await js("document.querySelectorAll('.detailed-week-times>div').length"),24);
  assert.equal(await js("document.body.style.overflow"),'hidden');
  assert(await js("document.querySelector('.detailed-week-scroll').scrollTop>0"));
  assert(await js("document.querySelector('.detailed-week').getBoundingClientRect().width>innerWidth*.9"));
  assert(await js("[...document.querySelectorAll('.detailed-week-event.completed b')].some(e=>e.textContent.includes('Popup completed'))"));
  assert(await js("[...document.querySelectorAll('.detailed-week-allday button')].some(e=>e.textContent.includes('All day deadline'))"));
  assert(await js("[...document.querySelectorAll('.detailed-week-event.timed')].some(e=>e.style.top==='608px'&&e.style.height==='128px')"));
  const first=await js("document.querySelector('.detailed-week-day').dataset.weekDate");
  await js("document.querySelector('[data-week-shift=\"1\"]').click()");
  assert.notEqual(await js("document.querySelector('.detailed-week-day').dataset.weekDate"),first);
  assert(await js("[...document.querySelectorAll('.detailed-week-event')].some(e=>e.textContent.includes('Popup future')&&!e.classList.contains('completed'))"));
  await js("document.querySelector('[data-week-shift=\"-1\"]').click()");
  assert.equal(await js("document.querySelector('.detailed-week-day').dataset.weekDate"),first);
  await js("document.querySelector('[data-week-today]').click();[...document.querySelectorAll('.detailed-week-event')].find(e=>e.textContent.includes('Popup completed')).click()");
  assert(await js("!!document.querySelector('.reminders-form')"));
  await js("document.querySelector('.reminders-form [name=status]').value='in_progress';document.querySelector('.reminders-form').requestSubmit()");
  for(let i=0;i<60;i++){
    if(await js("!document.querySelector('.reminders-form') && [...document.querySelectorAll('.detailed-week-event')].some(e=>e.textContent.includes('Popup completed')&&!e.classList.contains('completed')&&e.textContent.includes('In Progress'))"))break;
    await new Promise(r=>setTimeout(r,100));
  }
  assert(await js("[...document.querySelectorAll('.detailed-week-event')].some(e=>e.textContent.includes('Popup completed')&&!e.classList.contains('completed')&&e.textContent.includes('In Progress'))"));
  assert(await js("fetch('/api/portal').then(r=>r.json()).then(p=>p.reminders.find(r=>r.id==='popup-future').status==='no_progress')"));
  await js("[...document.querySelectorAll('.detailed-week-event')].find(e=>e.textContent.includes('Study session')).click();var weekEdit=document.querySelector('.calendar-form');weekEdit.elements.title.value='Popup edited class';weekEdit.elements.start_time.value='10:15';weekEdit.elements.end_time.value='11:45';weekEdit.requestSubmit()");
  for(let i=0;i<60;i++){if(await js("!document.querySelector('.calendar-form') && [...document.querySelectorAll('.detailed-week-event')].some(e=>e.textContent.includes('Popup edited class'))"))break;await new Promise(r=>setTimeout(r,100))}
  assert(await js("[...document.querySelectorAll('.detailed-week-event')].some(e=>e.textContent.includes('Popup edited class')&&e.style.top==='656px'&&e.style.height==='96px')"));
  assert(await js("fetch('/api/portal').then(r=>r.json()).then(p=>p.timetable_events.some(e=>e.title==='Popup edited class'&&e.start_time==='10:15'))"));
  await call('Page.captureScreenshot',{format:'png'}).then(r=>require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(),'portal-detailed-week.png'),Buffer.from(r.data,'base64')));
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await js("document.querySelector('.detailed-week-scroll').scrollWidth>document.querySelector('.detailed-week-scroll').clientWidth"));
  assert(await js("document.querySelector('.detailed-week').getBoundingClientRect().right<=innerWidth"));
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert.equal(await js("!!document.querySelector('.detailed-week-backdrop')"),false);
  assert.notEqual(await js("document.body.style.overflow"),'hidden');
  console.log('PASS weekly popup: real records, hours, dimensions, completed/all-day reminders, week navigation, shared editor and live status updates, mobile scrolling, Escape.');
};
