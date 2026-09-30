(function(global){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const uid=()=> 'rem_'+(global.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
  const C=global.StudentCalendar;
  function calendarEntries(reminders){
    return reminders.filter(r=>r.due_at).map(r=>({
      id:'reminder:'+r.id,reminder_id:r.id,kind:'reminder',title:r.title,
      event_date:r.due_at.slice(0,10),start_time:r.due_at.slice(11,16)||'',end_time:'',
      recurrence:'none',color:'#e34859',completed:!!r.completed,series_id:r.series_id,status:r.status||(r.completed?'done':'no_progress'),
    }));
  }
  function create(options){
    const root=document.getElementById('modalRoot');
    let listFilter='all';
    async function api(path,payload){
      const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json();if(!r.ok||data.ok===false)throw Error(data.error||'Could not save reminder.');return data;
    }
    function fieldset(d,i,editing){
      const related=d.subject_id||options.subjects().find(s=>s.name.toLowerCase()===String(d.subject||'').toLowerCase())?.id||'';
      return `<fieldset data-draft="${i}" data-draft-id="${esc(d.id||uid())}"><legend>${editing?'Reminder details':'Reminder '+(i+1)}</legend><div class="calendar-form-grid">
      <label class="form-row">Title<input name="title" required maxlength="300" value="${esc(d.title)}"></label>
      <label class="form-row">Subject<select name="subject_id"><option value="">No subject</option>${options.subjects().map(s=>`<option value="${esc(s.id)}" ${related===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="form-row">First due date<input name="due_date" type="date" value="${esc(d.due_date||(d.due_at||'').slice(0,10))}"></label>
      <label class="form-row">Due time (optional)<input name="due_time" type="time" value="${esc(d.due_time||(d.due_at||'').slice(11,16))}"><small>Leave blank for an all-day reminder.</small></label>
      <label class="form-row">Priority<select name="priority">${['low','medium','high'].map(p=>`<option value="${p}" ${(d.priority||'medium')===p?'selected':''}>${p[0].toUpperCase()+p.slice(1)}</option>`).join('')}</select></label>
      ${editing?`<label class="form-row">Status<select name="status">${[['no_progress','No Progress'],['in_progress','In Progress'],['done','Done']].map(([v,l])=>`<option value="${v}" ${(d.status||(d.completed?'done':'no_progress'))===v?'selected':''}>${l}</option>`).join('')}</select></label>`:''}
      ${!editing?`<label class="form-row">Repeat<select name="recurrence"><option value="none">Does not repeat</option><option value="weekly" ${d.recurrence==='weekly'?'selected':''}>Every week</option></select></label><label class="form-row" data-until>Repeat until (inclusive)<input name="repeat_until" type="date" value="${esc(d.repeat_until)}"></label>`:''}
      <label class="form-row">Description<textarea name="description" rows="3">${esc(d.description)}</textarea></label></div><div class="reminder-preview" aria-live="polite"></div></fieldset>`;
    }
    function review(drafts,existing=null){
      if(!drafts?.length)return Promise.resolve(false);
      return new Promise(resolve=>{
        const previous=document.activeElement;
        root.innerHTML=`<div class="modal-backdrop"><form class="modal wide calendar-form reminders-form" role="dialog" aria-modal="true" aria-label="${existing?'Edit reminder':'Review reminders'}"><div class="modal-head"><h2>${existing?'Edit reminder':'Review reminders'}</h2><button class="modal-close" type="button" aria-label="Close">×</button></div><p>${existing?.series_id?'This changes only this occurrence. Other weeks remain unchanged.':'Dated reminders appear in red on the calendar. Review the dates below before saving.'}</p>${drafts.map((d,i)=>fieldset(d,i,!!existing)).join('')}<p class="calendar-error" role="alert"></p>${existing?'<div class="portal-actions"><button type="button" data-complete class="btn secondary"></button><button type="button" data-delete class="btn danger">Delete this reminder</button></div>':''}<div class="modal-actions"><button class="btn secondary" data-cancel type="button">Cancel</button><button class="btn primary" type="submit">${existing?'Save changes':'Confirm & save reminders'}</button></div></form></div>`;
        const form=root.querySelector('form');let saving=false;
        function close(result=false){if(saving)return;root.innerHTML='';previous?.focus();resolve(result)}
        form.querySelectorAll('.modal-close,[data-cancel]').forEach(b=>b.onclick=()=>close());
        form.onkeydown=ev=>{
          if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();close()}
          if(ev.key==='Tab'){
            const nodes=[...form.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.offsetParent!==null);
            if(ev.shiftKey&&document.activeElement===nodes[0]){ev.preventDefault();nodes.at(-1)?.focus()}
            else if(!ev.shiftKey&&document.activeElement===nodes.at(-1)){ev.preventDefault();nodes[0]?.focus()}
          }
        };
        const value=(row,name)=>row.querySelector(`[name="${name}"]`)?.value||'';
        const update=()=>form.querySelectorAll('[data-draft]').forEach(row=>{
          const repeat=value(row,'recurrence')==='weekly',first=value(row,'due_date'),until=value(row,'repeat_until');
          const untilBox=row.querySelector('[data-until]');if(untilBox)untilBox.hidden=!repeat;
          row.querySelector('[name=due_date]').required=repeat||!!value(row,'due_time');
          const end=row.querySelector('[name=repeat_until]');if(end){end.required=repeat;end.min=first}
          let dates=[];
          if(first){
            if(repeat&&until&&until>=first){for(let d=C.date(first);C.key(d)<=until&&dates.length<=260;d=C.addDays(d,7))dates.push(C.key(d))}
            else if(!repeat)dates=[first];
          }
          const format=s=>C.date(s).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
          row.querySelector('.reminder-preview').textContent=dates.length?`${dates.length} reminder${dates.length===1?'':'s'} · ${value(row,'due_time')||'All day'}\n${dates.map(format).join(' · ')}`:repeat?'Choose the first date and repeat end date.':'No due date: this will stay in Reminders but will not appear on the calendar.';
        });
        form.addEventListener('input',update);form.addEventListener('change',update);update();
        const busy=b=>{saving=b;form.querySelectorAll('button').forEach(button=>button.disabled=b)};
        async function perform(fn){
          busy(true);
          try{await fn();await options.refresh();busy(false);close(true)}catch(err){form.querySelector('[role=alert]').textContent=err.message;busy(false)}
        }
        if(existing){
          const complete=form.querySelector('[data-complete]');complete.textContent=existing.completed?'Restore reminder':'Mark completed';
          complete.onclick=()=>perform(()=>api('/api/portal',{table:'reminders',item:{...existing,completed:existing.completed?0:1}}));
          form.querySelector('[data-delete]').onclick=()=>{if(confirm('Delete this reminder occurrence?'))perform(()=>api('/api/portal/delete',{table:'reminders',id:existing.id}))};
        }
        form.onsubmit=ev=>{
          ev.preventDefault();if(saving)return;
          const rows=[...form.querySelectorAll('[data-draft]')].map(row=>({
            id:row.dataset.draftId,...Object.fromEntries([...row.querySelectorAll('[name]')].map(el=>[el.name,el.value]))
          }));
          if(existing){
            const row=rows[0],due=row.due_date?(row.due_date+(row.due_time?'T'+row.due_time:'')):null;
            perform(()=>api('/api/portal',{table:'reminders',item:{...existing,...row,id:existing.id,due_at:due,completed:row.status==='done'?1:0}}));
          }else perform(()=>api('/api/reminders/import',{drafts:rows}));
        };
        form.querySelector('[name=title]').focus();
      });
    }
    const edit=item=>review([item||{}],item?.id?item:null);
    function render(){
      const rows=[...options.reminders()].sort((a,b)=>Number(a.completed)-Number(b.completed)||String(a.due_at||'9999').localeCompare(String(b.due_at||'9999')));
      const today=C.key(new Date());
      const filtered=rows.filter(r=>listFilter==='completed'?r.completed:listFilter==='today'?!r.completed&&r.due_at?.slice(0,10)===today:listFilter==='upcoming'?!r.completed&&r.due_at?.slice(0,10)>=today:listFilter==='high'?!r.completed&&r.priority==='high':true);
      const target=document.getElementById('portalReminders');
      target.innerHTML=`<div class="section-head"><div><h2>Reminders</h2><p>Dated reminders appear in red on your calendar. Each weekly occurrence can be completed separately. Done reminders are deleted after 24 hours without saved edits; reopening cancels the timer.</p></div><button class="btn primary" data-new-reminder>＋ Add reminder</button></div><div class="portal-actions">${['all','today','upcoming','high','completed'].map(f=>`<button class="btn ${listFilter===f?'primary':'secondary'} small" data-reminder-filter="${f}">${f==='high'?'High priority':f[0].toUpperCase()+f.slice(1)}</button>`).join('')}</div><div class="portal-list">${filtered.map(r=>`<article class="portal-item ${r.completed?'reminder-completed':''}"><label><input type="checkbox" data-reminder-toggle="${esc(r.id)}" ${r.completed?'checked':''}> <b>${esc(r.title)}</b><small>${r.due_at?esc(C.date(r.due_at.slice(0,10)).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'}))+(r.due_at.includes('T')?' · '+esc(r.due_at.slice(11,16)):' · All day'):'No due date'} · ${esc(r.priority)}${r.series_id?' · Weekly occurrence':''}${r.subject_id?' · '+esc(options.subjects().find(s=>s.id===r.subject_id)?.name||''):''}</small></label><select class="status-badge status-${r.status||(r.completed?'done':'no_progress')}" data-manager-status="${esc(r.id)}" aria-label="Status for ${esc(r.title)}">${[['no_progress','No Progress'],['in_progress','In Progress'],['done','Done']].map(([v,l])=>`<option value="${v}" ${(r.status||(r.completed?'done':'no_progress'))===v?'selected':''}>${l}</option>`).join('')}</select><button class="btn secondary small" data-reminder-edit="${esc(r.id)}">Edit</button></article>`).join('')||'<div class="empty">No reminders in this view.</div>'}</div><p id="reminderListError" class="calendar-error" role="alert"></p>`;
      target.querySelector('[data-new-reminder]').onclick=()=>edit();
      target.querySelectorAll('[data-manager-status]').forEach(select=>select.onchange=async()=>{select.disabled=true;try{await api('/api/portal',{table:'reminders',item:{id:select.dataset.managerStatus,status:select.value}});await options.refresh()}catch(err){select.disabled=false;target.querySelector('#reminderListError').textContent=err.message}});
      target.querySelectorAll('[data-reminder-filter]').forEach(b=>b.onclick=()=>{listFilter=b.dataset.reminderFilter;render()});
      target.querySelectorAll('[data-reminder-edit]').forEach(b=>b.onclick=()=>edit(rows.find(r=>r.id===b.dataset.reminderEdit)));
      target.querySelectorAll('[data-reminder-toggle]').forEach(box=>box.onchange=async()=>{
        box.disabled=true;const item=rows.find(r=>r.id===box.dataset.reminderToggle);
        try{await api('/api/portal',{table:'reminders',item:{...item,completed:box.checked?1:0}});await options.refresh()}catch(err){box.checked=!!item.completed;box.disabled=false;target.querySelector('#reminderListError').textContent=err.message}
      });
    }
    return {render,edit,review,calendarEntries:()=>calendarEntries(options.reminders())};
  }
  global.StudentReminders={create,calendarEntries};
})(typeof window==='undefined'?globalThis:window);
