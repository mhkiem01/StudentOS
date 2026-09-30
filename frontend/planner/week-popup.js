(function(global){
  'use strict';
  const C=global.StudentCalendar, hourHeight=64;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const minutes=s=>{const [h,m]=s.split(':').map(Number);return h*60+m};
  const color=e=>/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#6d4df4';
  // Assign lanes per connected overlap group. Touching endpoints do not overlap.
  function lanes(items){
    const sorted=items.map(x=>({...x})).sort((a,b)=>a.start-b.start||b.end-a.end);
    let group=[],ends=[],until=-1;
    const finish=()=>{group.forEach(x=>x.lanes=ends.length);group=[];ends=[]};
    for(const item of sorted){
      if(item.start>=until)finish();
      let lane=ends.findIndex(end=>end<=item.start);if(lane<0)lane=ends.length;
      ends[lane]=item.end;item.lane=lane;group.push(item);until=Math.max(until,item.end);
    }
    finish();return sorted;
  }
  function segments(events,day){
    const current=C.eventsOn(events,day).filter(e=>e.start_time).map(event=>{
      const start=minutes(event.start_time),end=event.kind==='reminder'?Math.min(1440,start+30):minutes(event.end_time);
      return {event,start,end:end<=start?1440:end,occurrence:C.key(day)};
    });
    // The editor currently rejects overnight events; rendering already supports split segments.
    C.eventsOn(events,C.addDays(day,-1)).filter(e=>e.kind!=='reminder'&&e.end_time&&minutes(e.end_time)<minutes(e.start_time)).forEach(event=>{
      if(minutes(event.end_time)>0)current.push({event,start:0,end:minutes(event.end_time),occurrence:C.key(C.addDays(day,-1))});
    });
    return lanes(current);
  }
  function create(options){
    let root=null,week=null,timer=null,previous=null,locked='',inert=[];
    const editorRoot=()=>document.getElementById('modalRoot');
    function close(){
      if(!root)return;root.remove();root=null;clearInterval(timer);observer.disconnect();
      document.body.style.overflow=locked;inert.forEach(([el,value])=>el.inert=value);inert=[];
      document.removeEventListener('keydown',keys,true);
      if(previous?.isConnected)previous.focus();
      else [...document.querySelectorAll('#calendarViewWeek,.dash-timetable .dash-header-actions button:last-child')].find(el=>el.offsetParent!==null)?.focus();
    }
    const observer=new MutationObserver(()=>{if(root){root.inert=!!editorRoot().firstElementChild;if(!root.inert){render(false);root.querySelector('[data-close-week]').focus()}}});
    function keys(ev){
      if(!root||editorRoot().firstElementChild)return;
      if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();close()}
      if(ev.key==='Tab'){
        const buttons=[...root.querySelectorAll('button')].filter(el=>!el.disabled);
        if(ev.shiftKey&&document.activeElement===buttons[0]){ev.preventDefault();buttons.at(-1).focus()}
        else if(!ev.shiftKey&&document.activeElement===buttons.at(-1)){ev.preventDefault();buttons[0].focus()}
      }
    }
    function open(){
      if(root)return;week=C.monday(new Date());previous=document.activeElement;locked=document.body.style.overflow;
      document.body.style.overflow='hidden';root=document.createElement('div');root.className='detailed-week-backdrop';
      for(const el of document.body.children)if(el!==editorRoot()&&el.tagName!=='SCRIPT'){inert.push([el,el.inert]);el.inert=true}
      document.body.append(root);document.addEventListener('keydown',keys,true);observer.observe(editorRoot(),{childList:true});
      render(true);root.querySelector('[data-close-week]').focus();timer=setInterval(updateClock,30000);
    }
    function updateClock(){
      if(!root)return;root.querySelectorAll('.week-now').forEach(el=>el.remove());
      const now=new Date(),column=root.querySelector(`[data-week-date="${C.key(now)}"]`);
      if(column){const line=document.createElement('div');line.className='week-now';line.style.top=(now.getHours()*60+now.getMinutes())/60*hourHeight+'px';line.setAttribute('aria-label','Current time '+now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));column.append(line)}
    }
    function render(reset=false){
      if(!root)return;
      const old=root.querySelector('.detailed-week-scroll'),top=old?.scrollTop||0,left=old?.scrollLeft||0;
      const events=options.events(),days=Array.from({length:7},(_,i)=>C.addDays(week,i)),today=C.key(new Date()),records=[];
      const card=(e,day,segment)=>{
        const index=records.push({event:e,occurrence:segment?.occurrence||C.key(day)})-1;
        const reminder=e.kind==='reminder',status=e.completed?'Done':e.status==='in_progress'?'In Progress':'No Progress';
        const info=[e.start_time?(e.end_time?e.start_time+'–'+e.end_time:e.start_time):'All day',e.title,e.location,reminder?'Reminder · '+status:'',e.series_id||e.recurrence==='weekly'?'↻ Weekly':''].filter(Boolean).join(' · ');
        const style=segment?`top:${segment.start/60*hourHeight}px;height:${(segment.end-segment.start)/60*hourHeight}px;left:calc(${segment.lane/segment.lanes*100}% + 3px);width:calc(${100/segment.lanes}% - 6px);`:'';
        return `<button class="detailed-week-event ${segment?'timed':''} ${segment&&segment.end-segment.start<45?'compact':''} ${segment&&segment.end-segment.start<25?'micro':''} ${C.isPastDate(day)?'past':''} ${e.completed?'completed':''}" data-week-item="${index}" style="${style}--event-color:${color(e)}" title="${esc(info)}" aria-label="${esc(info)}"><span>${esc(e.start_time||'All day')}${e.end_time?'–'+esc(e.end_time):''}${reminder?' · Reminder':''}</span><b>${e.completed?'✓ ':''}${esc(e.title)}</b><small>${esc(reminder?status:e.location||'')}${e.series_id||e.recurrence==='weekly'?' · ↻ Weekly':''}</small></button>`;
      };
      const daily=days.map(day=>segments(events,day));
      const allDay=days.map(day=>C.eventsOn(events,day).filter(e=>!e.start_time));
      const shown=[...daily.flat().map(s=>s.event),...allDay.flat()];
      const legend=[...new Map(shown.map(e=>[(e.kind==='reminder'?'Reminder':e.event_type||'Event')+color(e),e])).values()];
      const dateLabel=d=>d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
      root.innerHTML=`<section class="detailed-week" role="dialog" aria-modal="true" aria-labelledby="detailedWeekTitle"><header><div><h2 id="detailedWeekTitle">▦ This Week's Timetable</h2><p>Monday to Sunday · detailed hourly view</p></div><button class="modal-close" data-close-week aria-label="Close weekly timetable">×</button></header><nav aria-label="Week navigation"><button class="btn secondary small" data-week-shift="-1" aria-label="Previous week">←</button><strong aria-live="polite">${esc(dateLabel(week))} – ${esc(dateLabel(days[6]))}</strong><button class="btn secondary small" data-week-shift="1" aria-label="Next week">→</button><button class="btn secondary small" data-week-today>Today</button></nav><div class="detailed-week-scroll" tabindex="0" aria-label="Hourly timetable, scroll for all hours"><div class="detailed-week-grid"><div class="detailed-week-head"><div>Time</div>${days.map(d=>`<div class="${C.key(d)===today?'today':''}"><b>${d.toLocaleDateString(undefined,{weekday:'short'})}</b><small>${d.toLocaleDateString(undefined,{day:'numeric',month:'short'})}${C.key(d)===today?' · Today':''}</small></div>`).join('')}</div>${allDay.some(x=>x.length)?`<div class="detailed-week-allday"><div>All day</div>${days.map((d,i)=>`<div>${allDay[i].map(e=>card(e,d)).join('')}</div>`).join('')}</div>`:''}<div class="detailed-week-hours"><div class="detailed-week-times">${Array.from({length:24},(_,h)=>`<div>${h%12||12} ${h<12?'AM':'PM'}</div>`).join('')}</div>${days.map((d,i)=>`<div data-week-date="${C.key(d)}" class="detailed-week-day ${C.isPastDate(d)?'past':''} ${C.key(d)===today?'today':''}">${daily[i].map(s=>card(s.event,d,s)).join('')}</div>`).join('')}</div></div></div><footer>${legend.map(e=>`<span><i style="background:${color(e)}"></i>${esc(e.kind==='reminder'?'Reminder':e.event_type||'Event')}</span>`).join('')}<small>${shown.length?'Click an item to edit. Reminder blocks mark due times, not task duration.':'No events scheduled this week.'}</small></footer></section>`;
      root.querySelector('[data-close-week]').onclick=close;
      root.querySelectorAll('[data-week-shift]').forEach(b=>b.onclick=()=>{week=C.addDays(week,Number(b.dataset.weekShift)*7);render(true);root.querySelector(`[data-week-shift="${b.dataset.weekShift}"]`).focus()});
      root.querySelector('[data-week-today]').onclick=()=>{week=C.monday(new Date());render(true);root.querySelector('[data-week-today]').focus()};
      root.querySelectorAll('[data-week-item]').forEach(b=>b.onclick=()=>{const r=records[Number(b.dataset.weekItem)];options.edit(r.event,r.occurrence);root.inert=true});
      const scroll=root.querySelector('.detailed-week-scroll');scroll.scrollTop=reset?7*hourHeight:top;scroll.scrollLeft=left;updateClock();
    }
    return {open,close,render};
  }
  global.StudentWeekPopup={create,lanes,segments};
})(typeof window==='undefined'?globalThis:window);
