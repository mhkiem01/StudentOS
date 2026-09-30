/* Notebook workspace: rich documents, shared Notes API, no remote dependencies. */
(function(g){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const id=()=>g.crypto?.randomUUID?.()||'note_'+Date.now()+'_'+Math.random().toString(36).slice(2);
 const allowed=new Set('P DIV BR H1 H2 H3 H4 H5 H6 STRONG B EM I U S STRIKE UL OL LI BLOCKQUOTE PRE CODE MARK ASIDE HR A IMG INPUT SPAN'.split(' '));
 function sanitize(html){
   const t=document.createElement('template');t.innerHTML=String(html||'');
   function clean(parent){for(const el of [...parent.children]){
     if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','TEMPLATE'].includes(el.tagName)){el.remove();continue}
     clean(el);if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);continue}
     const attrs={};
     if(el.tagName==='A'&&/^(https?:\/\/|mailto:)/i.test((el.getAttribute('href')||'').trim()))Object.assign(attrs,{href:el.getAttribute('href'),target:'_blank',rel:'noopener noreferrer'});
     if(el.tagName==='IMG'){if(!/^\/api\/notes\/images\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(el.getAttribute('src')||'')){el.remove();continue}attrs.src=el.getAttribute('src');attrs.alt=el.getAttribute('alt')||'Image'}
     if(el.tagName==='INPUT'){if(el.type!=='checkbox'){el.remove();continue}attrs.type='checkbox';if(el.checked||el.hasAttribute('checked'))attrs.checked='checked'}
     if(el.tagName==='ASIDE')attrs['data-callout']=['takeaway','important','tip','example','question'].includes(el.dataset.callout)?el.dataset.callout:'takeaway';
     for(const a of [...el.attributes])el.removeAttribute(a.name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);
   }}clean(t.content);return t.innerHTML;
 }
 function html(note){return sanitize(note.content_format==='html'?note.content:g.StudentNotes.markdown(note.content))}
 function plain(note){const el=document.createElement('div');el.innerHTML=html(note);return el.textContent||''}
 function quickSource(note){if(note.content_format!=='html')return note.content;const el=document.createElement('div');el.innerHTML=html(note);el.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));el.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,pre,blockquote,aside').forEach(n=>n.append('\n'));return el.textContent||''}
 async function api(path,data){const r=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const x=await r.json();if(!r.ok||x.ok===false)throw Error(x.error||'Could not save. Your draft is kept.');return x}
 const templates={
   'Lecture Notes':['Main concepts','Important definitions','Examples','Questions','Key takeaways'],
   'Tutorial Notes':['Preparation','Problems','Worked solutions','Questions to ask','Next steps'],
   'Revision Notes':['Learning goals','Key facts','Practice questions','Weak areas','Revision checklist'],
   'Exam Summary':['Exam scope','Essential concepts','Formulas and definitions','Common mistakes','Practice plan'],
   'Programming Notes':['Problem','Approach','Code','Explanation','Test cases'],
   'Cornell Notes':['Topic and date','Cues and questions','Lecture notes','Summary']
 };
 function createNotes(o){
   let subject=null,query='',filter='all',active=null,topicScope=null,topicFilter='',weekFilter='';
   const root=document.getElementById('portalNotes'),subjects=()=>o.subjects();
   const current=()=>subjects().find(s=>s.id===subject);
   const scoped=()=>o.notes().filter(n=>subject==='unassigned'?!n.subject_id:n.subject_id===subject&&(!topicScope||n.topic_name===topicScope));
   const tabs=()=>`<nav class="subject-tabs">${(topicScope?['overview','quizzes','flashcards','notes','progress']:['overview','topics','quizzes','flashcards','notes','progress']).map(t=>`<button data-subject-tab="${t}" class="${t==='notes'?'active':''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</nav>`;
   function bindTabs(el){el.querySelectorAll('[data-subject-tab]').forEach(b=>b.onclick=()=>topicScope?o.topicTab(subject,topicScope,b.dataset.subjectTab):b.dataset.subjectTab==='notes'?open(subject||o.currentSubject()):o.subjectTab(subject||o.currentSubject(),b.dataset.subjectTab))}
   function render(){
     if(!current()&&subject!=='unassigned'){
       root.innerHTML=`<div class="notes-subject-picker"><h2>Your notebooks</h2><p>Choose a subject to find your notes or start writing.</p><div class="notes-subject-grid">${subjects().map(s=>`<button data-note-subject="${esc(s.id)}"><b>${esc(s.name)}</b><small>${o.notes().filter(n=>n.subject_id===s.id).length} notes →</small></button>`).join('')}</div>${o.notes().some(n=>!n.subject_id)?'<button class="note-button" data-unassigned>Unassigned notes</button>':''}</div>`;
       root.querySelectorAll('[data-note-subject]').forEach(b=>b.onclick=()=>open(b.dataset.noteSubject));root.querySelector('[data-unassigned]')?.addEventListener('click',()=>open('unassigned'));return;
     }
     const s=current(),items=scoped(),last=items.map(n=>n.last_studied_at).filter(Boolean).sort().at(-1);
     root.innerHTML=`<div class="notebook-landing"><div class="notes-breadcrumb"><button data-choose>Subjects</button> › ${esc(s?.name||'Unassigned')} › Notes</div><header class="notes-header"><div><h1>${esc(topicScope||s?.name||'Unassigned')} Notes</h1><p>A place for your lectures, questions, and ideas.</p></div><div class="notes-header-actions"><small>${items.length} notes · ${items.filter(n=>n.is_pinned).length} pinned · Last studied ${last?new Date(last).toLocaleDateString():'not yet'}</small><button class="note-button primary" data-new-note ${!s?'disabled':''}>＋ New Note</button></div></header>${s?tabs():''}<div class="notebook-search"><input id="noteSearch" aria-label="Search notes" placeholder="Search notes in ${esc(s?.name||'Unassigned')}…" value="${esc(query)}"><div class="notes-filters">${['all','pinned','week','topic'].map(f=>`<button data-note-filter="${f}" class="${filter===f?'active':''}">${f[0].toUpperCase()+f.slice(1)}</button>`).join('')}</div></div><div class="notebook-organisation"><select id="noteTopicFilter" aria-label="Filter notes by topic"><option value="">All topics and subject notes</option><option value="__none">Subject-only notes</option>${(s?.topics||[]).map(t=>`<option value="${esc(t)}" ${t===topicFilter?'selected':''}>${esc(t)}</option>`).join('')}</select><select id="noteWeekFilter" aria-label="Filter notes by week"><option value="">All weeks</option>${[...new Set(items.map(n=>n.week).filter(Boolean))].sort((a,b)=>a-b).map(w=>`<option value="${w}" ${String(w)===weekFilter?'selected':''}>Week ${w}</option>`).join('')}</select></div><div id="notebookCards"></div></div>`;
     root.querySelector('[data-choose]').onclick=choose;root.querySelector('[data-new-note]').onclick=()=>launch();
     root.querySelector('#noteSearch').oninput=ev=>{query=ev.target.value;cards()};root.querySelectorAll('[data-note-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.noteFilter;render()});bindTabs(root);root.querySelector('#noteTopicFilter').value=topicFilter;root.querySelector('#noteTopicFilter').onchange=e=>{topicFilter=e.target.value;cards()};root.querySelector('#noteWeekFilter').onchange=e=>{weekFilter=e.target.value;cards()};cards();
   }
   function cards(){
     const items=scoped().filter(n=>(filter!=='pinned'||n.is_pinned)&&(!topicFilter||(topicFilter==='__none'?!n.topic_name:n.topic_name===topicFilter))&&(!weekFilter||String(n.week)===weekFilter)&&[n.title,plain(n),n.topic_name,n.week?'Week '+n.week:'',...(n.tags||[])].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.is_pinned-a.is_pinned||String(b.updated_at).localeCompare(String(a.updated_at)));
     const groups=new Map();for(const n of items){const name=filter==='week'?(n.week?'Week '+n.week:'Needs organisation'):(n.topic_name?'Topic · '+n.topic_name:n.week?'Subject Notes · Week '+n.week:'Needs organisation');if(!groups.has(name))groups.set(name,[]);groups.get(name).push(n)}
     const host=root.querySelector('#notebookCards');host.innerHTML=[...groups].map(([name,notes])=>`<details class="notebook-group" open><summary>${esc(name)} · ${notes.length} notes</summary><div class="notebook-cards">${notes.map(n=>`<button class="notebook-card" data-open-note="${esc(n.id)}"><span>${n.is_pinned?'⌖ Pinned':'▤ Note'}</span><h3>${esc(n.title)}</h3><p>${esc(plain(n).slice(0,130))||'Open this note and start writing.'}</p><small>${esc(n.topic_name||'General')}${n.week?' · Week '+n.week:''} · ${new Date(n.updated_at).toLocaleDateString()}</small>${!n.topic_name&&!n.week?'<small class="note-needs-organisation">Needs organisation · Open to assign Topic or Week</small>':''}</button>`).join('')}</div></details>`).join('')||`<div class="notes-empty"><h2>${scoped().length?'No matching notes':'No notes yet'}</h2><p>Create a note for your lecture, tutorial, or revision session.</p>${current()?'<button class="note-button primary" data-start>＋ Start Taking Notes</button>':''}</div>`;
     host.querySelectorAll('[data-open-note]').forEach(b=>b.onclick=()=>launch(o.notes().find(n=>n.id===b.dataset.openNote)));host.querySelector('[data-start]')?.addEventListener('click',()=>launch());
   }
   function choose(){topicScope=null;topicFilter='';weekFilter='';subject=null;o.selectSubject(null);render()}
   function open(s,noteId,topic=null){topicScope=topic;topicFilter='';weekFilter='';subject=s;query='';filter='all';if(s!=='unassigned')o.selectSubject(s);o.showNotes();render();if(noteId)launch(o.notes().find(n=>n.id===noteId))}
   async function launch(existing){
     if(active)return;
     const note=existing?{...existing,base_updated_at:existing.updated_at}:{id:id(),subject_id:subject,title:'Untitled Note',content:'',content_format:'html',week:null,topic_name:topicScope,tags:[],is_pinned:0};
     active=workspace(note,{subjects,refresh:async()=>{await o.refresh();render()},close:()=>{active=null;render()},study:async(n,kind)=>{
       const s=subjects().find(s=>s.id===n.subject_id);
       if(kind==='quick-review'){active?.dispose();await g.portalQuickReview.fromNote({...n,content:quickSource(n)});return}
       if(kind==='ask'){active?.dispose();o.askAI({...n,content:plain(n)},s);return}
       const status=await api('/api/ai/status');if(!status.online||!status.model_available)throw Error('AI Tutor is not configured yet or is unavailable. Open AI Tutor to check your provider.');
       const result=await api('/api/ai/note-study',{id:n.id,subject_id:n.subject_id,kind});
       if(kind==='summary')return result.text;
       active?.dispose();o.reviewStudy({...n,content:plain(n)},kind,result.text);
     }});
     if(existing?.subject_id)api('/api/notes/studied',{id:existing.id,subject_id:existing.subject_id}).catch(()=>{});
   }
   return {render,open,openTopic:(s,t)=>open(s,null,t),choose,onShow(){if(!active){subject=o.currentSubject()||subject;render()}},canLeave:()=>!active,resetEdit:()=>{},createNote:()=>launch(),getSubject:()=>subject,subjectNavigation(s){subject=s;topicScope=null;const host=document.getElementById('view-subject');host.querySelector('.subject-tabs')?.remove();const el=document.createElement('div');el.innerHTML=tabs();document.getElementById('subjectBanner').after(el);bindTabs(el)}};
 }
 function workspace(note,o){
   let revision=0,savedRevision=0,pending=null,timer=null,range=null,sidebar='outline',taskBusy=false,disposed=false;
   const previous=document.activeElement,lock=document.body.style.overflow,inert=[];
   const host=document.createElement('div');host.className='notebook-backdrop';
   for(const el of document.body.children)if(el.tagName!=='SCRIPT'){inert.push([el,el.inert]);el.inert=true}document.body.append(host);document.body.style.overflow='hidden';
   const btn=(label,action,extra='')=>`<button type="button" data-action="${action}" ${extra}>${label}</button>`;
   host.innerHTML=`<section class="notebook-editor" role="dialog" aria-modal="true" aria-label="Note editor"><header class="notebook-header"><div class="notebook-identity"><input id="notebookTitle" aria-label="Note title" maxlength="300" value="${esc(note.title)}"><div class="notebook-meta"><select id="notebookSubject" aria-label="Subject">${!note.subject_id?'<option value="">Choose subject</option>':''}${o.subjects().map(s=>`<option value="${esc(s.id)}" ${s.id===note.subject_id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><select id="notebookTopic" aria-label="Topic"></select><input id="notebookWeek" type="number" min="1" max="100" placeholder="Week" aria-label="Week" value="${note.week||''}"><span id="notebookStatus" role="status">${note.updated_at?'Saved':'New note · start writing'}</span></div></div><div class="notebook-actions">${btn('✎ Handwriting · Coming Soon','handwriting')}${btn(note.is_pinned?'⌖ Pinned':'⌖ Pin','pin',`aria-pressed="${!!note.is_pinned}"`)}${btn('⛶ Full Screen','fullscreen')}${btn('••• More','more')}${btn('Save','save','class="primary"')}${btn('×','close','aria-label="Close note editor"')}</div></header><div class="notebook-toolbar" role="toolbar" aria-label="Note formatting"><select id="notebookHeading" aria-label="Heading style"><option value="p">Normal text</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option></select>${[['B','bold'],['I','italic'],['U','underline'],['S̶','strikeThrough'],['• List','insertUnorderedList'],['1. List','insertOrderedList'],['☑','checklist'],['Highlight','highlight'],['‹/›','inlinecode'],['Code','code'],['Callout','callout'],['Image','image'],['Link','link'],['Quote','quote'],['↶','undo'],['↷','redo'],['☰ Sidebar','sidebar']].map(([l,a])=>btn(l,a,`title="${a}" aria-label="${a}"`)).join('')}</div><div class="notebook-layout"><div class="notebook-paper-scroll"><div id="notebookDocument" class="notebook-document" contenteditable="true" role="textbox" aria-label="Note content" aria-multiline="true" spellcheck="true"></div></div><aside class="notebook-side"><nav>${['outline','templates','study'].map(t=>btn(t==='study'?'Study Tools':t[0].toUpperCase()+t.slice(1),'tab-'+t)).join('')}</nav><div id="notebookPanel"></div><h4>Quick Insert</h4><div class="notebook-inserts">${[['Heading','heading'],['Callout','callout'],['Code Block','code'],['Checklist','checklist'],['Image','image'],['Divider','divider']].map(([l,a])=>btn('＋ '+l,a)).join('')}</div></aside></div><footer><span id="notebookCount"></span><span id="notebookEdited">${note.updated_at?'Last edited '+new Date(note.updated_at).toLocaleString():'Not saved yet'}</span></footer><input id="notebookImage" type="file" accept="image/png,image/jpeg,image/webp" hidden><div id="notebookDialog" hidden></div></section>`;
   const $=s=>host.querySelector(s),doc=$('#notebookDocument'),title=$('#notebookTitle'),status=$('#notebookStatus');
   const saveError=document.createElement('section');saveError.id='notebookSaveError';saveError.className='notebook-save-error';saveError.hidden=true;saveError.setAttribute('role','alert');saveError.setAttribute('aria-atomic','true');
   saveError.innerHTML='<div><strong>⚠ Note not saved</strong><p id="notebookSaveErrorReason"></p><small>Your changes are still in this editor. Fix the issue and retry before leaving.</small></div><button type="button" id="notebookFixSave">Fix issue</button><button type="button" id="notebookRetrySave">Retry save</button>';
   $('.notebook-header').after(saveError);let errorField=null;
   function showSaveError(message,field=null){
     errorField=field;saveError.hidden=false;$('#notebookSaveErrorReason').textContent=message;status.textContent='Not saved · action needed';status.classList.add('save-failed');
     host.querySelectorAll('[aria-invalid="true"]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby')});
     if(field){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','notebookSaveErrorReason')}
     $('#notebookFixSave').hidden=!field;const button=$('[data-action=save]');button.textContent='⚠ Retry save';button.classList.add('save-failed');
     const overlay=$('#notebookDialog');if(!overlay.hidden){let alert=overlay.querySelector('.notebook-dialog-save-error');if(!alert){alert=document.createElement('p');alert.className='notebook-dialog-save-error';alert.setAttribute('role','alert');overlay.querySelector('.notebook-dialog-actions').before(alert)}alert.textContent='Note not saved: '+message}
   }
   function clearSaveError(){saveError.hidden=true;errorField=null;status.classList.remove('save-failed');const button=$('[data-action=save]');button.textContent='Save';button.classList.remove('save-failed');host.querySelectorAll('[aria-invalid="true"]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby')});host.querySelector('.notebook-dialog-save-error')?.remove()}
   $('#notebookFixSave').onclick=()=>{errorField?.focus();errorField?.scrollIntoView({block:'nearest'})};$('#notebookRetrySave').onclick=()=>save();
   doc.innerHTML=html(note)||'<p><br></p>';
   const recoveryPrefix='notebook.draft.'+(document.querySelector('meta[name=portal-account]')?.content||'local')+'.'+(note.subject_id||'unassigned')+'.';
   let recoveryKey=recoveryPrefix+note.id,recovery=null;
   try{recovery=JSON.parse(localStorage.getItem(recoveryKey)||'null');if(!recovery&&!note.updated_at){const key=Object.keys(localStorage).find(k=>k.startsWith(recoveryPrefix));if(key)recovery=JSON.parse(localStorage.getItem(key))}}catch{}
   function clearRecovery(){try{const value=JSON.parse(localStorage.getItem(recoveryKey)||'null');if(value?.id===note.id)localStorage.removeItem(recoveryKey)}catch{}}
   function topics(){const names=o.subjects().find(s=>s.id===$('#notebookSubject').value)?.topics||[];$('#notebookTopic').innerHTML='<option value="">No topic</option>'+names.map(t=>`<option ${t===note.topic_name?'selected':''}>${esc(t)}</option>`).join('')}
   topics();
   function snapshot(){return {...note,title:title.value.trim()||'Untitled Note',subject_id:$('#notebookSubject').value,topic_name:$('#notebookTopic').value||null,week:$('#notebookWeek').value||null,content:sanitize(doc.innerHTML),content_format:'html'}}
   function update(){
     $('#notebookCount').textContent='Word count: '+(doc.innerText.trim().match(/\S+/g)||[]).length;
     if(sidebar==='outline')panel();
   }
   function changed(){revision++;if(saveError.hidden)status.textContent='Unsaved changes';try{localStorage.setItem(recoveryKey,JSON.stringify(snapshot()))}catch{status.textContent='Unsaved changes · Local recovery unavailable; please save before leaving.'}clearTimeout(timer);timer=setTimeout(()=>save(),1500);update()}
   async function save(){
     clearTimeout(timer);if(pending){const ok=await pending;return ok&&revision!==savedRevision?save():ok}
     if(revision===savedRevision&&note.updated_at)return true;
     if(!$('#notebookWeek').checkValidity()){showSaveError('Week must be a whole number from 1 to 100, or blank.',$('#notebookWeek'));return false}
     const version=revision,data=snapshot();if(!data.subject_id){showSaveError('Choose a subject for this note.',$('#notebookSubject'));return false}if(!note.updated_at&&!data.topic_name&&!data.week){showSaveError('Choose a Topic or enter a Week before saving this new note.',$('#notebookTopic'));return false}status.textContent='Saving…';$('[data-action=save]').textContent='Saving…';$('#notebookRetrySave').disabled=true;
     pending=(async()=>{try{
       const result=await api('/api/portal',{table:'notes',item:data});note={...result.note,is_pinned:note.is_pinned,tags:note.tags,base_updated_at:result.note.updated_at};savedRevision=version;
       if(revision===version)clearRecovery();else try{localStorage.setItem(recoveryKey,JSON.stringify(snapshot()))}catch{}
       clearSaveError();status.textContent=revision===version?'Saved':'Unsaved changes';$('#notebookEdited').textContent='Last edited '+new Date(note.updated_at).toLocaleString();try{await o.refresh()}catch{status.textContent='Saved · Library refresh failed; reopen the library to refresh.'}return true;
     }catch(err){showSaveError(err.message||'The server could not save your note. Check your connection and retry.');return false}finally{pending=null;$('#notebookRetrySave').disabled=false}})();
     const ok=await pending;return ok&&revision!==savedRevision?save():ok;
   }
   function dispose(){if(disposed)return;disposed=true;clearTimeout(timer);host.remove();document.body.style.overflow=lock;inert.forEach(([el,value])=>el.inert=value);document.removeEventListener('selectionchange',selection);window.removeEventListener('beforeunload',unload);document.removeEventListener('keydown',keys,true);o.close();if(previous?.isConnected)previous.focus()}
   function dialog(heading,body,actions){const overlay=$('#notebookDialog');overlay.hidden=false;overlay.innerHTML=`<div class="notebook-dialog" role="alertdialog" aria-modal="true" aria-label="${esc(heading)}"><h3>${esc(heading)}</h3><div>${body}</div><div class="notebook-dialog-actions">${actions.map(([l])=>`<button type="button">${l}</button>`).join('')}</div></div>`;overlay.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>actions[i][1]());overlay.querySelector('button')?.focus()}
   const dismiss=()=>{$('#notebookDialog').hidden=true;doc.focus()};
   async function close(){if(taskBusy){status.textContent='Please wait for the current operation to finish.';return}clearTimeout(timer);if(pending)await pending;if(revision===savedRevision){dispose();return}dialog('You have unsaved changes.','<p>Save your note before closing, or keep writing.</p>',[['Keep Editing',dismiss],['Discard Changes',()=>{clearRecovery();dispose()}],['Save & Close',async()=>{if(await save())dispose()}]])}
   function selection(){const s=getSelection();if(s.rangeCount&&doc.contains(s.anchorNode)&&doc.contains(s.focusNode))range=s.getRangeAt(0).cloneRange()}
   document.addEventListener('selectionchange',selection);
   function restore(){doc.focus();if(range&&doc.contains(range.commonAncestorContainer)){const s=getSelection();s.removeAllRanges();s.addRange(range)}}
   function command(name,value=null){restore();document.execCommand('styleWithCSS',false,false);document.execCommand(name,false,value);selection();changed()}
   const insert=markup=>command('insertHTML',sanitize(markup));
   function selectedText(){return range?.toString()||''}
   function panel(){
     const el=$('#notebookPanel');
     if(sidebar==='outline'){const heads=[...doc.querySelectorAll('h1,h2,h3')];el.innerHTML=heads.length?heads.map((h,i)=>`<button class="notebook-outline" data-heading="${i}" style="padding-left:${(Number(h.tagName[1])-1)*10+6}px">${esc(h.textContent||'Untitled heading')}</button>`).join(''):'<p class="muted">Add headings to build your outline.</p>';el.querySelectorAll('[data-heading]').forEach(b=>b.onclick=()=>heads[+b.dataset.heading].scrollIntoView({block:'start',behavior:'smooth'}))}
     if(sidebar==='templates'){el.innerHTML=Object.keys(templates).map(t=>`<button data-template="${t}">${t} →</button>`).join('');el.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{const t=b.dataset.template,markup='<h1>'+t+'</h1>'+templates[t].map(h=>'<h2>'+h+'</h2><p><br></p>').join('');dialog('Preview: '+t,`<div class="notebook-template-preview">${markup}</div><p>Append this editable structure to your note. Existing content will be kept.</p>`,[['Cancel',dismiss],['Append template',()=>{dismiss();const r=document.createRange();r.selectNodeContents(doc);r.collapse(false);range=r;insert(markup)}]])})}
     if(sidebar==='study'){el.innerHTML=[['Create Quick Review','quick-review'],['Convert to Flashcards','flashcards'],['Generate Quiz','quiz'],['Ask AI about this Note','ask'],['Create Summary','summary']].map(([l,k])=>`<button data-study-tool="${k}">${l}</button>`).join('')+'<p class="muted">Quick Review works manually; the other tools use your connected AI provider. Review generated material before importing.</p>';el.querySelectorAll('[data-study-tool]').forEach(b=>b.onclick=async()=>{if(taskBusy)return;if(!await save())return;taskBusy=true;doc.contentEditable='false';host.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);status.textContent=b.dataset.studyTool==='quick-review'?'Opening Quick Review…':'AI is working…';try{const result=await o.study(note,b.dataset.studyTool);if(result&&!disposed)dialog('AI summary — review for accuracy',`<pre class="notebook-summary">${esc(result)}</pre>`,[['Close',dismiss]]);if(!disposed)status.textContent='Saved · AI response ready'}catch(err){if(!disposed)status.textContent=err.message}finally{taskBusy=false;if(!disposed){doc.contentEditable='true';host.querySelectorAll('button,input,select').forEach(el=>el.disabled=false)}}})}
   }
   async function image(file){if(!file)return;if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){status.textContent='Use a PNG, JPG or WebP under 5 MB.';return}taskBusy=true;status.textContent='Uploading image…';try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const result=await api('/api/notes/upload',{image:data});insert(`<p><img src="${esc(result.url)}" alt="${esc(file.name)}"></p><p><br></p>`)}catch(err){status.textContent='Image upload failed: '+err.message}finally{taskBusy=false}}
   const actions={
     save,close,handwriting:()=>dialog('✎ Handwriting Notes — Coming Soon','<p>Future versions will support pen, pencil, drawing, handwriting and touch/stylus input.</p>',[['Close',dismiss]]),
     pin:()=>{note.is_pinned=note.is_pinned?0:1;const b=$('[data-action=pin]');b.textContent=note.is_pinned?'⌖ Pinned':'⌖ Pin';b.setAttribute('aria-pressed',String(!!note.is_pinned));changed()},
     fullscreen:()=>{const full=$('.notebook-editor').classList.toggle('fullscreen');$('[data-action=fullscreen]').textContent=full?'Exit Full Screen':'⛶ Full Screen'},
     sidebar:()=>{const hidden=$('.notebook-editor').classList.toggle('side-hidden');try{localStorage.setItem('notebook.hideSidebar',String(hidden))}catch{}},
     heading:()=>command('formatBlock','h2'),quote:()=>command('formatBlock','blockquote'),divider:()=>insert('<hr><p><br></p>'),
     checklist:()=>insert('<ul><li><input type="checkbox"> '+esc(selectedText()||'Task')+'</li></ul><p><br></p>'),
     highlight:()=>insert('<mark>'+esc(selectedText()||'Highlighted text')+'</mark>'),inlinecode:()=>insert('<code>'+esc(selectedText()||'code')+'</code>'),
     code:()=>insert('<pre><code>'+esc(selectedText()||'Write code here')+'</code></pre><p><br></p>'),
     callout:()=>dialog('Insert a study callout','<p>Choose a callout type.</p>',[['Cancel',dismiss],...Object.entries({takeaway:'💡 Key Takeaway',important:'⚠ Important',tip:'✓ Exam Tip',example:'✎ Example',question:'? Question'}).map(([k,l])=>[l,()=>{dismiss();insert(`<aside data-callout="${k}"><b>${l}</b><p>${esc(selectedText()||'Your key idea')}</p></aside><p><br></p>`)}])]),
     image:()=>$('#notebookImage').click(),link:()=>dialog('Insert link','<label>URL (https:// or mailto:)<input id="notebookLink" type="url" placeholder="https://…"></label>',[['Cancel',dismiss],['Insert',()=>{const url=$('#notebookLink').value.trim();if(!/^(https?:\/\/|mailto:)/i.test(url)){status.textContent='Use an https://, http:// or mailto: link.';return}const label=selectedText()||url;dismiss();insert(`<a href="${esc(url)}">${esc(label)}</a>`)}]]),
     more:()=>dialog('Note actions','<p>Organise, export, or manage this note.</p>',[['Close',dismiss],['Rename',()=>{dismiss();title.focus()}],['Move to Topic',()=>{dismiss();$('#notebookTopic').focus()}],['Change Week',()=>{dismiss();$('#notebookWeek').focus()}],['Edit tags',()=>dialog('Tags',`<input id="notebookTags" value="${esc((note.tags||[]).join(', '))}" aria-label="Tags, comma separated">`,[['Cancel',dismiss],['Apply',()=>{note.tags=$('#notebookTags').value.split(',').map(s=>s.trim()).filter(Boolean);dismiss();changed()}]])],['Duplicate Note',async()=>{if(!await save())return;try{await api('/api/portal',{table:'notes',item:{...snapshot(),id:id(),title:snapshot().title+' (copy)',base_updated_at:null}});await o.refresh();dismiss();status.textContent='Saved · Duplicate created in your library'}catch(err){status.textContent=err.message}}],['Export HTML',()=>{const content=snapshot();const blob=new Blob(['<!doctype html><meta charset="utf-8"><title>'+esc(content.title)+'</title><h1>'+esc(content.title)+'</h1>'+content.content],{type:'text/html'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=content.title.replace(/[^\w -]/g,'_')+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);dismiss();status.textContent='Exported HTML. Images remain linked to this portal.'}],['Delete Note',()=>dialog('Delete this note?','<p>This cannot be undone.</p>',[['Keep note',dismiss],['Delete',async()=>{clearTimeout(timer);if(pending)await pending;try{await api('/api/portal/delete',{table:'notes',id:note.id});await o.refresh();dispose()}catch(err){status.textContent=err.message}}]])]])
   };
   host.querySelectorAll('[data-action]').forEach(b=>{b.onmousedown=ev=>ev.preventDefault();b.onclick=()=>{const a=b.dataset.action;if(a.startsWith('tab-')){sidebar=a.slice(4);panel()}else if(actions[a])actions[a]();else command(a)}});
   $('#notebookHeading').onchange=ev=>command('formatBlock',ev.target.value);$('#notebookImage').onchange=ev=>{image(ev.target.files[0]);ev.target.value=''};
   [title,$('#notebookWeek'),$('#notebookTopic')].forEach(el=>el.oninput=changed);$('#notebookSubject').onchange=()=>{note.topic_name=null;topics();changed()};
   doc.oninput=changed;doc.addEventListener('change',ev=>{if(ev.target.type==='checkbox'){ev.target.toggleAttribute('checked',ev.target.checked);changed()}});
   doc.onpaste=ev=>{ev.preventDefault();const file=[...ev.clipboardData.files].find(f=>f.type.startsWith('image/'));if(file){image(file);return}const rich=ev.clipboardData.getData('text/html');insert(rich?sanitize(rich):esc(ev.clipboardData.getData('text/plain')).replace(/\n/g,'<br>'))};
   doc.ondrop=ev=>{ev.preventDefault();const file=ev.dataTransfer.files[0];if(file)image(file);else insert(esc(ev.dataTransfer.getData('text/plain')))};
   function unload(ev){if(revision!==savedRevision||pending){ev.preventDefault();ev.returnValue=''}}window.addEventListener('beforeunload',unload);
   function keys(ev){
     if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();save();return}
     if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();if(!$('#notebookDialog').hidden)dismiss();else close();return}
     if((ev.ctrlKey||ev.metaKey)&&doc.contains(ev.target)){const cmd={b:'bold',i:'italic',u:'underline',z:ev.shiftKey?'redo':'undo'}[ev.key.toLowerCase()];if(cmd){ev.preventDefault();command(cmd)}}
     if(ev.key==='Tab'){const box=$('#notebookDialog').hidden?host:$('#notebookDialog'),els=[...box.querySelectorAll('button,input,select,[contenteditable]')].filter(el=>!el.disabled&&el.offsetParent!==null);if(ev.shiftKey&&document.activeElement===els[0]){ev.preventDefault();els.at(-1).focus()}else if(!ev.shiftKey&&document.activeElement===els.at(-1)){ev.preventDefault();els[0].focus()}}
   }document.addEventListener('keydown',keys,true);
   try{if(localStorage.getItem('notebook.hideSidebar')==='true'||innerWidth<700)$('.notebook-editor').classList.add('side-hidden')}catch{}
   update();doc.focus();
   if(recovery&&(recovery.id===note.id||!note.updated_at))dialog('Recover unsaved draft?','<p>A local recovery copy was found for this subject. Restore it to the editor, then save it to SQLite. If another device changed the note, saving will report a conflict rather than overwrite it.</p>',[['Not now',dismiss],['Restore draft',()=>{note={...recovery};recoveryKey=recoveryPrefix+note.id;title.value=note.title;$('#notebookSubject').value=note.subject_id;topics();$('#notebookWeek').value=note.week||'';doc.innerHTML=html(note);$('[data-action=pin]').textContent=note.is_pinned?'⌖ Pinned':'⌖ Pin';dismiss();changed()}]]);
   return {dispose};
 }
 g.StudentNotebook={createNotes,sanitize,plain};
})(window);
