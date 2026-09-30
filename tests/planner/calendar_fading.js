// Real-browser checks, mounted independently so no user/fixture records are changed.
const assert = require('node:assert/strict');
module.exports = async function testCalendarFading(js) {
  await js(`(() => {
    const {key,addDays} = StudentCalendar, today = new Date();
    const host = document.createElement('div');
    host.id = 'calendarFadeTest'; document.body.append(host);
    const events = [-7,0,7].map(offset => ({id:'fade-'+offset,title:'Test class',
      event_date:key(addDays(today,offset)),recurrence:'none',start_time:'09:00',end_time:'10:00'}));
    events.push({id:'fade-weekly',title:'Recurring class',day:(today.getDay()+6)%7,
      recurrence:'weekly',start_time:'11:00',end_time:'12:00'});
    const reminders = [-7,0,7].map(offset => ({kind:'reminder',reminder_id:'rem-'+offset,
      title:'Test reminder',event_date:key(addDays(today,offset)),recurrence:'none',start_time:'17:00'}));
    window.fadeReminderClicked = false;
    StudentCalendar.create({container:host.id,events:()=>events,reminders:()=>reminders,
      subjects:()=>[],openReminder:()=>{window.fadeReminderClicked=true}}).render();
  })()`);
  for (const view of ['month','week','day']) {
    await js(`document.querySelector('#calendarFadeTest [data-calendar-view="${view}"]').click()`);
    for (const offset of [-7,0,7]) {
      await js(`(() => {const input=document.querySelector('#calendarFadeTest #calendarJump');
        input.value=StudentCalendar.key(StudentCalendar.addDays(new Date(),${offset}));
        input.dispatchEvent(new Event('change'));})()`);
      const result = await js(`(() => {
        const host=document.querySelector('#calendarFadeTest');
        const event=host.querySelector('[data-calendar-event="fade-${offset}"]');
        const reminder=host.querySelector('[data-calendar-reminder="rem-${offset}"]');
        const weekly=host.querySelector('[data-calendar-event="fade-weekly"][data-occurrence="'+StudentCalendar.key(StudentCalendar.addDays(new Date(),${offset}))+'"]');
        return [event,reminder,weekly].map(el=>({past:el.classList.contains('calendar-event-past'),
          opacity:Number(getComputedStyle(el).opacity),disabled:el.disabled}));
      })()`);
      for (const item of result) {
        assert.equal(item.past,offset<0,view+' occurrence classification');
        assert.equal(item.opacity,offset<0 ? .58 : 1,view+' visual fading');
        assert.equal(item.disabled,false);
      }
    }
  }
  await js(`document.querySelector('#calendarFadeTest #calendarPrevious').click();
    document.querySelector('#calendarFadeTest #calendarJump').value=StudentCalendar.key(StudentCalendar.addDays(new Date(),-7));
    document.querySelector('#calendarFadeTest #calendarJump').dispatchEvent(new Event('change'));
    document.querySelector('#calendarFadeTest [data-calendar-reminder]').click()`);
  assert.equal(await js('window.fadeReminderClicked'),true,'Past reminders remain clickable');
  await js(`document.querySelector('#calendarFadeTest [data-calendar-event]').click()`);
  assert.equal(await js("!!document.querySelector('.calendar-form')"),true,'Past classes remain editable');
  await js("document.querySelector('.calendar-form [data-cancel]').click()");
  const wasDark = await js("document.body.classList.contains('dark')");
  for (const dark of [false,true]) {
    await js(`document.body.classList.toggle('dark',${dark})`);
    for (const view of ['month','week']) {
      await js(`document.querySelector('#calendarFadeTest [data-calendar-view="${view}"]').click();document.querySelector('#calendarFadeTest #calendarToday').click()`);
      // A week starting on Monday may contain no past date, so visit last week too.
      for (const previous of [false,true]) {
        if(previous) await js("document.querySelector('#calendarFadeTest #calendarPrevious').click()");
        const cells = await js(`Array.from(document.querySelectorAll('#calendarFadeTest .calendar-day')).map(el=>({
          past:el.classList.contains('is-past'),background:getComputedStyle(el).backgroundColor}))`);
        const grey = dark ? 'rgb(23, 28, 39)' : 'rgb(240, 241, 244)';
        for(const cell of cells) assert.equal(cell.background===grey,cell.past,'Only past cells get the neutral background, including empty/outside-month dates');
        if(previous) assert(cells.some(cell=>cell.past));
      }
    }
  }
  await js(`document.body.classList.toggle('dark',${wasDark});document.querySelector('#calendarFadeTest').remove()`);
  console.log('PASS calendar backgrounds: light grey/dark charcoal past cells; today/future preserved in month/week.');
  console.log('PASS calendar fading: past/today/future classes, weekly occurrences and reminders in month/week/day; editing preserved.');
};
