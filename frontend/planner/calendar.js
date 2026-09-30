/* Local calendar dates deliberately avoid UTC conversion and DST arithmetic. */
(function (global) {
  'use strict';
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const key = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const date = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d,12); };
  const addDays = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n,12);
  const monday = d => addDays(d,-((d.getDay()+6)%7));
  // Compare local calendar dates, not event series start dates or UTC timestamps.
  const isPastDate = (day, now = new Date()) => key(day) < key(now);
  function occurs(event, day) {
    const value = key(day), start = event.event_date;
    const recurrence = event.recurrence || (start ? 'none' : 'weekly');
    if (recurrence === 'none') return value === start;
    return (!start || value >= start) && (!event.repeat_until || value <= event.repeat_until)
      && Number(event.day) === (day.getDay()+6)%7;
  }
  const eventsOn = (events,day) => events.filter(e=>occurs(e,day)).sort((a,b)=>a.start_time.localeCompare(b.start_time)||a.title.localeCompare(b.title));
  const escape = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const color = c => /^#[0-9a-f]{6}$/i.test(c||'') ? c : '#6d4df4';
  const uid = () => 'cal_'+(global.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2));
  const label = d => d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  function create(options) {
    let anchor = date(key(new Date())), view = 'month', notice = '';
    const container = document.getElementById(options.container);
    const modalRoot = document.getElementById('modalRoot');
    const getEvents = () => [...options.events(),...(options.reminders?.()||[])];
    const weekPopup = global.StudentWeekPopup?.create({events:getEvents,edit:(event,occurrence)=>event.kind==='reminder'?options.openReminder?.(event.reminder_id):edit(event,occurrence)});
    async function api(path,payload) {
      const response = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result = await response.json();
      if (!response.ok || result.ok === false) throw Error(result.error || 'Could not save your calendar.');
      return result;
    }
    async function refresh(message) {
      notice=message;
      await options.refresh();
    }
    const eventMarkup = (event,day) => {
      if(event.kind==='reminder')return `<button class="calendar-event calendar-reminder ${event.completed?'reminder-completed':''}" style="--event-color:#e34859" data-calendar-reminder="${escape(event.reminder_id)}" title="Edit reminder: ${escape(event.title)}"><span>${event.start_time?escape(event.start_time):'All day'} · Reminder</span><b>${event.completed?'✓ ':''}${escape(event.title)}</b>${event.series_id?'<small>↻ Weekly occurrence</small>':''}</button>`;
      return `<button class="calendar-event" style="--event-color:${color(event.color)}" data-calendar-event="${escape(event.id)}" data-occurrence="${key(day)}" title="${escape(event.title+' · '+event.start_time+'–'+event.end_time+(event.location?' · '+event.location:''))}"><span>${escape(event.start_time)}–${escape(event.end_time)}</span><b>${escape(event.title)}</b>${event.location?`<small>${escape(event.location)}</small>`:''}${event.recurrence==='weekly'?'<small>↻ Weekly</small>':''}</button>`;
    };
    const eventButton = (event,day) => {
      const markup = eventMarkup(event,day);
      return isPastDate(day)
        ? markup.replace('class="calendar-event', 'class="calendar-event calendar-event-past').replace('title="', 'title="Past date · ')
        : markup;
    };
    function dayCell(day, isMonth) {
      const today=key(day)===key(new Date()), outside=day.getMonth()!==anchor.getMonth();
      return `<section class="calendar-day ${today?'is-today':''} ${isMonth&&outside?'outside-month':''}"><button class="calendar-date" data-calendar-add="${key(day)}" aria-label="Add event on ${escape(label(day))}">${isMonth?day.getDate():escape(day.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}))}<span>＋</span></button><div class="calendar-day-events">${eventsOn(getEvents(),day).map(e=>eventButton(e,day)).join('')}</div></section>`;
    }
    function render() {
      const monthTitle=anchor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
      const start=monday(anchor), end=addDays(start,6);
      const title=view==='month'?monthTitle:view==='week'?`${start.toLocaleDateString(undefined,{day:'numeric',month:'short'})} – ${end.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}`:label(anchor);
      let body;
      if(view==='month') {
        const first=new Date(anchor.getFullYear(),anchor.getMonth(),1,12);
        const gridStart=monday(first);
        body=`<div class="calendar-scroll"><div class="calendar-month"><div class="calendar-weekdays">${weekdays.map(d=>`<div>${d}</div>`).join('')}</div><div class="calendar-month-grid">${Array.from({length:42},(_,i)=>dayCell(addDays(gridStart,i),true)).join('')}</div></div></div>`;
      } else if(view==='week') {
        body=`<div class="calendar-scroll"><div class="calendar-week">${Array.from({length:7},(_,i)=>dayCell(addDays(start,i),false)).join('')}</div></div>`;
      } else {
        body=`<div class="calendar-agenda">${eventsOn(getEvents(),anchor).map(e=>eventButton(e,anchor)).join('')||'<div class="empty"><h3>No events on this date</h3><p>Add a class, study session, or appointment.</p></div>'}</div>`;
      }
      container.innerHTML=`<div class="section-head"><div><h2>Calendar</h2><p class="muted">Plan classes and study sessions for any date.</p></div><div class="portal-actions"><label class="btn secondary">Import photo<input id="calendarPhoto" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="btn primary" id="calendarNew">＋ Add event</button></div></div><div class="calendar-toolbar"><div class="calendar-navigation"><button class="btn secondary small" id="calendarPrevious" aria-label="Previous ${view}">←</button><button class="btn secondary small" id="calendarToday">Today</button><button class="btn secondary small" id="calendarNext" aria-label="Next ${view}">→</button><h3 aria-live="polite">${escape(title)}</h3></div><div class="calendar-controls"><label>Go to date <input type="date" id="calendarJump" value="${key(anchor)}"></label><div class="calendar-views" aria-label="Calendar view">${['month','week','day'].map(v=>`<button type="button" data-calendar-view="${v}" aria-pressed="${view===v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div></div></div>${notice?`<p class="message success" role="status">${escape(notice)}</p>`:''}${body}<p class="muted calendar-hint">Click a date to add an event. Click an event to edit it. Repeating events are marked ↻.</p>`;
      const change = amount => {
        anchor=view==='month'?new Date(anchor.getFullYear(),anchor.getMonth()+amount,1,12):addDays(anchor,amount*(view==='week'?7:1));
        notice='';render();
      };
      container.querySelector('#calendarPrevious').onclick=()=>change(-1);
      if(weekPopup){
        const button=document.createElement('button');button.className='btn secondary';button.id='calendarViewWeek';button.textContent='▦ View Week';button.onclick=()=>weekPopup.open();container.querySelector('.portal-actions').prepend(button);
        weekPopup.render();
      }
      container.querySelectorAll('[data-calendar-add]').forEach(button=>{
        const past = isPastDate(date(button.dataset.calendarAdd));
        button.closest('.calendar-day').classList.toggle('is-past',past);
        if(past) button.setAttribute('aria-label',button.getAttribute('aria-label')+' (past date)');
      });
      container.querySelector('.calendar-hint').append(' Past dates are faded; you can still edit their entries.');
      container.insertAdjacentHTML('beforeend','<p class="calendar-legend"><span class="calendar-reminder-dot"></span> Red = reminders · Click to edit or complete. Completed reminders stay visible with a tick.</p>');
      container.querySelectorAll('[data-calendar-reminder]').forEach(b=>b.onclick=()=>options.openReminder?.(b.dataset.calendarReminder));
      container.querySelector('#calendarNext').onclick=()=>change(1);
      container.querySelector('#calendarToday').onclick=()=>{anchor=date(key(new Date()));notice='';render()};
      container.querySelector('#calendarJump').onchange=ev=>{if(ev.target.value){anchor=date(ev.target.value);notice='';render()}};
      container.querySelector('#calendarNew').onclick=()=>edit({},key(anchor));
      container.querySelector('#calendarPhoto').onchange=ev=>options.importPhoto(ev.target.files[0]);
      container.querySelectorAll('[data-calendar-view]').forEach(b=>b.onclick=()=>{view=b.dataset.calendarView;render()});
      container.querySelectorAll('[data-calendar-add]').forEach(b=>b.onclick=()=>edit({},b.dataset.calendarAdd));
      container.querySelectorAll('[data-calendar-event]').forEach(b=>b.onclick=()=>edit(getEvents().find(e=>e.id===b.dataset.calendarEvent),b.dataset.occurrence));
    }
    function modal(title,body) {
      modalRoot.innerHTML=`<div class="modal-backdrop"><form class="modal wide calendar-form" role="dialog" aria-modal="true" aria-label="${escape(title)}"><div class="modal-head"><h2>${escape(title)}</h2><button type="button" class="modal-close" aria-label="Close">×</button></div>${body}<p class="calendar-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn primary">Save</button></div></form></div>`;
      const form=modalRoot.querySelector('form'),previous=document.activeElement;
      function close(){modalRoot.innerHTML='';previous?.focus()}
      form.querySelector('.modal-close').onclick=close;
      form.querySelector('[data-cancel]').onclick=close;
      form.addEventListener('keydown',ev=>{
        if(ev.key==='Escape'&&!form.querySelector('[type=submit]').disabled){ev.preventDefault();ev.stopPropagation();close()}
        if(ev.key==='Tab'){
          const fields=[...form.querySelectorAll('button,input,select,textarea')].filter(e=>!e.disabled&&e.offsetParent!==null);
          if(ev.shiftKey&&document.activeElement===fields[0]){ev.preventDefault();fields.at(-1)?.focus()}
          else if(!ev.shiftKey&&document.activeElement===fields.at(-1)){ev.preventDefault();fields[0]?.focus()}
        }
      });
      return {form,close};
    }
    function edit(event={},occurrence=key(anchor)) {
      const repeating=(event.recurrence||'weekly')==='weekly'&&!!event.id;
      const initialDate=event.event_date||occurrence;
      const subjects=options.subjects();
      const eventColours=[['Purple','#6d4df4'],['Blue','#3b82f6'],['Teal','#14b8a6'],['Green','#22c55e'],['Yellow','#eab308'],['Orange','#f97316'],['Pink','#ec4899'],['Red','#ef4444'],['Grey','#64748b']];
      const {form,close}=modal(event.id?'Edit event':'New event',`
        ${repeating?'<p class="message warning">Changes apply to the entire weekly series.</p>':''}
        <div class="calendar-form-grid">
        <label class="form-row">Event name<input name="title" required maxlength="300" value="${escape(event.title)}"></label>
        <label class="form-row">Subject<select name="subject_id"><option value="">No subject</option>${subjects.map(s=>`<option value="${escape(s.id)}" ${event.subject_id===s.id?'selected':''}>${escape(s.name)}</option>`).join('')}</select></label>
        <label class="form-row">${repeating?'First date of series':'Date'}<input name="event_date" type="date" required value="${initialDate}"></label>
        <label class="form-row">Repeat<select name="recurrence"><option value="none">Does not repeat</option><option value="weekly" ${repeating?'selected':''}>Every week</option></select></label>
        <label class="form-row">Start time<input name="start_time" type="time" required value="${escape(event.start_time||'09:00')}"></label>
        <label class="form-row">End time<input name="end_time" type="time" required value="${escape(event.end_time||'10:00')}"></label>
        <label class="form-row" data-repeat-end>Repeat until (optional)<input name="repeat_until" type="date" value="${event.repeat_until||''}"><small>Leave empty to repeat indefinitely.</small></label>
        <label class="form-row">Location<input name="location" value="${escape(event.location)}"></label>
        <label class="form-row">Event type<select name="event_type">${['Lecture','Tutorial','Lab','Study','Meeting','Other'].map(t=>`<option ${event.event_type===t||!event.event_type&&t==='Other'?'selected':''}>${t}</option>`).join('')}</select></label>
        <fieldset class="calendar-colour-field"><legend>Colour</legend><div class="calendar-colour-swatches" role="group" aria-label="Event colours">${eventColours.map(([name,value])=>`<button type="button" class="calendar-colour-swatch" data-event-colour="${value}" style="--swatch:${value}" aria-label="${name}" aria-pressed="false" title="${name}"><span aria-hidden="true"></span></button>`).join('')}</div><small data-colour-label aria-live="polite"></small><details class="calendar-custom-colour"><summary>Custom colour (optional)</summary><label>Choose any colour<input name="color" type="color" value="${color(event.color||subjects.find(s=>s.id===event.subject_id)?.color)}"></label></details></fieldset>
        </div>${event.id?`<div class="portal-actions"><button type="button" class="btn danger small" data-delete>${repeating?'Delete entire series':'Delete event'}</button><button type="button" class="btn secondary small" data-duplicate>Duplicate</button></div>`:''}`);
      const fields=form.elements;
      const repeatChange=()=>{form.querySelector('[data-repeat-end]').hidden=fields.recurrence.value!=='weekly';fields.repeat_until.min=fields.event_date.value};
      fields.recurrence.onchange=repeatChange;fields.event_date.onchange=repeatChange;repeatChange();
      let customColor=!!event.color;
      const updateColour=()=>{const selected=fields.color.value.toLowerCase();form.querySelectorAll('[data-event-colour]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventColour===selected)));const match=eventColours.find(([,value])=>value===selected);form.querySelector('[data-colour-label]').textContent=match?match[0]+' selected':'Custom colour selected';};
      fields.color.oninput=()=>{customColor=true;updateColour()};
      form.querySelectorAll('[data-event-colour]').forEach(b=>b.onclick=()=>{fields.color.value=b.dataset.eventColour;customColor=true;updateColour()});
      fields.subject_id.onchange=()=>{if(!customColor){fields.color.value=color(subjects.find(s=>s.id===fields.subject_id.value)?.color);updateColour()}};
      updateColour();
      form.querySelector('[data-duplicate]')?.addEventListener('click',()=>edit({...event,id:null,title:event.title+' (copy)',event_date:occurrence},occurrence));
      form.querySelector('[data-delete]')?.addEventListener('click',async()=>{
        if(!confirm(repeating?'Delete this entire recurring series?':'Delete this event?'))return;
        try{await api('/api/portal/delete',{table:'timetable_events',id:event.id});close();await refresh('Event deleted.')}catch(err){form.querySelector('[role=alert]').textContent=err.message}
      });
      form.onsubmit=async ev=>{
        ev.preventDefault();
        const item={...event,...Object.fromEntries(new FormData(form)),id:event.id||uid()};
        if(item.end_time<=item.start_time){form.querySelector('[role=alert]').textContent='End time must be later than start time.';return}
        if(item.recurrence==='none')item.repeat_until=null;
        // Preserve the unbounded history of legacy weekday-only series unless the user chooses a first date.
        if(repeating&&!event.event_date&&item.event_date===initialDate&&item.recurrence==='weekly')item.event_date=null;
        item.day=item.event_date?(date(item.event_date).getDay()+6)%7:Number(event.day);
        const submit=form.querySelector('[type=submit]');submit.disabled=true;
        try{await api('/api/portal',{table:'timetable_events',item});anchor=date(item.event_date||occurrence);close();await refresh('Event saved.')}catch(err){form.querySelector('[role=alert]').textContent=err.message;submit.disabled=false}
      };
      fields.title.focus();
    }
    function importEvents(events) {
      if(!events.length)return Promise.resolve(false);
      const draftIds=events.map(()=>uid());
      return new Promise(resolve=>{
        const {form,close}=modal('Review timetable dates',`<p>Choose the first week and when classes stop repeating. Check each date and time before saving.</p><div class="calendar-form-grid"><label class="form-row">Week containing<input id="importWeek" type="date" required value="${key(anchor)}"></label><label class="form-row">Repeat<select id="importRepeat"><option value="weekly">Every week</option><option value="none">This date only</option></select></label><label class="form-row">Repeat until (optional)<input id="importUntil" type="date"></label></div><div class="calendar-import-rows">${events.map((e,i)=>`<fieldset data-import-row="${i}"><legend>Event ${i+1}${e.confidence==='low'?' — check uncertain details':''}</legend><div class="calendar-form-grid"><label class="form-row">Name<input data-field="title" required value="${escape(e.title||e.subject)}"></label><label class="form-row">Date<input data-field="event_date" type="date" required></label><label class="form-row">Start<input data-field="start_time" type="time" required value="${escape(e.start_time)}"></label><label class="form-row">End<input data-field="end_time" type="time" required value="${escape(e.end_time)}"></label><label class="form-row">Location<input data-field="location" value="${escape(e.location)}"></label></div></fieldset>`).join('')}</div>`);
        form.querySelectorAll('[data-import-row]').forEach((row,i)=>{
          const event=events[i],repeat=event.recurrence||(event.event_date?'none':'weekly');
          row.querySelector('.calendar-form-grid').insertAdjacentHTML('beforeend',`<label class="form-row">Repeat this event<select data-field="recurrence"><option value="none" ${repeat==='none'?'selected':''}>This date only</option><option value="weekly" ${repeat==='weekly'?'selected':''}>Every week</option></select></label><label class="form-row">Repeat until (optional)<input data-field="repeat_until" type="date" value="${escape(event.repeat_until||'')}" ${repeat==='none'?'disabled':''}></label>`);
          row.querySelector('[data-field=recurrence]').onchange=()=>{row.querySelector('[data-field=repeat_until]').disabled=row.querySelector('[data-field=recurrence]').value==='none'};
        });
        const assignDates=()=>{
          const start=monday(date(form.querySelector('#importWeek').value));
          form.querySelectorAll('[data-import-row]').forEach((row,i)=>{
            const day=Number(events[i].day);
            row.querySelector('[data-field=event_date]').value=events[i].event_date||((Number.isInteger(day)&&day>=0&&day<=6)?key(addDays(start,day)):'');
          });
        };
        if(events.every(e=>e.event_date)&&!events.some(e=>e.recurrence==='weekly'))form.querySelector('#importRepeat').value='none';
        const until=events.find(e=>e.repeat_until)?.repeat_until;
        if(until)form.querySelector('#importUntil').value=until;
        assignDates();form.querySelector('#importWeek').onchange=assignDates;
        form.querySelector('#importRepeat').onchange=()=>{const value=form.querySelector('#importRepeat').value;form.querySelector('#importUntil').disabled=value==='none';form.querySelectorAll('[data-field=recurrence]').forEach(el=>{el.value=value;el.onchange()})};
        form.querySelector('#importUntil').onchange=()=>form.querySelectorAll('[data-field=repeat_until]').forEach(el=>el.value=form.querySelector('#importUntil').value);
        form.querySelectorAll('.modal-close,[data-cancel]').forEach(b=>b.onclick=()=>{close();resolve(false)});
        form.addEventListener('keydown',ev=>{if(ev.key==='Escape')resolve(false)});
        form.onsubmit=async ev=>{
          ev.preventDefault();
          const recurrence=form.querySelector('#importRepeat').value;
          const items=[...form.querySelectorAll('[data-import-row]')].map((row,i)=>{
            const subject=options.subjects().find(s=>s.name.toLowerCase()===String(events[i].subject||'').toLowerCase());
            return {id:draftIds[i],subject_id:subject?.id||null,color:color(subject?.color),event_type:events[i].event_type||'Other',recurrence,repeat_until:recurrence==='weekly'?form.querySelector('#importUntil').value:null,...Object.fromEntries([...row.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el.value]))};
          });
          const submit=form.querySelector('[type=submit]');submit.disabled=true;
          try{await api('/api/calendar/import',{events:items});anchor=date(items[0].event_date);close();await refresh(`${items.length} calendar events imported.`);resolve(true)}catch(err){form.querySelector('[role=alert]').textContent=err.message;submit.disabled=false}
        };
      });
    }
    return {render,edit,importEvents,openWeek:()=>weekPopup?.open()};
  }
  global.StudentCalendar = {create,key,date,addDays,monday,occurs,eventsOn,isPastDate};
})(typeof window==='undefined'?globalThis:window);
