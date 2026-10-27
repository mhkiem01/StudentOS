/* Live note sharing with friends: share from a note's ••• menu, a card arrives in Messages, and friends
   view (or, with permission, edit) the owner's note live. The note stays in its owner's notebook;
   see backend/social/note_shares.py. Changes arrive through the Socialise live channel ("portal-live"). */
(function(g){'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function create(o){
 let data={enabled:false,owned:[],received:[],friends:[]},loads=0;
 const watchers=new Map(),dialog=document.createElement('dialog');dialog.className='share-dialog';document.body.append(dialog);
 async function api(path,payload){
  let r;
  try{r=await fetch(path,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})}
  catch{throw Error('The portal could not be reached. Check this device is online, then try again.')}
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw Error(j?.error||([502,503,504].includes(r.status)?`The portal server did not answer (error ${r.status}). Make sure it is running, then try again.`:`Note sharing could not be updated (error ${r.status}).`));
  return j||{};
 }
 const post=(action,id,d={})=>api('/api/note-shares',{action,id,data:d});
 async function load(){const mine=++loads,fresh=await api('/api/note-shares');if(mine!==loads)return;data=fresh;o.refresh?.();cards()}
 const received=id=>data.received.find(r=>r.id===id),owned=id=>data.owned.find(r=>r.id===id);
 const savedIn=sid=>data.received.filter(r=>r.saved_subject===sid&&!r.missing);
 function toast(text){let el=document.getElementById('shareToast');if(!el){el=document.createElement('p');el.id='shareToast';el.className='share-toast';el.setAttribute('role','status');document.body.append(el)}el.textContent=text;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,6000)}

 /* Live updates */
 function watch(key,fn){if(!watchers.has(key))watchers.set(key,new Set());watchers.get(key).add(fn);return ()=>watchers.get(key)?.delete(fn)}
 async function changed(e){
  if(e.share){
   const fns=watchers.get('share:'+e.share);
   if(fns?.size){let next={deleted:true};if(!e.deleted)try{next=(await api('/api/note-shares/'+e.share)).note}catch{}fns.forEach(fn=>fn(next))}
   load().catch(()=>{});
  }else{
   const fns=watchers.get('note:'+e.note);
   if(fns?.size){await o.reloadOwn();const n=o.ownNote(e.note);fns.forEach(fn=>fn(n||{deleted:true}))}
  }
 }
 g.addEventListener('portal-live',ev=>{const e=ev.detail||{};if(e.type==='note_shares'||e.type==='reset')load().catch(()=>{});else if(e.type==='note')changed(e)});

 /* Open a note a friend shared with you. */
 async function open(id){
  let r;try{r=await api('/api/note-shares/'+id)}catch(err){toast(err.message);load().catch(()=>{});return}
  const s=r.share;if(s.role==='owner'){o.openOwn(s.note_id);return}
  const item=received(id)||s;
  const shared={id,mode:s.permission==='edit'?'edit':'view',ownerName:s.owner_name,request:!!s.request,saved:!!item.saved_subject,
   requestEdit:()=>post('request',id).then(load),saveToSubjects:()=>saveDialog(id),leave:()=>post('leave',id).then(load),
   unsave:()=>post('save',id,{subject_id:null}).then(load).then(()=>toast('Removed from your subjects. It is still in your messages.'))};
  const ok=o.notes().openShared(r,{shared,refresh:()=>load(),watch:fn=>watch('share:'+id,fn),
   saveNote:async d=>({note:(await post('edit',id,{title:d.title,content:d.content,base_updated_at:d.base_updated_at})).note}),
   upload:async image=>(await post('upload',id,{image})).url,
   // Handwriting pages are read from (and, with edit permission, saved to) the owner's notebook through the share.
   ink:{load:async page=>{const r=await fetch('/api/note-shares/'+id+'/ink/'+page);if(!r.ok)throw Error('This handwriting page could not be loaded.');return r.text()},save:async ink=>(await post('ink',id,{ink})).id}});
  if(ok===false)toast('Close the note you are editing first.');
 }

 /* Small dialogs */
 function frame(title,eyebrow,body,footer){dialog.innerHTML=`<form class="share-inner"><header><div>${eyebrow?`<span class="share-eyebrow">${eyebrow}</span>`:''}<h2>${title}</h2></div><button type="button" class="share-x" data-close aria-label="Close">×</button></header>${body}<p class="share-error" role="alert"></p><footer>${footer}</footer></form>`;dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());
  // The note editor makes the rest of the page inert while open; this window must stay usable above it.
  dialog.inert=false;document.body.append(dialog);if(!dialog.open)dialog.showModal();return dialog.querySelector('form')}
 const fail=(form,err)=>form.querySelector('.share-error').textContent=err.message;
 function saveDialog(id){
  return new Promise(resolve=>{
   const r=received(id),subjects=o.subjects();
   if(!subjects.length){toast('Create a subject first, then save the note into it.');return resolve(false)}
   const form=frame('Save to my subjects','📄 Shared note',`<p>“${E(r?.title||'This note')}” will appear in that subject’s Notes and stay live: you always see ${E(r?.owner_name||'the owner')}’s latest version.</p><label>Subject<select name="subject">${subjects.map(s=>`<option value="${E(s.id)}" ${s.id===r?.saved_subject?'selected':''}>${E(s.name)}</option>`).join('')}</select></label><label>Topic (optional)<select name="topic"></select></label>`,'<button type="button" class="btn secondary" data-close>Cancel</button><button class="btn primary">Save to my subjects</button>');
   const fill=()=>{const s=subjects.find(x=>x.id===form.elements.subject.value);form.elements.topic.innerHTML='<option value="">No topic</option>'+(s?.topics||[]).map(t=>`<option ${t===r?.saved_topic?'selected':''}>${E(t)}</option>`).join('')};fill();form.elements.subject.onchange=fill;
   dialog.addEventListener('close',()=>resolve(false),{once:true});
   form.onsubmit=async ev=>{ev.preventDefault();try{await post('save',id,{subject_id:form.elements.subject.value,topic_name:form.elements.topic.value||null});await load();const name=subjects.find(x=>x.id===form.elements.subject.value)?.name;resolve(true);dialog.close();toast(`Saved to ${name}. Find it under that subject’s Notes.`)}catch(err){fail(form,err)}};
  });
 }
 function shareDialog(note){
  if(!data.enabled){frame('Share with friends','👥 Share live','<p>Turn on Socialise in Settings to share notes with friends.</p>','<button type="button" class="btn primary" data-close>OK</button>');return}
  const existing=data.owned.filter(x=>x.note_id===note.id),choices=data.friends.filter(f=>!existing.some(x=>x.recipient===f.id));
  const form=frame(`Share “${E(note.title)}”`,'👥 Share live',`<p class="muted">Friends get it in Messages. They always see your latest saved version.</p>
   ${existing.length?`<section><h3>Shared with</h3><ul class="share-people">${existing.map(x=>`<li><b>${E(x.recipient_name)}</b>${x.request?'<small class="share-request">Asked to edit</small>':''}<select data-share-permission="${x.id}" aria-label="What ${E(x.recipient_name)} can do"><option value="view" ${x.permission==='view'?'selected':''}>View only</option><option value="edit" ${x.permission==='edit'?'selected':''}>Can edit</option></select><button type="button" class="btn secondary small" data-share-revoke="${x.id}">Stop sharing</button></li>`).join('')}</ul></section>`:''}
   <section><h3>${existing.length?'Share with more friends':'Choose friends'}</h3>${choices.length?`<div class="share-friends">${choices.map(f=>`<label><input type="checkbox" name="friend" value="${E(f.id)}"> ${E(f.name)}</label>`).join('')}</div><label>They can<select name="permission"><option value="view">View only</option><option value="edit">Edit</option></select></label>`:`<p class="muted">${data.friends.length?'All your friends already have this note.':'You have no friends on Socialise yet. Add them in Socialise → Find People.'}</p>`}</section>`,
   `<button type="button" class="btn secondary" data-close>Close</button>${choices.length?'<button class="btn primary">Share</button>':''}`);
  form.querySelectorAll('[data-share-permission]').forEach(sel=>sel.onchange=async()=>{try{await post('permission',sel.dataset.sharePermission,{permission:sel.value});await load();toast('Updated.')}catch(err){fail(form,err)}});
  form.querySelectorAll('[data-share-revoke]').forEach(b=>b.onclick=async()=>{if(!confirm('Stop sharing this note with this friend? They will no longer see it.'))return;try{await post('revoke',b.dataset.shareRevoke);await load();shareDialog(note)}catch(err){fail(form,err)}});
  form.onsubmit=async ev=>{ev.preventDefault();const picked=[...form.querySelectorAll('[name=friend]:checked')].map(x=>x.value);if(!picked.length)return fail(form,Error('Choose at least one friend.'));
   try{await post('share',null,{note_id:note.id,recipients:picked,permission:form.elements.permission.value});await load();dialog.close();toast(`Shared with ${picked.map(id=>data.friends.find(f=>f.id===id)?.name).join(', ')}. They will find it in Messages.`)}catch(err){fail(form,err)}};
 }

 /* Cards inside Messages: they update themselves whenever sharing changes. */
 function cardInner(att,mine){
  const r=received(att.share),s=owned(att.share),title=E(r?.title||att.title||'Shared note');
  if(att.kind==='note_share'){
   if(mine)return `<span class="share-icon" aria-hidden="true">📄</span><div><b>${title}</b><small>${s?`Shared with ${E(s.recipient_name)} · ${s.permission==='edit'?'Can edit':'View only'} · Live`:'No longer shared'}</small></div>${s?`<button type="button" class="soc-button" data-share-own="${E(s.note_id)}">Open</button><button type="button" class="soc-button" data-share-manage="${E(s.note_id)}">Manage</button>`:''}`;
   if(!r)return `<span class="share-icon" aria-hidden="true">📄</span><div><b>${title}</b><small>This note is no longer shared with you.</small></div>`;
   return `<span class="share-icon" aria-hidden="true">📄</span><div><b>${title}</b><small>Shared by ${E(r.owner_name)} · ${r.permission==='edit'?'You can edit':'View only'} · Live</small></div><button type="button" class="soc-button soc-primary" data-share-open="${r.id}">Open</button><button type="button" class="soc-button" data-share-save="${r.id}">${r.saved_subject?'✓ In your subjects':'Save to my subjects'}</button>${r.permission==='view'?`<button type="button" class="soc-button" data-share-request="${r.id}" ${r.request?'disabled':''}>${r.request?'Edit requested':'Ask to edit'}</button>`:''}`;
  }
  if(att.kind==='note_edit_request'){
   if(mine)return `<span class="share-icon" aria-hidden="true">✋</span><div><b>${title}</b><small>${r?(r.permission==='edit'?'You can edit it now':r.request?'Waiting for an answer':'Kept view only'):'No longer shared'}</small></div>`;
   return `<span class="share-icon" aria-hidden="true">✋</span><div><b>${title}</b><small>${s?(s.request?'Wants to edit your note':s.permission==='edit'?'Editing allowed ✓':'Kept view only'):'No longer shared'}</small></div>${s?.request?`<button type="button" class="soc-button soc-primary" data-share-allow="${s.id}">Allow editing</button><button type="button" class="soc-button" data-share-decline="${s.id}">Keep view only</button>`:''}`;
  }
  if(att.kind==='note_access'&&!mine&&r)return `<span class="share-icon" aria-hidden="true">📄</span><div><b>${title}</b><small>${r.permission==='edit'?'You can edit':'View only'} · Live</small></div><button type="button" class="soc-button" data-share-open="${r.id}">Open note</button>`;
  return '';
 }
 function card(att,mine){if(!att||!['note_share','note_edit_request','note_access'].includes(att.kind))return '';return `<div class="share-card" data-note-card="${E(JSON.stringify(att))}" data-mine="${mine?1:0}">${cardInner(att,mine)}</div>`}
 function cards(){document.querySelectorAll('[data-note-card]').forEach(el=>{try{el.innerHTML=cardInner(JSON.parse(el.dataset.noteCard),el.dataset.mine==='1')}catch{}})}
 document.addEventListener('click',async ev=>{
  const b=ev.target.closest('.share-card button');if(!b)return;const d=b.dataset;
  try{
   if(d.shareOpen)await open(d.shareOpen);
   else if(d.shareSave)await saveDialog(d.shareSave);
   else if(d.shareRequest){b.disabled=true;await post('request',d.shareRequest);await load();toast('Asked to edit. You will see the answer here.')}
   else if(d.shareAllow){await post('permission',d.shareAllow,{permission:'edit'});await load();toast('They can edit this note now.')}
   else if(d.shareDecline){await post('decline',d.shareDecline);await load()}
   else if(d.shareOwn)o.openOwn(d.shareOwn);
   else if(d.shareManage){const n=o.ownNote(d.shareManage);if(n)shareDialog(n)}
  }catch(err){toast(err.message);b.disabled=false}
 });
 return {load,savedIn,open,shareDialog,saveDialog,card,watchOwn:(id,fn)=>watch('note:'+id,fn)};
}
g.StudentNoteShares={create};
})(window);
