/* Dashboard presentation reuses the existing stores, editors and navigation. */
(function(global){
 'use strict';
 const C=global.StudentCalendar;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const color=c=>/^#[0-9a-f]{6}$/i.test(c||'')?c:'#7953f5';
 const paths={home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',book:'M12 5c-4-3-8-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15',calendar:'M5 3v4m14-4v4M3 10h18M4 5h16v16H4Zm4 9h1m3 0h1m3 0h1m-9 4h1m3 0h1',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',note:'M5 3h10l4 4v14H5Zm9 0v5h5M8 12h8m-8 4h6',cards:'M8 3h13v15H8ZM3 7v14h14',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm8 0v4m-2-2h4',gear:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',bolt:'m14 2-10 12h7l-1 8 10-13h-7Z',sun:'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-6v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',chart:'M5 21V10m7 11V3m7 18V7',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',quiz:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 3v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',edit:'m4 16 12-12 4 4L8 20H4Zm10-10 4 4',fire:'M12 2c1 6-5 7-5 12 0 3 2 7 6 7s7-3 7-7c0-3-3-5-3-8 0 4-3 5-3 5s2-6-2-9Z'};
 const icon=n=>`<svg class="ui-icon icon-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n]||paths.spark}"/></svg>`;
 const scenery=()=>`<svg class="mountain-art" viewBox="0 0 480 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="352" cy="29" r="21" fill="#fff8ef"/><path d="M0 140 70 91 108 116 187 52 251 104 336 12 395 70 425 55 480 92V140Z" fill="#cbc7ed"/><path d="m150 140 94-68 28 33 64-93 23 10 76 118Z" fill="#9d9fd9"/><path d="m270 140 66-128-13 73 32-13 80 68Z" fill="#797fba"/><path d="m318 37 18-25 23 10 15 27-28-13-15 20Z" fill="#eeebfa"/><path d="M0 140 98 121 192 137 274 112 342 134 427 92 480 109V140Z" fill="#777fae"/><path d="M0 140 235 136 320 116 354 133 418 115 480 126V140Z" fill="#4b648c"/>${[320,344,366,383,403,428,450,470].map((x,i)=>`<path d="m${x} ${85+i%3*9} -12 29h8l-14 17h15v9h6v-9h15l-14-17h8Z" fill="${i%2?'#304d70':'#3d577a'}"/>`).join('')}</svg>`;
 const time=t=>{if(!t)return 'All day';const [h,m]=t.split(':');return `${+h%12||12}:${m} ${+h<12?'AM':'PM'}`};
 const minutes=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
 function stats(state,portal){
   const results=Object.values(state.latestResults||{}),ratings=Object.values(state.flashcardProgress||{}).flatMap(x=>Object.values(x));
   const dates=[...results.map(r=>r.completedAt),...ratings.map(r=>r.updatedAt),...(portal.reviews||[]).map(r=>r.reviewed_at)].filter(Boolean).map(x=>new Date(x)).filter(d=>!isNaN(d)).map(C.key);
   const recorded=new Set(dates);let day=new Date(),streak=0;
   if(!recorded.has(C.key(day)))day=C.addDays(day,-1);
   while(recorded.has(C.key(day))){streak++;day=C.addDays(day,-1)}
   return {quizzes:results.length,reviews:ratings.reduce((sum,r)=>sum+(Number(r.reviews)||0),0),subjects:Object.keys(state.subjects||{}).length,streak};
 }
 function weekGrid(events,reminders,now){
   const start=C.monday(now),hourWidth=68;
   const header=`<div class="week-time-row"><div class="week-day-label">Day</div>${Array.from({length:24},(_,h)=>`<div class="week-hour">${h%12||12} ${h<12?'AM':'PM'}</div>`).join('')}</div>`;
   const rows=Array.from({length:7},(_,i)=>{
     const day=C.addDays(start,i),dayKey=C.key(day),items=C.eventsOn(events,day),due=reminders.filter(r=>r.due_at?.slice(0,10)===dayKey),lanes=[];
     const timed=[...items.map(x=>({...x,isReminder:false})),...due.filter(r=>r.due_at.includes('T')).map(r=>({...r,isReminder:true,start_time:r.due_at.slice(11,16),end_time:null,color:'#e34859'}))].sort((a,b)=>a.start_time.localeCompare(b.start_time));
     const blocks=timed.map(x=>{
       const from=minutes(x.start_time),to=x.end_time?minutes(x.end_time):Math.min(1440,from+30);
       let lane=lanes.findIndex(end=>end<=from);if(lane<0)lane=lanes.length;lanes[lane]=to;
       return `<button class="week-block ${x.isReminder?'week-reminder':''} ${x.completed?'is-done':''}" data-week-${x.isReminder?'reminder':'event'}="${esc(x.id)}" style="left:${from/60*hourWidth}px;width:${(to-from)/60*hourWidth}px;top:${lane*25+2}px;--event-color:${color(x.color)}" title="${esc(x.title+' · '+time(x.start_time)+(x.end_time?'–'+time(x.end_time):' · Reminder')+(x.location?' · '+x.location:''))}">${esc(x.title)}</button>`;
     }).join('');
     const allDay=due.filter(r=>!r.due_at.includes('T'));
     return `<div class="week-day-row ${dayKey===C.key(now)?'is-today':''}"><div class="week-day-label" title="${esc(day.toLocaleDateString(undefined,{dateStyle:'full'}))}"><b>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</b><small>${day.getDate()}/${day.getMonth()+1}</small></div><div class="week-track"><div class="week-lanes" style="height:${Math.max(27,lanes.length*25+2)}px">${blocks}</div>${allDay.length?`<div class="week-all-day">${allDay.map(r=>`<button data-week-reminder="${esc(r.id)}" class="all-day-reminder ${r.completed?'is-done':''}">All day · ${esc(r.title)}</button>`).join('')}</div>`:''}</div></div>`;
   }).join('');
   return `<div class="week-scroll" tabindex="0" role="region" aria-label="Weekly timetable, scroll horizontally to see all 24 hours"><div class="week-grid">${header}${rows}</div></div><div class="week-caption"><span>${start.toLocaleDateString(undefined,{day:'numeric',month:'short'})} – ${C.addDays(start,6).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</span><span>Scroll for all 24 hours ↔</span></div>`;
 }
 function create(options){
   const target=document.getElementById('portalDashboard');let scrollLeft=7*68;
   const go=name=>global.showView(name);
   const dueLabel=r=>{
     if(!r.due_at)return 'No due date';const today=C.key(new Date()),tomorrow=C.key(C.addDays(new Date(),1)),d=r.due_at.slice(0,10);
     return (d===today?'Today':d===tomorrow?'Tomorrow':C.date(d).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}))+(r.due_at.includes('T')?', '+time(r.due_at.slice(11,16)):' · All day');
   };
   async function setStatus(id,status){
     try{await options.saveReminder({id,status})}catch(err){const error=document.getElementById('dashboardError');error.textContent=err.message;renderStatusControls()}
   }
   function renderStatusControls(){
     const reminders=options.portal().reminders;
     target.querySelectorAll('[data-status]').forEach(el=>{const r=reminders.find(r=>r.id===el.dataset.status);el.value=r.status||(r.completed?'done':'no_progress');el.disabled=false});
   }
   function render(){
     const portal=options.portal(),state=options.state(),now=new Date(),s=stats(state,portal),name=portal.settings.display_name||'Student';
     const reminders=[...portal.reminders].sort((a,b)=>Number(a.status==='done'||!!a.completed)-Number(b.status==='done'||!!b.completed)||String(a.due_at||'9999').localeCompare(String(b.due_at||'9999')));
     const upcoming=reminders.filter(r=>!r.completed&&r.due_at).slice(0,5),events=C.eventsOn(portal.timetable_events,now);
     const cardTitle=(title,n,view,subtitle='')=>`<div class="dash-title"><div class="dash-heading">${icon(n)}<div><h3>${title}</h3>${subtitle?`<small>${subtitle}</small>`:''}</div></div><button class="dash-link" data-go="${view}">View all →</button></div>`;
     const reminderRows=reminders.map(r=>{const status=r.status||(r.completed?'done':'no_progress');return `<div class="dash-reminder"><button class="reminder-circle ${status==='done'?'checked':''}" data-done="${esc(r.id)}" title="${r.cleanup_after?esc('Automatically deleted after '+new Date(r.cleanup_after).toLocaleString()+'. Saved edits restart the timer.'):'Done items are deleted after 24 hours without saved edits.'}" aria-label="${status==='done'?'Restore':'Complete'} ${esc(r.title)}" aria-pressed="${status==='done'}">${status==='done'?'✓':''}</button><button class="reminder-detail" data-edit-reminder="${esc(r.id)}"><b>${esc(r.title)}</b><small>${icon('calendar')}${esc(dueLabel(r))}</small></button><select class="status-badge status-${status}" data-status="${esc(r.id)}" aria-label="Status for ${esc(r.title)}">${[['no_progress','No Progress'],['in_progress','In Progress'],['done','Done']].map(([v,label])=>`<option value="${v}" ${status===v?'selected':''}>${label}</option>`).join('')}</select></div>`}).join('');
     const deadlines=upcoming.map(r=>{const d=C.date(r.due_at.slice(0,10));const n=Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);return `<button class="deadline-row" data-edit-reminder="${esc(r.id)}" style="--event-color:${n<=2?'#f55d85':n<=5?'#e9ae26':'#7861fa'}"><span><b>${esc(r.title)}</b><small>${esc(dueLabel(r))}</small></span><span class="days-badge ${n<=2?'urgent':''}">${n<0?`${Math.abs(n)}d overdue`:n===0?'Today':n===1?'1 day':`${n} days`}</span></button>`}).join('');
     const schedule=events.map(x=>`<button class="schedule-row" data-week-event="${esc(x.id)}" style="--event-color:${color(x.color)}"><time>${time(x.start_time)}</time><b>${esc(x.title)}</b><small>${esc(x.location||'—')}</small></button>`).join('');
     target.innerHTML=`<div class="portal-dashboard"><div class="portal-welcome"><div><h2>Student Helper Portal</h2><h3>Good ${now.getHours()<12?'morning':now.getHours()<18?'afternoon':'evening'}, ${esc(name)} <span class="greeting-wave">👋</span></h3><p>Stay organised. Keep learning. You've got this.</p></div><div class="portal-banner">${scenery()}<blockquote>“ A little progress each day<br>adds up to big results. ”</blockquote><span class="banner-stroke"></span></div></div><div class="dashboard-main"><article class="dash-card dash-timetable"><div class="dash-title"><div class="dash-heading">${icon('calendar')}<div><h3>Weekly Timetable</h3><small>Your 24-hour schedule for the week</small></div></div><div class="dash-header-actions"><button class="dash-link soft" data-go="timetable">${icon('edit')} Edit Timetable</button><button class="dash-link soft" data-go="timetable">View All →</button></div></div>${weekGrid(portal.timetable_events,portal.reminders,now)}</article><article class="dash-card dash-reminders">${cardTitle('Reminders / To-Do','bell','reminders')}<div class="dashboard-reminder-list">${reminderRows||'<p class="dashboard-empty">A little planning goes a long way.<br>Add your first reminder below.</p>'}</div><p id="dashboardError" role="alert"></p></article><article class="dash-card dash-deadlines">${cardTitle('Upcoming Deadlines','calendar','reminders')}<div class="compact-list">${deadlines||'<p class="dashboard-empty">No upcoming deadlines.<br>You have room to focus.</p>'}</div></article><article class="dash-card dash-schedule">${cardTitle("Today's Schedule",'sun','timetable',esc(now.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'})))}<div class="compact-list">${schedule||'<p class="dashboard-empty">No classes scheduled today.<br>Make a little time for yourself.</p>'}</div></article><div class="dash-actions-column"><article class="dash-card dash-quick"><div class="dash-heading">${icon('bolt')}<h3>Quick Actions</h3></div><div class="quick-grid"><button class="quick-primary" data-new-reminder><span>＋</span> Add Reminder</button><button data-go="timetable">${icon('calendar')} Edit Timetable</button><button data-go="import">${icon('quiz')} New Quiz</button><button data-go="flashcard-import">${icon('cards')} New Flashcards</button></div></article><article class="dash-card motivation-card">${scenery()}<div><span class="trophy">🏆</span><b>Small steps<br>create big results!</b></div><small>You're building a brighter future.</small></article></div></div><div class="portal-stat-strip">${[['chart',s.quizzes,'Quizzes Completed','Topics with saved results'],['cards',s.reviews,'Flashcards Reviewed','Total recorded reviews'],['book',s.subjects,'Subjects','In your study space'],['fire',s.streak+' '+(s.streak===1?'day':'days'),'Study Streak','Based on recorded study days']].map(([n,v,label,hint])=>`<article class="dash-stat">${icon(n)}<div><strong>${v}</strong><b>${label}</b><small>${hint}</small></div></article>`).join('')}</div></div>`;
     target.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
     const detailedWeek=target.querySelector('.dash-timetable .dash-header-actions button:last-child');
     detailedWeek.textContent='▦ View Week';detailedWeek.onclick=()=>options.calendar.openWeek();
     target.querySelector('[data-new-reminder]').onclick=()=>options.reminders.edit();
     target.querySelectorAll('[data-status]').forEach(el=>el.onchange=()=>{el.disabled=true;setStatus(el.dataset.status,el.value)});
     target.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{b.disabled=true;setStatus(b.dataset.done,reminders.find(r=>r.id===b.dataset.done).completed?'no_progress':'done')});
     target.querySelectorAll('[data-edit-reminder],[data-week-reminder]').forEach(b=>b.onclick=()=>options.reminders.edit(reminders.find(r=>r.id===(b.dataset.editReminder||b.dataset.weekReminder))));
     target.querySelectorAll('[data-week-event]').forEach(b=>b.onclick=()=>options.calendar.edit(portal.timetable_events.find(x=>x.id===b.dataset.weekEvent)));
     requestAnimationFrame(()=>{const el=target.querySelector('.week-scroll');if(el)el.scrollLeft=scrollLeft});
     document.querySelectorAll('[data-display-name]').forEach(el=>el.textContent=name);
     document.querySelector('[data-avatar]').textContent=name.trim().slice(0,1).toUpperCase()||'S';
     global.PortalAccount?.updateHeader();
     global.GeneralTodos?.mount(target);
   }
   function setupNavigation(){
     const nav=document.querySelector('.nav');
     nav.innerHTML=`<div class="subjects-nav"><div class="subjects-nav-head"><button data-view="home">${icon('book')}<span>Subjects</span></button><button id="subjectsToggle" aria-controls="subjectsSubnav" aria-label="Expand or collapse Subjects"><span>⌄</span></button></div><div id="subjectsSubnav" class="subjects-subnav"><div>${[['library','note','Quizzes'],['flashcards','cards','Flashcards'],['notes','note','Notes']].map(([v,n,l])=>`<button data-view="${v}"><span class="nav-dot">•</span>${icon(n)}<span>${l}</span></button>`).join('')}</div></div></div><button data-view="tutor">${icon('spark')}<span>AI Tutor</span></button><button data-view="settings">${icon('gear')}<span>Settings</span></button>`;
     let expanded=true;try{expanded=localStorage.getItem('portal.subjectsExpanded')!=='false'}catch{}
     const apply=()=>{nav.querySelector('.subjects-nav').classList.toggle('expanded',expanded);document.getElementById('subjectsToggle').setAttribute('aria-expanded',String(expanded));document.getElementById('subjectsSubnav').inert=!expanded};
     document.getElementById('subjectsToggle').onclick=()=>{expanded=!expanded;try{localStorage.setItem('portal.subjectsExpanded',String(expanded))}catch{}apply()};apply();
     nav.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));
     document.querySelector('.brand-logo').innerHTML='🎓';document.querySelector('.brand-name').innerHTML='Student<br>Helper Portal';document.querySelector('.brand-sub').innerHTML='Study Smarter<br>Brighter Tomorrow';
     document.querySelector('.side-footer').insertAdjacentHTML('beforebegin','<div class="sidebar-decoration"><p>“ Consistent progress<br>creates extraordinary<br>results. ”</p><div class="sidebar-plant"><i></i><i></i><i></i><i></i><i></i></div></div>');
     // Existing destructive/reset controls move into Settings, keeping their handlers.
     const footer=document.querySelector('.side-footer');document.getElementById('view-settings').append(footer);footer.hidden=false;
     const top=document.createElement('div');top.className='portal-topbar';top.innerHTML=`<button id="menuToggle" class="icon-button" aria-label="Open navigation" aria-expanded="false">☰</button><div class="global-search">${icon('search')}<input id="portalSearch" placeholder="Search subjects, notes, quizzes…" aria-label="Search subjects, notes and quizzes" autocomplete="off"><div id="portalSearchResults" hidden></div></div><button class="icon-button notification-button" aria-label="View reminders">${icon('bell')}</button><button class="profile-button"><span class="profile-avatar" data-avatar>S</span><b data-display-name>Student</b><span>⌄</span></button>`;
     document.querySelector('.main').prepend(top);
     toggleHome();
     function toggleHome(){const home=document.createElement('button');home.type='button';home.className='portal-home';home.setAttribute('aria-label','Student Helper Portal — Dashboard');home.innerHTML='<span class="portal-home-mark" aria-hidden="true">🎓</span><span>Student Helper<br>Portal</span>';home.onclick=()=>go('dashboard');top.querySelector('#menuToggle').after(home)}
     top.querySelector('.notification-button').onclick=()=>go('reminders');top.querySelector('.profile-button').onclick=()=>go('settings');
     const backdrop=document.createElement('button');backdrop.className='nav-backdrop';backdrop.setAttribute('aria-label','Close navigation');document.body.append(backdrop);
     const toggle=document.getElementById('menuToggle');
     const mobile=matchMedia('(max-width:760px)'),sidebar=document.querySelector('.sidebar');
     sidebar.id='portalNavigation';toggle.setAttribute('aria-controls',sidebar.id);
     const drawerClose=document.createElement('button');drawerClose.className='mobile-nav-close';drawerClose.type='button';drawerClose.textContent='×';drawerClose.setAttribute('aria-label','Close navigation');sidebar.prepend(drawerClose);
     let desktopHidden=false;try{desktopHidden=localStorage.getItem('portal.sidebarHidden')==='true'}catch{}
     const sync=()=>{const open=mobile.matches?document.body.classList.contains('nav-open'):!desktopHidden;document.body.classList.toggle('sidebar-hidden',!mobile.matches&&desktopHidden);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Hide navigation':'Show navigation');toggle.title=open?'Hide navigation':'Show navigation';sidebar.inert=!open};
     const close=()=>{document.body.classList.remove('nav-open');sync()};
     toggle.onclick=()=>{if(mobile.matches){const open=document.body.classList.toggle('nav-open');sync();if(open)drawerClose.focus()}else{desktopHidden=!desktopHidden;try{localStorage.setItem('portal.sidebarHidden',String(desktopHidden))}catch{}sync()}};backdrop.onclick=()=>{close();toggle.focus()};
     drawerClose.onclick=()=>{close();toggle.focus()};
     mobile.addEventListener('change',()=>{if(sidebar.contains(document.activeElement))toggle.focus();close()});close();
     document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&document.body.classList.contains('nav-open')){close();toggle.focus()}});
     sidebar.addEventListener('keydown',ev=>{if(ev.key==='Tab'&&document.body.classList.contains('nav-open')){const buttons=[...sidebar.querySelectorAll('button')].filter(b=>!b.closest('[inert]')&&b.offsetParent!==null);if(ev.shiftKey&&document.activeElement===buttons[0]){ev.preventDefault();buttons.at(-1).focus()}else if(!ev.shiftKey&&document.activeElement===buttons.at(-1)){ev.preventDefault();buttons[0].focus()}}});
     const search=top.querySelector('input'),results=top.querySelector('#portalSearchResults');
     search.oninput=()=>{const q=search.value.trim().toLowerCase(),state=options.state();if(!q){results.hidden=true;return}const matches=[...Object.values(state.subjects).map(s=>({title:s.name,view:'home',kind:'Subject'})),...Object.keys(state.topics).map(t=>({title:t,view:'library',kind:'Quiz topic'})),...options.portal().notes.map(n=>({title:n.title,view:'notes',kind:'Note · '+(state.subjects[n.subject_id]?.name||'Unassigned'),note:n}))].filter(x=>x.title.toLowerCase().includes(q)||(x.note?.content||'').toLowerCase().includes(q)).slice(0,8);results.innerHTML=matches.map((x,i)=>`<button data-result-index="${i}"><b>${esc(x.title)}</b><small>${esc(x.kind)}</small></button>`).join('')||'<p>No matching study content.</p>';results.hidden=false;results.querySelectorAll('button').forEach(b=>b.onclick=()=>{const result=matches[+b.dataset.resultIndex];if(result.note)global.portalNotes.open(result.note.subject_id||'unassigned',result.note.id);else go(result.view);results.hidden=true;search.value=''})};
     document.addEventListener('click',ev=>{if(!ev.target.closest('.global-search'))results.hidden=true});
     return {close,afterView(name){close();document.body.classList.toggle('dashboard-view',name==='dashboard');if(name==='dashboard')render();if(['timetable','reminders'].includes(name)){const view=document.getElementById('view-'+name);if(!view.querySelector('.back-dashboard')){const back=document.createElement('button');back.className='dash-link back-dashboard';back.textContent='← Back to Dashboard';back.onclick=()=>go('dashboard');view.prepend(back)}}nav.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name||(['subject','topic','learn','quiz','results'].includes(name)&&b.dataset.view==='home')||(['flashcard-import','flashcard-study'].includes(name)&&b.dataset.view==='flashcards')))}};
   }
   return {render,setupNavigation};
 }
 global.StudentDashboard={create,stats,weekGrid};
})(window);
