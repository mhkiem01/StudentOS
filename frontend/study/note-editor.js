/* Notebook workspace: rich documents, shared Notes API, no remote dependencies. */
(function(g){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const id=()=>g.crypto?.randomUUID?.()||'note_'+Date.now()+'_'+Math.random().toString(36).slice(2);
 const allowed=new Set('P DIV BR H1 H2 H3 H4 H5 H6 STRONG B EM I U S STRIKE UL OL LI BLOCKQUOTE PRE CODE MARK ASIDE HR A IMG INPUT SPAN FIGURE'.split(' '));
 const COLOR_RE=/^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$/i,SIZE_RE=/^(\d{1,3}(\.\d+)?(px|pt|rem|em|%)|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/i;
 // Spacing from the toolbar: line spacing (a multiple or a length), letter spacing, and space before/after paragraphs.
 const LINE_RE=/^(\d(\.\d+)?|\d{1,3}(\.\d+)?(px|pt|em|%)|normal)$/i,LETTER_RE=/^(-?\d{1,2}(\.\d+)?(px|pt|em)|0|normal)$/i,GAP_RE=/^(\d{1,3}(\.\d+)?(px|pt|em)|0)$/i;
 const STYLES=[['color',COLOR_RE],['font-size',SIZE_RE],['line-height',LINE_RE],['letter-spacing',LETTER_RE],['margin-top',GAP_RE],['margin-bottom',GAP_RE]];
 function safeStyle(el){const st=el.style;if(!st)return '';return STYLES.flatMap(([p,re])=>{const v=st.getPropertyValue(p);return v&&re.test(v)?[p+':'+v]:[]}).join(';')}
 function sanitize(html){
   const t=document.createElement('template');t.innerHTML=String(html||'');
   function clean(parent){for(const el of [...parent.children]){
     if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','TEMPLATE'].includes(el.tagName)){el.remove();continue}
     // A handwriting page (handwriting.js) is only a reference to its file; the picture inside is added when shown.
     if(el.tagName==='FIGURE'){const ink=el.getAttribute('data-ink')||'';if(!/^[a-f0-9]{32}$/.test(ink)){el.remove();continue}el.replaceChildren();for(const a of [...el.attributes])el.removeAttribute(a.name);el.setAttribute('data-ink',ink);continue}
     clean(el);if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);continue}
     const attrs={};
     if(el.tagName==='A'&&/^(https?:\/\/|mailto:)/i.test((el.getAttribute('href')||'').trim()))Object.assign(attrs,{href:el.getAttribute('href'),target:'_blank',rel:'noopener noreferrer'});
     if(el.tagName==='IMG'){if(!/^\/api\/(notes|note-shares\/[a-f0-9]{32})\/images\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(el.getAttribute('src')||'')){el.remove();continue}attrs.src=el.getAttribute('src');attrs.alt=el.getAttribute('alt')||'Image'}
     if(el.tagName==='INPUT'){if(el.type!=='checkbox'){el.remove();continue}attrs.type='checkbox';if(el.checked||el.hasAttribute('checked'))attrs.checked='checked'}
     if(el.tagName==='ASIDE')attrs['data-callout']=['takeaway','important','tip','example','question'].includes(el.dataset.callout)?el.dataset.callout:'takeaway';
     const style=safeStyle(el);if(style)attrs.style=style;
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
 // Page layout shared by page view and book view, like a word processor: every line of text sits inside a page's
 // margins. A full-width float whose shape covers each page break (bottom margin, gap, next page's top margin) moves
 // any line that would cross a break onto the next page, so paragraphs split between lines and the note's HTML is
 // never changed. Margin pushes then keep headings with the text after them, keep code blocks, callouts, quotes and
 // paragraphs of up to three lines in one piece, and stop a paragraph leaving only its first line on a page.
 const PAGE={w:720,h:880,top:64,bottom:72,side:64,gap:28};
 // Font sizes in points, as in Word's list; sizes are capped at 144 pt so that every line fits on one page.
 const SIZES=[8,9,10,10.5,11,12,14,16,18,20,22,24,26,28,36,48,72],MAX_PT=144,WORD_LINE=1.2;
 // Page number (from 0) of a position measured from the top of the first page; a page break counts as the next page.
 const pageIndex=(y,p)=>Math.max(0,Math.floor((y+p.bottom+p.gap)/(p.h+p.gap)));
 // cuts: pages that end early (at that position), so a paragraph's last line does not stand alone on the next page.
 function pageBands(root,p,n,cuts=new Map()){
   const step=p.h+p.gap,room=p.h-p.top-p.bottom,pts=['100% 0'];
   for(let k=0;k<n-1;k++){const a=cuts.get(k)??k*step+room,b=(k+1)*step;pts.push(`100% ${a}px`,`0 ${a}px`,`0 ${b}px`,`100% ${b}px`)}
   root.style.setProperty('--page-shape',n>1?`polygon(${pts.join(',')})`:'none');root.style.setProperty('--page-float',n>1?(n-1)*step+'px':'0px');
 }
 // Boxes of the text, line breaks, images, checkboxes and rules inside an element, in document order. With last, only
 // the boxes of the last such piece.
 function drawn(el,max=Infinity,last=false){
   const out=[],range=document.createRange(),walk=document.createTreeWalker(el,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
   let n=el;if(last){while(n.lastChild)n=n.lastChild;walk.currentNode=n}else n=walk.nextNode();
   for(;n&&n!==el&&out.length<max;n=last?walk.previousNode():walk.nextNode()){
     let rects=[];
     if(n.nodeType===3){if(!n.data.trim())continue;range.selectNodeContents(n);rects=[...range.getClientRects()]}
     else if(/^(BR|IMG|INPUT|HR|FIGURE)$/.test(n.tagName))rects=[n.getBoundingClientRect()];
     rects=rects.filter(r=>r.height>0);if(last&&rects.length)return rects;out.push(...rects);
   }
   return out;
 }
 // Tops of the first few lines of an element, relative to origin.
 function lineTops(el,origin,max){
   const tops=[];let bottom=-Infinity;
   for(const r of drawn(el,400)){if(r.top>=bottom-1){if(tops.length===max)break;tops.push(r.top-origin);bottom=r.bottom}else bottom=Math.max(bottom,r.bottom)}
   return tops;
 }
 // Pushes for a throwaway copy of the note are inline margins; null (or reset) puts back the paragraph's own space-before.
 function inlinePushes(){
   const own=new Map(),put=node=>{const v=own.get(node);if(v)node.style.setProperty('margin-top',v);else node.style.removeProperty('margin-top')};
   const push=(node,path,m)=>{if(!own.has(node))own.set(node,node.style.getPropertyValue('margin-top'));if(m!=null)node.style.setProperty('margin-top',m+'px','important');else put(node)};
   push.reset=()=>own.forEach((v,node)=>put(node));return push;
 }
 // Lays root out on pages of geometry p and returns the page count. push(el,path,margin) sets a block's top margin
 // (null restores it); guess is the previous page count.
 function paginate(root,p,push,guess=1){
   const step=p.h+p.gap,room=p.h-p.top-p.bottom,blocks=[],shown=new Map(),start=k=>k*step,end=k=>k*step+room;
   const display=el=>{let d=shown.get(el);if(d===undefined)shown.set(el,d=getComputedStyle(el).display);return d};
   // Every block box in document order. Inline elements are searched too: notes can hold paragraphs inside a span.
   (function walk(el,path){
     let found=false;
     [...el.children].forEach((c,i)=>{
       const d=display(c);if(d==='none')return;
       const b=d.startsWith('inline')?null:{el:c,path:path.concat(i)};if(b)blocks.push(b);
       const inner=c.children.length>0&&walk(c,path.concat(i));if(b)b.leaf=!inner;found=found||!!b||inner;
     });
     return found;
   })(root,[]);
   const origin=()=>root.getBoundingClientRect().top+p.top,page=y=>pageIndex(y+p.top,p);
   function count(){const last=drawn(root,1,true);return last.length?page(Math.max(...last.map(r=>r.bottom))-origin()-1)+1:1}
   let n=Math.max(1,guess),total=1,moved=[],cuts=new Map();
   const unmove=()=>{moved.forEach(b=>push(b.el,b.path,null));moved=[];cuts=new Map()};
   function move(b,to,o){
     const at=()=>b.el.getBoundingClientRect().top-o,d=to-at();if(d<.5)return false;
     const m=parseFloat(getComputedStyle(b.el).marginTop)||0;push(b.el,b.path,m+d);
     // A collapsed margin (a first child's with its parent's) can absorb part of the push; top it up.
     const short=to-at();if(short>.5)push(b.el,b.path,m+d+short);
     moved.push(b);return true;
   }
   // Move b to the top of the next page, unless it is still too tall to fit there.
   function carry(b,k,o,keep){
     if(!move(b,start(k+1),o)||!keep)return;
     if(b.el.getBoundingClientRect().bottom-o>end(k+1)+1){push(b.el,b.path,null);moved.pop()}
   }
   // A heading just above a block that moves from page k to the next goes with it (taking the block along).
   function withHeading(i,k,o){
     let j=i-1;while(j>=0&&blocks[j].el.contains(blocks[i].el))j--;   // skip the containers the block is inside
     const h=blocks[j];if(!h?.leaf||!/^H[1-6]$/.test(h.el.tagName))return false;
     const t=h.el.getBoundingClientRect().top-o;if(page(t)!==k||t<=start(k)+1)return false;
     if(withHeading(j,k,o))return true;   // a run of headings moves as one
     carry(h,k,o,true);return moved.at(-1)===h;
   }
   function carryWith(i,k,o,keep){if(!withHeading(i,k,o))carry(blocks[i],k,o,keep)}
   function rules(){
     const o=origin();
     blocks.forEach((b,i)=>{
       const r=b.el.getBoundingClientRect();if(!r.height)return;
       const top=r.top-o,bottom=r.bottom-o,k=page(top),tag=b.el.tagName,first=drawn(b.el,1)[0],line=first?page(first.top-o):k;
       // A block whose first line was carried onto the next page starts on that page too.
       if(top<start(k)-.5||line>k){const to=Math.max(k,line);if(!withHeading(i,to-1,o))move(b,start(to),o);return}
       if(top<=start(k)+1)return;
       if(/^(PRE|ASIDE|BLOCKQUOTE|HR|FIGURE)$/.test(tag)){if(bottom>end(k)+1)carryWith(i,k,o,true);return}
       if(!b.leaf)return;
       if(/^H[1-6]$/.test(tag)){
         const next=blocks.slice(i+1).find(x=>x.leaf&&drawn(x.el,1).length),first=next&&drawn(next.el,1)[0];
         if(bottom>end(k)+1||first&&page(first.top-o)>k)carryWith(i,k,o,true);
         return;
       }
       const lines=lineTops(b.el,o,4);if(lines.length<2)return;
       if(lines.length<=3?page(lines.at(-1))>page(lines[0]):page(lines[1])>page(lines[0])){carryWith(i,k,o,false);return}
       // Widow control: when a long paragraph's last line would be alone on a new page, that page break comes one
       // line earlier.
       if(lines.length===4&&bottom>end(k)+1){
         const all=lineTops(b.el,o,Infinity),last=page(all.at(-1));
         if(all.length>=4&&page(all.at(-2))===last-1&&!cuts.has(last-1)){cuts.set(last-1,all.at(-2)-1);pageBands(root,p,n,cuts)}
       }
     });
   }
   // Add page breaks until they cover the content, then apply the keep rules (which can add pages).
   for(let i=0;i<8;i++){pageBands(root,p,n);total=count();if(total<=n)break;n=total+1}
   for(let i=0;i<4;i++){unmove();pageBands(root,p,n);rules();total=count();if(total<=n)break;n=total+1}
   // A line taller than a whole page can never fit between two breaks: lay out without breaks rather than loop.
   if(total>n){unmove();pageBands(root,p,1);return count()}
   pageBands(root,p,total,cuts);return total;
 }
 function createNotes(o){
   let subject=null,query='',filter='all',active=null,topicScope=null,topicFilter='',weekFilter='';
   const root=document.getElementById('portalNotes'),subjects=()=>o.subjects();
   const current=()=>subjects().find(s=>s.id===subject);
   const scoped=()=>o.notes().filter(n=>subject==='unassigned'?!n.subject_id:n.subject_id===subject&&(!topicScope||n.topic_name===topicScope));
   const tabs=(current='notes')=>`<nav class="subject-tabs">${(topicScope?['overview','quizzes','flashcards']:['topics','quizzes','flashcards']).concat(o.ctf?.(subject)?['ctf']:[],['notes','progress']).map(t=>`<button data-subject-tab="${t}" class="${t===current?'active':''}">${t==='ctf'?'CTF':t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</nav>`;
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
     const shared=filter==='pinned'||weekFilter?[]:(o.sharedNotes?.(subject)||[]).filter(n=>(!topicFilter||(topicFilter==='__none'?!n.saved_topic:n.saved_topic===topicFilter))&&[n.title,n.preview,n.owner_name,n.saved_topic].join(' ').toLowerCase().includes(query.toLowerCase()));
     if(shared.length){host.querySelector('.notes-empty')?.remove();host.insertAdjacentHTML('beforeend',`<details class="notebook-group shared-group" open><summary>👥 Shared with you · ${shared.length} note${shared.length===1?'':'s'}</summary><div class="notebook-cards">${shared.map(n=>`<button class="notebook-card shared" data-open-shared="${esc(n.id)}"><span>👥 Shared by ${esc(n.owner_name)}</span><h3>${esc(n.title)}</h3><p>${esc(n.preview.slice(0,130))||'Open this shared note.'}</p><small>${esc(n.saved_topic||'General')} · ${new Date(n.updated_at).toLocaleDateString()} · ${n.permission==='edit'?'You can edit':'View only'} · Live</small></button>`).join('')}</div></details>`);host.querySelectorAll('[data-open-shared]').forEach(b=>b.onclick=()=>o.openShared(b.dataset.openShared))}
   }
   function choose(){topicScope=null;topicFilter='';weekFilter='';subject=null;o.selectSubject(null);render()}
   function open(s,noteId,topic=null){topicScope=topic;topicFilter='';weekFilter='';subject=s;query='';filter='all';if(s!=='unassigned')o.selectSubject(s);o.showNotes();render();if(noteId)launch(o.notes().find(n=>n.id===noteId))}
   async function launch(existing){
     if(active)return;
     const note=existing?{...existing,base_updated_at:existing.updated_at}:{id:id(),subject_id:subject,title:'Untitled Note',content:'',content_format:'html',week:null,topic_name:topicScope,tags:[],is_pinned:0};
     active=workspace(note,{subjects,share:o.shareNote?(n=>o.shareNote(n)):null,watch:existing&&o.watchNote?(fn=>o.watchNote(existing.id,fn)):null,refresh:async()=>{await o.refresh();render()},close:()=>{active=null;render()},study:async(n,kind)=>{
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
   // A note a friend shared: the adapter reads and saves it through the share, never your own notes.
   function openShared(data,adapter){if(active)return false;active=workspace({...data.note,base_updated_at:data.note.updated_at},{subjects,refresh:adapter.refresh,close:()=>{active=null;render()},study:null,shared:adapter.shared,saveNote:adapter.saveNote,upload:adapter.upload,ink:adapter.ink,watch:adapter.watch});return true}
   return {render,open,openShared,openTopic:(s,t)=>open(s,null,t),choose,onShow(){if(!active){subject=o.currentSubject()||subject;render()}},canLeave:()=>!active,resetEdit:()=>{},createNote:()=>launch(),getSubject:()=>subject,subjectNavigation(s){subject=s;topicScope=null;const host=document.getElementById('view-subject');host.querySelector('.subject-tabs')?.remove();document.getElementById('subjectBanner').insertAdjacentHTML('afterend',tabs('topics'));bindTabs(host.querySelector('.subject-tabs'))}};
 }
 function workspace(note,o){
   let revision=0,savedRevision=0,pending=null,timer=null,range=null,sidebar='outline',taskBusy=false,disposed=false;
   const previous=document.activeElement,lock=document.body.style.overflow,inert=[];
   const host=document.createElement('div');host.className='notebook-backdrop';
   for(const el of document.body.children)if(el.tagName!=='SCRIPT'){inert.push([el,el.inert]);el.inert=true}document.body.append(host);document.body.style.overflow='hidden';
   const btn=(label,action,extra='')=>`<button type="button" data-action="${action}" ${extra}>${label}</button>`;
   host.innerHTML=`<section class="notebook-editor" role="dialog" aria-modal="true" aria-label="Note editor"><header class="notebook-header"><div class="notebook-identity"><input id="notebookTitle" aria-label="Note title" maxlength="300" value="${esc(note.title)}"><div class="notebook-meta"><select id="notebookSubject" aria-label="Subject">${!note.subject_id?'<option value="">Choose subject</option>':''}${o.subjects().map(s=>`<option value="${esc(s.id)}" ${s.id===note.subject_id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><select id="notebookTopic" aria-label="Topic"></select><input id="notebookWeek" type="number" min="1" max="100" placeholder="Week" aria-label="Week" value="${note.week||''}"><span id="notebookStatus" role="status">${note.updated_at?'Saved':'New note · start writing'}</span></div></div><div class="notebook-actions">${btn('✎ Handwriting','handwriting','title="Add a handwriting page"')}${btn(note.is_pinned?'⌖ Pinned':'⌖ Pin','pin',`aria-pressed="${!!note.is_pinned}"`)}${btn('📖 Book View','book','title="Read this note page by page"')}${btn('⛶ Full Screen','fullscreen')}${btn('••• More','more')}${btn('Save','save','class="primary"')}${btn('×','close','aria-label="Close note editor"')}</div></header><div class="notebook-toolbar" role="toolbar" aria-label="Note formatting"><select id="notebookHeading" aria-label="Heading style"><option value="p">Normal text</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option></select><span class="notebook-size" role="group" aria-label="Font size"><input id="notebookFontSize" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="5" aria-label="Font size in points" title="Font size (pt): type a number and press Enter"><select id="notebookFontSizes" aria-label="Choose a font size" title="Font sizes"><option value="" hidden></option>${SIZES.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>${btn('A<sup>+</sup>','grow','title="Increase font size (Ctrl+Shift+>)" aria-label="Increase font size"')}${btn('A<sup>−</sup>','shrink','title="Decrease font size (Ctrl+Shift+<)" aria-label="Decrease font size"')}</span><label class="notebook-color-btn" title="Text colour" aria-label="Text colour">A<input id="notebookColor" type="color" value="#e45858"></label><select id="notebookLineSpacing" aria-label="Line and paragraph spacing" title="Line and paragraph spacing"><option value="" hidden>↕ Line spacing</option>${[['1','1.0'],['1.15','1.15'],['1.5','1.5'],['2','2.0'],['2.5','2.5'],['3','3.0']].map(([v,l])=>`<option value="${v}" data-label="${l}">${l}</option>`).join('')}<option value="default">Default spacing</option><option value="options">Line spacing options…</option></select><select id="notebookLetterSpacing" aria-label="Letter spacing" title="Letter spacing"><option value="" hidden>A↔ Letter spacing</option>${[['-1','Condensed by 1 pt'],['-0.5','Condensed by 0.5 pt'],['0','Normal'],['0.5','Expanded by 0.5 pt'],['1','Expanded by 1 pt'],['2','Expanded by 2 pt'],['3','Expanded by 3 pt']].map(([v,l])=>`<option value="${v}" data-label="${l}">${l}</option>`).join('')}<option value="custom">Custom…</option></select>${[['B','bold'],['I','italic'],['U','underline'],['S̶','strikeThrough'],['• List','insertUnorderedList'],['1. List','insertOrderedList'],['☑','checklist'],['Highlight','highlight'],['‹/›','inlinecode'],['Code','code'],['Callout','callout'],['Image','image'],['Link','link'],['Quote','quote'],['↶','undo'],['↷','redo'],['▤ Pages','pages'],['☰ Sidebar','sidebar']].map(([l,a])=>btn(l,a,`title="${a}" aria-label="${a}"`)).join('')}</div><div class="notebook-layout"><div class="notebook-paper-scroll"><div class="notebook-sheets" aria-hidden="true"></div><div id="notebookDocument" class="notebook-document" contenteditable="true" role="textbox" aria-label="Note content" aria-multiline="true" spellcheck="true"></div><div class="notebook-sheet-edges" aria-hidden="true"></div></div><aside class="notebook-side"><nav>${['outline','templates','study'].map(t=>btn(t==='study'?'Study Tools':t[0].toUpperCase()+t.slice(1),'tab-'+t)).join('')}</nav><div id="notebookPanel"></div><h4>Quick Insert</h4><div class="notebook-inserts">${[['Heading','heading'],['Callout','callout'],['Code Block','code'],['Checklist','checklist'],['Image','image'],['Handwriting page','handwriting'],['Divider','divider']].map(([l,a])=>btn('＋ '+l,a)).join('')}</div></aside></div><footer><span id="notebookCount"></span><span id="notebookPage" role="status"></span><span id="notebookEdited">${note.updated_at?'Last edited '+new Date(note.updated_at).toLocaleString():'Not saved yet'}</span></footer><input id="notebookImage" type="file" accept="image/png,image/jpeg,image/webp" hidden><div id="notebookDialog" hidden></div></section>`;
   const $=s=>host.querySelector(s),doc=$('#notebookDocument'),title=$('#notebookTitle'),status=$('#notebookStatus');
   const shared=o.shared||null,readOnly=shared?.mode==='view';
   if(shared){for(const sel of ['#notebookSubject','#notebookTopic','#notebookWeek','[data-action=pin]','[data-action=tab-study]'])host.querySelector(sel).hidden=true;$('.notebook-meta').insertAdjacentHTML('afterbegin',`<span class="notebook-shared-badge">👥 Shared by ${esc(shared.ownerName)} · ${readOnly?'View only':'You can edit'} · Live</span>`)}
   if(readOnly){doc.contentEditable='false';title.readOnly=true;for(const sel of ['.notebook-toolbar','.notebook-inserts','.notebook-side h4','[data-action=save]','[data-action=tab-templates]','[data-action=handwriting]'])host.querySelector(sel).hidden=true}
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
   const recoveryPrefix='notebook.draft.'+(document.querySelector('meta[name=portal-account]')?.content||'local')+'.'+(shared?'shared.'+shared.id:note.subject_id||'unassigned')+'.';
   let recoveryKey=recoveryPrefix+note.id,recovery=null;
   try{recovery=JSON.parse(localStorage.getItem(recoveryKey)||'null');if(!recovery&&!note.updated_at){const key=Object.keys(localStorage).find(k=>k.startsWith(recoveryPrefix));if(key)recovery=JSON.parse(localStorage.getItem(key))}}catch{}
   function clearRecovery(){try{const value=JSON.parse(localStorage.getItem(recoveryKey)||'null');if(value?.id===note.id)localStorage.removeItem(recoveryKey)}catch{}}
   function topics(){const names=o.subjects().find(s=>s.id===$('#notebookSubject').value)?.topics||[];$('#notebookTopic').innerHTML='<option value="">No topic</option>'+names.map(t=>`<option ${t===note.topic_name?'selected':''}>${esc(t)}</option>`).join('')}
   topics();
   function snapshot(){return {...note,title:title.value.trim()||'Untitled Note',subject_id:$('#notebookSubject').value,topic_name:$('#notebookTopic').value||null,week:$('#notebookWeek').value||null,content:sanitize(doc.innerHTML).replace(/\u200B/g,''),content_format:'html'}}
   // Lines never enter a page break even mid-word (the page shape does that live); the keep rules and the page count
   // are worked out again once typing pauses.
   function update(){
     $('#notebookCount').textContent='Word count: '+(doc.innerText.trim().match(/\S+/g)||[]).length;
     schedulePages(200);book?.refresh();showInk();
   }
   function changed(){revision++;if(saveError.hidden)status.textContent='Unsaved changes';try{localStorage.setItem(recoveryKey,JSON.stringify(snapshot()))}catch{status.textContent='Unsaved changes · Local recovery unavailable; please save before leaving.'}clearTimeout(timer);timer=setTimeout(()=>save(),1500);update()}
   async function save(){
     if(readOnly)return true;
     clearTimeout(timer);if(pending){const ok=await pending;return ok&&revision!==savedRevision?save():ok}
     if(revision===savedRevision&&note.updated_at)return true;
     if(!$('#notebookWeek').checkValidity()){showSaveError('Week must be a whole number from 1 to 100, or blank.',$('#notebookWeek'));return false}
     const version=revision,data=snapshot();if(!shared&&!data.subject_id){showSaveError('Choose a subject for this note.',$('#notebookSubject'));return false}if(!shared&&!note.updated_at&&!data.topic_name&&!data.week){showSaveError('Choose a Topic or enter a Week before saving this new note.',$('#notebookTopic'));return false}status.textContent='Saving…';$('[data-action=save]').textContent='Saving…';$('#notebookRetrySave').disabled=true;
     pending=(async()=>{try{
       const result=o.saveNote?await o.saveNote(data):await api('/api/portal',{table:'notes',item:data});note={...result.note,is_pinned:note.is_pinned,tags:note.tags,base_updated_at:result.note.updated_at};savedRevision=version;
       if(revision===version)clearRecovery();else try{localStorage.setItem(recoveryKey,JSON.stringify(snapshot()))}catch{}
       clearSaveError();status.textContent=revision===version?'Saved':'Unsaved changes';$('#notebookEdited').textContent='Last edited '+new Date(note.updated_at).toLocaleString();try{await o.refresh()}catch{status.textContent='Saved · Library refresh failed; reopen the library to refresh.'}return true;
     }catch(err){showSaveError(err.message||'The server could not save your note. Check your connection and retry.');return false}finally{pending=null;$('#notebookRetrySave').disabled=false}})();
     const ok=await pending;return ok&&revision!==savedRevision?save():ok;
   }
   function dispose(){if(disposed)return;disposed=true;ink?.close();book?.close();printed?.();cancelAnimationFrame(pageFrame);clearTimeout(pageTimer);cancelAnimationFrame(syncFrame);clearTimeout(past.timer);pageObserver.disconnect();clearTimeout(timer);stopWatching?.();host.remove();document.body.style.overflow=lock;inert.forEach(([el,value])=>el.inert=value);document.removeEventListener('selectionchange',selection);window.removeEventListener('beforeunload',unload);document.removeEventListener('keydown',keys,true);o.close();if(previous?.isConnected)previous.focus()}
   function dialog(heading,body,actions){const overlay=$('#notebookDialog');overlay.hidden=false;if(host.contains(document.fullscreenElement))document.exitFullscreen().catch(()=>{});overlay.innerHTML=`<div class="notebook-dialog" role="alertdialog" aria-modal="true" aria-label="${esc(heading)}"><h3>${esc(heading)}</h3><div>${body}</div><div class="notebook-dialog-actions">${actions.map(([l])=>`<button type="button">${l}</button>`).join('')}</div></div>`;overlay.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>actions[i][1]());overlay.querySelector('button')?.focus()}
   const dismiss=()=>{$('#notebookDialog').hidden=true;doc.focus()};
   async function close(){if(taskBusy){status.textContent='Please wait for the current operation to finish.';return}clearTimeout(timer);if(pending)await pending;if(revision===savedRevision){dispose();return}dialog('You have unsaved changes.','<p>Save your note before closing, or keep writing.</p>',[['Keep Editing',dismiss],['Discard Changes',()=>{clearRecovery();dispose()}],['Save & Close',async()=>{if(await save())dispose()}]])}
   function selection(){const s=getSelection();if(s.rangeCount&&doc.contains(s.anchorNode)&&doc.contains(s.focusNode)){range=s.getRangeAt(0).cloneRange();syncToolbar()}}
   document.addEventListener('selectionchange',selection);
   function restore(){doc.focus();if(range&&doc.contains(range.commonAncestorContainer)){const s=getSelection();s.removeAllRanges();s.addRange(range)}}
   // Undo history: snapshots of the note with the selection before and after each change, so typing, formatting
   // and spacing all undo the same way. A burst of typing is one step.
   const past={list:[],at:-1,timer:0,before:null,composing:false};
   const nodePath=n=>{const out=[];while(n&&n!==doc){const parent=n.parentNode;if(!parent)return null;out.unshift([...parent.childNodes].indexOf(n));n=parent}return n===doc?out:null};
   function caretNow(){const s=getSelection();return s.rangeCount&&doc.contains(s.anchorNode)&&doc.contains(s.focusNode)?{a:nodePath(s.anchorNode),ao:s.anchorOffset,f:nodePath(s.focusNode),fo:s.focusOffset}:null}
   function caretTo(c){
     doc.focus();const find=p=>p?.reduce((n,i)=>n?.childNodes[i],doc),a=find(c?.a),f=find(c?.f);if(!a||!f)return;
     const fit=(n,off)=>Math.min(off,n.nodeType===3?n.length:n.childNodes.length);getSelection().setBaseAndExtent(a,fit(a,c.ao),f,fit(f,c.fo));selection();
   }
   function record(){
     clearTimeout(past.timer);past.timer=0;const html=doc.innerHTML,cur=past.list[past.at],after=caretNow();
     if(cur?.html===html){past.before=null;return}
     past.list.splice(past.at+1);past.list.push({html,before:past.before,after});past.before=null;
     if(past.list.length>200)past.list.shift();past.at=past.list.length-1;
   }
   function typed(){if(!past.composing){clearTimeout(past.timer);past.timer=setTimeout(record,600)}}
   function beginEdit(){if(past.timer)record();past.before=caretNow()}
   function resetHistory(){past.list=[];past.at=-1;past.before=null;record()}
   function travel(step){
     if(past.timer)record();const cur=past.list[past.at],to=past.list[past.at+step];if(!to)return;
     past.at+=step;doc.innerHTML=to.html;caretTo(step<0?cur.before||to.after:to.after);changed();
   }
   function command(name,value=null){restore();beginEdit();document.execCommand('styleWithCSS',false,false);document.execCommand(name,false,value);selection();record();changed()}
   const insert=markup=>command('insertHTML',sanitize(markup));
   function selectedText(){return range?.toString()||''}
   const inlineEl=el=>getComputedStyle(el).display.startsWith('inline');
   const blockOf=n=>{let e=n.nodeType===1?n:n.parentNode;while(e&&e!==doc&&inlineEl(e))e=e.parentNode;return e};
   const ptOf=n=>Math.round(parseFloat(getComputedStyle(n.nodeType===1?n:n.parentNode).fontSize)*.75*2)/2;
   const num=v=>String(+(+v).toFixed(2));
   // Character formatting (size, colour, letter spacing) styles each selected run of text on its own, as a word
   // processor does, so a selection across several paragraphs never wraps whole paragraphs in one span. value is a
   // CSS value, or a function of the text node; '' removes the property.
   function styleText(prop,value){
     restore();const sel=getSelection();if(!sel.rangeCount||!doc.contains(sel.anchorNode)||!doc.contains(sel.focusNode))return;
     const val=n=>typeof value==='function'?value(n):value;let r=sel.getRangeAt(0);beginEdit();
     if(r.collapsed){
       // With no selection the change applies to the word at the caret, or else to what is typed next.
       const word=wordAround(r);if(!word){caretStyle(r,prop,val(r.startContainer));return}
       sel.removeAllRanges();sel.addRange(word);r=sel.getRangeAt(0);
     }
     if(r.endContainer.nodeType===3&&r.endOffset<r.endContainer.length)r.endContainer.splitText(r.endOffset);
     if(r.startContainer.nodeType===3&&r.startOffset>0&&r.startOffset<r.startContainer.length)r.startContainer.splitText(r.startOffset);
     const texts=[],root=r.commonAncestorContainer,walk=document.createTreeWalker(root.nodeType===3?root.parentNode:root,NodeFilter.SHOW_TEXT);
     for(let t=walk.nextNode();t;t=walk.nextNode()){
       if(!t.length||!r.intersectsNode(t)||t===r.startContainer&&r.startOffset>=t.length||t===r.endContainer&&r.endOffset===0)continue;
       if(!t.data.trim()&&t.data.includes('\n'))continue;   // layout whitespace between blocks
       texts.push(t);
     }
     if(!texts.length){record();return}
     for(const t of texts){
       const v=val(t);let span=t.parentNode;
       if(span.nodeName!=='SPAN'||span.childNodes.length!==1){span=document.createElement('span');t.before(span);span.append(t)}
       if(v){span.style.setProperty(prop,v);continue}
       span.style.removeProperty(prop);if(prop==='letter-spacing'&&getComputedStyle(span).letterSpacing!=='normal')span.style.setProperty(prop,'normal');
       if(!span.getAttribute('style'))span.replaceWith(t);
     }
     const next=document.createRange();next.setStart(texts[0],0);next.setEnd(texts.at(-1),texts.at(-1).length);sel.removeAllRanges();sel.addRange(next);
     selection();record();changed();
   }
   function wordAround(r){
     const t=r.startContainer,at=r.startOffset,letter=/[\p{L}\p{N}\p{M}_'’-]/u;
     if(t.nodeType!==3||!(at>0&&at<t.length&&letter.test(t.data[at-1])&&letter.test(t.data[at])))return null;
     let a=at,b=at;while(a>0&&letter.test(t.data[a-1]))a--;while(b<t.length&&letter.test(t.data[b]))b++;
     const word=document.createRange();word.setStart(t,a);word.setEnd(t,b);return word;
   }
   // An empty styled span (holding a zero-width space, removed on save) for the caret, so new typing takes the style.
   function caretStyle(r,prop,v){
     let span=r.startContainer.nodeType===3?r.startContainer.parentNode:null;
     if(!(span?.nodeName==='SPAN'&&span.textContent==='\u200B')){span=document.createElement('span');span.textContent='\u200B';r.insertNode(span)}
     span.style.setProperty(prop,v||'normal');
     const at=document.createRange();at.setStart(span.firstChild,1);at.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(at);
     selection();record();changed();
   }
   // Paragraph formatting (line spacing, space before and after) applies to each paragraph the selection touches.
   function styleBlocks(apply){
     restore();const sel=getSelection();if(!sel.rangeCount||!doc.contains(sel.anchorNode))return;beginEdit();
     const r=sel.getRangeAt(0),found=new Set();
     if(r.collapsed)found.add(blockOf(r.startContainer));
     else{const walk=document.createTreeWalker(r.commonAncestorContainer,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);for(let n=walk.currentNode;n;n=walk.nextNode())if((n.nodeType===3?n.data.trim():/^(BR|IMG|INPUT|HR)$/.test(n.nodeName))&&r.intersectsNode(n))found.add(blockOf(n))}
     found.delete(null);
     // Text typed straight into the note (outside any paragraph) gets a paragraph to carry the spacing.
     if(found.delete(doc)){document.execCommand('formatBlock',false,'p');const b=blockOf(getSelection().anchorNode);if(b&&b!==doc)found.add(b)}
     found.forEach(apply);selection();record();changed();
   }
   function setSize(pt){
     if(!Number.isFinite(pt)||pt<1||pt>MAX_PT){status.textContent=`Font size must be a number from 1 to ${MAX_PT}.`;syncToolbar(true);return}
     styleText('font-size',num(Math.round(pt*2)/2)+'pt');
   }
   // Word's grow and shrink steps: through the size list, then in tens above 72 pt.
   function stepSize(dir){styleText('font-size',n=>{const now=ptOf(n),next=dir>0?SIZES.find(s=>s>now+.01)??Math.min(MAX_PT,now+10):SIZES.findLast(s=>s<now-.01)??Math.max(1,now-1);return num(next)+'pt'})}
   function nudgeSize(dir){styleText('font-size',n=>num(Math.min(MAX_PT,Math.max(1,ptOf(n)+dir)))+'pt')}
   // Line spacing is chosen as in Word, where single spacing is about 1.2 times the font size.
   function lineSpacing(v){styleBlocks(el=>v==='default'?el.style.removeProperty('line-height'):el.style.lineHeight=num(+v*WORD_LINE))}
   function letterSpacing(pt){styleText('letter-spacing',pt?num(pt)+'pt':'')}
   function currentSpacing(){
     const b=range&&blockOf(range.startContainer),cs=b&&b!==doc?getComputedStyle(b):null;
     return {block:b!==doc?b:null,line:cs&&cs.lineHeight!=='normal'?parseFloat(cs.lineHeight)/parseFloat(cs.fontSize)/WORD_LINE:1,letters:range?(v=>v==='normal'?0:parseFloat(v)*.75)(getComputedStyle(range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentNode).letterSpacing):0};
   }
   function spacingOptions(){
     const now=currentSpacing(),pt=v=>v&&/pt$/.test(v)?parseFloat(v):v?num(parseFloat(v)*.75):'';
     dialog('Line spacing options',`<div class="notebook-spacing-form"><label>Line spacing (1.0 single, 1.5, 2.0 double)<input id="notebookLineValue" type="number" min="0.5" max="3" step="0.05" value="${num(now.line)}"></label><label>Space before paragraph (pt)<input id="notebookBefore" type="number" min="0" max="72" step="1" placeholder="Default" value="${pt(now.block?.style.marginTop)}"></label><label>Space after paragraph (pt)<input id="notebookAfter" type="number" min="0" max="72" step="1" placeholder="Default" value="${pt(now.block?.style.marginBottom)}"></label><p class="muted">Applies to the paragraphs you selected. Leave a space box empty to use the note's normal spacing.</p></div>`,[['Cancel',dismiss],['Apply',()=>{
       const line=+$('#notebookLineValue').value,before=$('#notebookBefore').value,after=$('#notebookAfter').value,bad=v=>v!==''&&!(+v>=0&&+v<=72);
       if(!(line>=.5&&line<=3)||bad(before)||bad(after)){$('#notebookDialog p.muted').textContent='Use a line spacing from 0.5 to 3, and spaces from 0 to 72 pt.';return}
       dismiss();styleBlocks(el=>{el.style.lineHeight=num(line*WORD_LINE);for(const [prop,v] of [['margin-top',before],['margin-bottom',after]])v===''?el.style.removeProperty(prop):el.style.setProperty(prop,num(v)+'pt')});
     }]]);
     $('#notebookLineValue').focus();
   }
   function customLetters(){
     dialog('Letter spacing',`<div class="notebook-spacing-form"><label>Spacing between letters (pt). Below 0 condenses, above 0 expands.<input id="notebookLetterValue" type="number" min="-10" max="20" step="0.1" value="${num(currentSpacing().letters)}"></label><p class="muted">Applies to the selected text, or to the word at the cursor.</p></div>`,[['Cancel',dismiss],['Apply',()=>{
       const v=+$('#notebookLetterValue').value;if($('#notebookLetterValue').value===''||!(v>=-10&&v<=20)){$('#notebookDialog p.muted').textContent='Use a number from -10 to 20 pt.';return}
       dismiss();letterSpacing(v);
     }]]);
     $('#notebookLetterValue').focus();
   }
   // The size box shows the size at the selection (blank when it is mixed); the spacing menus tick the current value.
   let syncFrame=0;
   function syncToolbar(force=false){
     cancelAnimationFrame(syncFrame);syncFrame=requestAnimationFrame(()=>{
       if(disposed||!range)return;const box=$('#notebookFontSize');
       if(force||document.activeElement!==box){const a=ptOf(range.startContainer),b=ptOf(range.endContainer);box.value=a===b?num(a):''}
       const now=currentSpacing(),tick=(select,value)=>[...select.options].forEach(op=>{if(op.dataset.label)op.textContent=(Math.abs(+op.value-value)<.02?'✓ ':'')+op.dataset.label});
       tick($('#notebookLineSpacing'),now.line);tick($('#notebookLetterSpacing'),now.letters);
     });
   }
   function panel(){
     const el=$('#notebookPanel');
     if(sidebar==='outline'){const heads=[...doc.querySelectorAll('h1,h2,h3')],paged=editorEl.classList.contains('paged'),top=doc.getBoundingClientRect().top;el.innerHTML=heads.length?heads.map((h,i)=>`<button class="notebook-outline" data-heading="${i}" style="padding-left:${(Number(h.tagName[1])-1)*10+6}px"><span>${esc(h.textContent||'Untitled heading')}</span>${paged?`<small>p. ${pageIndex(h.getBoundingClientRect().top-top,PAGE)+1}</small>`:''}</button>`).join(''):'<p class="muted">Add headings to build your outline.</p>';el.querySelectorAll('[data-heading]').forEach(b=>b.onclick=()=>heads[+b.dataset.heading].scrollIntoView({block:'start',behavior:'smooth'}))}
     if(sidebar==='templates'){el.innerHTML=Object.keys(templates).map(t=>`<button data-template="${t}">${t} →</button>`).join('');el.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{const t=b.dataset.template,markup='<h1>'+t+'</h1>'+templates[t].map(h=>'<h2>'+h+'</h2><p><br></p>').join('');dialog('Preview: '+t,`<div class="notebook-template-preview">${markup}</div><p>Append this editable structure to your note. Existing content will be kept.</p>`,[['Cancel',dismiss],['Append template',()=>{dismiss();const r=document.createRange();r.selectNodeContents(doc);r.collapse(false);range=r;insert(markup)}]])})}
     if(sidebar==='study'){el.innerHTML=[['Create Quick Review','quick-review'],['Convert to Flashcards','flashcards'],['Generate Quiz','quiz'],['Ask AI about this Note','ask'],['Create Summary','summary']].map(([l,k])=>`<button data-study-tool="${k}">${l}</button>`).join('')+'<p class="muted">Quick Review works manually; the other tools use your connected AI provider. Review generated material before importing.</p>';el.querySelectorAll('[data-study-tool]').forEach(b=>b.onclick=async()=>{if(taskBusy)return;if(!await save())return;taskBusy=true;doc.contentEditable='false';host.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);status.textContent=b.dataset.studyTool==='quick-review'?'Opening Quick Review…':'AI is working…';try{const result=await o.study(note,b.dataset.studyTool);if(result&&!disposed)dialog('AI summary — review for accuracy',`<pre class="notebook-summary">${esc(result)}</pre>`,[['Close',dismiss]]);if(!disposed)status.textContent='Saved · AI response ready'}catch(err){if(!disposed)status.textContent=err.message}finally{taskBusy=false;if(!disposed){doc.contentEditable='true';host.querySelectorAll('button,input,select').forEach(el=>el.disabled=false)}}})}
   }
   async function image(file){if(!file)return;if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){status.textContent='Use a PNG, JPG or WebP under 5 MB.';return}taskBusy=true;status.textContent='Uploading image…';try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});const url=o.upload?await o.upload(data):(await api('/api/notes/upload',{image:data})).url;insert(`<p><img src="${esc(url)}" alt="${esc(file.name)}"></p><p><br></p>`)}catch(err){status.textContent='Image upload failed: '+err.message}finally{taskBusy=false}}
   async function exportHtml(){
     const content=snapshot(),box=document.createElement('div');box.innerHTML=content.content;
     // Handwriting pages go into the file as pictures, so it opens anywhere.
     for(const f of box.querySelectorAll('figure[data-ink]'))try{const {svg}=await g.StudentInk.load(f.dataset.ink,inkFiles.load);f.innerHTML=`<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt="Handwriting page" style="display:block;max-width:100%;height:auto">`}catch{}
     const blob=new Blob(['<!doctype html><meta charset="utf-8"><title>'+esc(content.title)+'</title><h1>'+esc(content.title)+'</h1>'+box.innerHTML],{type:'text/html'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=content.title.replace(/[^\w -]/g,'_')+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);dismiss();status.textContent='Exported HTML. Images remain linked to this portal.';
   }
   // Handwriting pages (handwriting.js) are kept in files of their own; the note holds <figure data-ink="id">. Adding one
   // asks which page it becomes and on what paper; clicking one opens it for writing again.
   const inkFiles=o.ink||{load:async id=>{const r=await fetch('/api/notes/ink/'+id);if(!r.ok)throw Error('This handwriting page could not be loaded.');return r.text()},save:async text=>(await api('/api/notes/ink',{ink:text})).id};
   let ink=null;
   const showInk=()=>Promise.resolve(g.StudentInk?.hydrate(doc,inkFiles.load)).then(added=>{if(added&&!disposed){schedulePages();book?.refresh()}});
   const blank=()=>!doc.textContent.trim()&&!doc.querySelector('img,figure,hr,input');
   function openInk(page,title,save){
     const covered=[...editorEl.children].filter(n=>n.id!=='notebookDialog');covered.forEach(n=>n.inert=true);
     const answer=(yes,res)=>()=>{$('#notebookDialog').hidden=true;if(!yes)ink?.element.focus();res(yes)};
     ink=g.StudentInk.open({host:editorEl,page,title,save,
       confirm:()=>new Promise(res=>dialog('Discard this handwriting?','<p>What you wrote on this page since you opened it will be lost.</p>',[['Keep writing',answer(false,res)],['Discard',answer(true,res)]])),
       onClose:()=>{ink=null;covered.forEach(n=>n.inert=false);if(!disposed)doc.focus()}});
   }
   function addHandwriting(){
     const T=g.StudentInk;if(!T){status.textContent='Handwriting could not load. Reload the page and try again.';return}
     if(readOnly||ink||taskBusy)return;
     let last={template:'lined',paper:'white'};try{last={...last,...JSON.parse(localStorage.getItem('notebook.ink.page')||'{}')}}catch{}
     if(!T.TEMPLATES.some(t=>t[0]===last.template))last.template='lined';if(!T.PAPERS.some(p=>p[0]===last.paper))last.paper='white';
     // Pages as page view lays them out; the default is straight after the page on screen.
     const empty=blank(),total=empty?0:withPageCuts((flow,cuts)=>cuts.length),here=editorEl.classList.contains('paged')?Math.min(total,currentPage()):total;
     const where=empty?'<p>This note is empty, so the handwriting page becomes page 1.</p>':`<label><span>Where</span><select id="notebookInkAt">${Array.from({length:total+1},(_,k)=>`<option value="${k}" ${k===here?'selected':''}>${k===0?'Page 1 · before everything':k===total?`Page ${k+1} · after the last page`:`Page ${k+1} · after page ${k}`}</option>`).join('')}</select></label>`;
     dialog('Add a handwriting page',`<div class="ink-new">${where}<fieldset><legend>Paper</legend><div class="ink-templates">${T.TEMPLATES.map(([k,l])=>`<label><input type="radio" name="notebookInkTemplate" value="${k}" ${k===last.template?'checked':''}><img src="${T.thumbnail(k,last.paper)}" alt=""><span>${l}</span></label>`).join('')}</div></fieldset><fieldset><legend>Paper colour</legend><div class="ink-papers">${T.PAPERS.map(([k,l,c])=>`<label><input type="radio" name="notebookInkPaper" value="${k}" ${k===last.paper?'checked':''}><i style="--swatch:${c}"></i>${l}</label>`).join('')}</div></fieldset><p class="muted">Write with a stylus, mouse or finger. You can change the paper while writing too.</p></div>`,[['Cancel',dismiss],['Start writing',()=>{
       const pick=n=>$(`[name=${n}]:checked`)?.value,page={template:pick('notebookInkTemplate')||'lined',paper:pick('notebookInkPaper')||'white',strokes:[]},at=empty?0:+($('#notebookInkAt')?.value??total);
       try{localStorage.setItem('notebook.ink.page',JSON.stringify({template:page.template,paper:page.paper}))}catch{}
       $('#notebookDialog').hidden=true;
       openInk(page,'New handwriting page',async p=>{const id=await inkFiles.save(T.encode(p));placeInk(at,id)});
     }]]);
     // The template pictures follow the chosen paper colour.
     $('#notebookDialog').querySelectorAll('[name=notebookInkPaper]').forEach(r=>r.onchange=()=>$('#notebookDialog').querySelectorAll('[name=notebookInkTemplate]').forEach(t=>t.nextElementSibling.src=T.thumbnail(t.value,r.value)));
   }
   // The new page becomes page at+1: the note is split exactly where page view's page at+1 begins (even mid-paragraph).
   function placeInk(at,id){
     beginEdit();const fig=document.createElement('figure');fig.dataset.ink=id;
     if(blank())doc.replaceChildren(fig);
     else{
       const cuts=withPageCuts((flow,cuts)=>cuts.map(c=>{const path=[];for(let n=c.node;n!==flow;n=n.parentNode)path.unshift([...n.parentNode.childNodes].indexOf(n));return {path,offset:c.offset}}));
       if(at>=cuts.length)doc.append(fig);
       else{const c=cuts[at],r=document.createRange();r.setStart(c.path.reduce((n,i)=>n.childNodes[i],doc),c.offset);r.setEnd(doc,doc.childNodes.length);const rest=r.extractContents();doc.append(fig,rest)}
     }
     record();changed();showInk();status.textContent='Handwriting page added · click it to write more';
     requestAnimationFrame(()=>fig.scrollIntoView({block:'start'}));
   }
   async function editInk(fig){
     const T=g.StudentInk;if(!T||readOnly||ink||taskBusy)return;const was=status.textContent;status.textContent='Opening the handwriting page…';
     try{
       const {page,text}=await T.load(fig.dataset.ink,inkFiles.load);status.textContent=was;
       openInk(page,'Handwriting page',async p=>{const next=T.encode(p);if(next===text)return;const id=await inkFiles.save(next);beginEdit();fig.dataset.ink=id;delete fig.dataset.inkShown;record();changed();showInk()});
     }catch(err){status.textContent=err.message}
   }
   doc.addEventListener('click',ev=>{
     const fig=ev.target.closest?.('figure[data-ink]');if(fig&&doc.contains(fig)){ev.preventDefault();editInk(fig);return}
     // Clicking below a handwriting page that ends the note starts a new paragraph after it.
     const last=doc.lastElementChild;
     if(ev.target===doc&&!readOnly&&last?.matches('figure[data-ink]')&&ev.clientY>last.getBoundingClientRect().bottom){
       beginEdit();const p=document.createElement('p');p.append(document.createElement('br'));doc.append(p);
       const r=document.createRange();r.setStart(p,0);getSelection().removeAllRanges();getSelection().addRange(r);record();changed();
     }
   });
   // PDF export: exactly the pages page view shows, one after another (like Word) or two side by side (like Book View).
   // The browser prints them, so "Save as PDF" in its print window writes a real PDF with selectable text.
   // The note is laid out on a copy with page view's geometry, then cut between the last line of each page and the
   // first line of the next; every piece becomes one printed page. A box cut by a page break loses its padding, border
   // and margin on that side, as the page edge hides them on screen; a list cut mid-way keeps its numbering.
   // Where page view's pages begin, found on a throwaway copy of the note laid out with page view's geometry;
   // use(flow,cuts,span,filled) runs on that copy before it is removed.
   function withPageCuts(use){
     const master=document.createElement('div'),flow=doc.cloneNode(true);master.className='notebook-book-master notebook-print-master';
     for(const a of [...flow.attributes])flow.removeAttribute(a.name);flow.className='notebook-document notebook-book-flow';master.append(flow);editorEl.append(master);
     try{
       const push=inlinePushes(),total=paginate(flow,PAGE,push),origin=flow.getBoundingClientRect().top,range=document.createRange();
       // Where each page begins: its first character (or picture, rule, checkbox or empty line).
       const starts=[{node:flow,offset:0}],pageAt=r=>pageIndex(r.top-origin,PAGE),begin=(k,node,offset)=>{while(starts.length<=k)starts.push({node,offset})};
       const walk=document.createTreeWalker(flow,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
       for(let n=walk.nextNode();n&&starts.length<total;n=walk.nextNode()){
         if(n.nodeType===3){
           if(!n.data.trim())continue;range.selectNodeContents(n);const last=[...range.getClientRects()].filter(r=>r.width>=1).at(-1);
           if(!last||pageAt(last)<starts.length)continue;
           for(let i=0;i<n.length&&starts.length<total;i++){if(/\s/.test(n.data[i]))continue;range.setStart(n,i);range.setEnd(n,i+1);const r=range.getClientRects()[0];if(r&&pageAt(r)>=starts.length)begin(pageAt(r),n,i)}
         }else if(/^(IMG|HR|INPUT|BR|FIGURE)$/.test(n.tagName)){const r=n.getBoundingClientRect();if((r.height||n.tagName==='HR')&&pageAt(r)>=starts.length)begin(pageAt(r),n.parentNode,[...n.parentNode.childNodes].indexOf(n))}
       }
       push.reset();   // positions are measured; the copies keep each paragraph's own spacing
       const span=(a,b)=>{const r=document.createRange();r.setStart(...a);r.setEnd(...b);return r};
       const filled=r=>!!r.toString().trim()||!!r.cloneContents().querySelector('img,hr,input,br,figure');
       // A page that begins with the start of a block cuts before the whole block, so the page before does not end
       // with an empty copy of it; those blocks (lead) start the page without their space-before.
       const cuts=starts.map((pos,k)=>{
         const lead=[];if(!k)return {...pos,lead};
         for(let el=pos.node.nodeType===1?pos.node:pos.node.parentNode;el!==flow&&!filled(span([el,0],[pos.node,pos.offset]));el=el.parentNode){lead.push(el);pos={node:el.parentNode,offset:[...el.parentNode.childNodes].indexOf(el)}}
         return {...pos,lead};
       });
       return use(flow,cuts,span,filled);
     }finally{master.remove()}
   }
   function pageFragments(){
     return withPageCuts((flow,cuts,span,filled)=>{
       const up=(node,fn)=>{for(let a=node.nodeType===1?node:node.parentNode;a&&a!==flow;a=a.parentNode)fn(a)};
       return cuts.map((from,k)=>{
         const to=cuts[k+1],marked=[],mark=(el,cut)=>{el.dataset.printCut=((el.dataset.printCut||'')+' '+cut).trim();marked.push(el)},r=document.createRange();
         r.setStart(from.node,from.offset);if(to)r.setEnd(to.node,to.offset);else r.setEnd(flow,flow.childNodes.length);
         from.lead.forEach(el=>mark(el,'lead'));
         up(from.node,a=>{
           mark(a,'before');
           // A list cut mid-way carries on numbering from the item the page starts in (or with).
           if(a.tagName==='OL'){const at=span([from.node,from.offset],[from.node,from.offset]),i=[...a.children].filter(c=>c.tagName==='LI').findIndex(li=>at.comparePoint(li,li.childNodes.length)>=0);if(i>0){a.dataset.printStart=a.start+i;marked.push(a)}}
         });
         if(to){
           up(to.node,a=>{if(filled(span([to.node,to.offset],[a,a.childNodes.length])))mark(a,'after')});
           // Blocks that end the page lose their space-after too, so the page's last line is its last thing.
           let tail=to.node.nodeType===1?to.node.childNodes[to.offset-1]:null;
           while(tail&&tail.nodeType!==1&&!tail.textContent.trim())tail=tail.previousSibling;
           for(;tail?.nodeType===1;tail=tail.lastElementChild)mark(tail,'tail');
         }
         // A page that lies inside one block (a long list, quote or code block) still needs that block around it.
         let piece=r.cloneContents();
         for(let a=r.commonAncestorContainer.nodeType===1?r.commonAncestorContainer:r.commonAncestorContainer.parentNode;a&&a!==flow;a=a.parentNode){const shell=a.cloneNode(false);shell.append(piece);piece=shell}
         const holder=document.createDocumentFragment();holder.append(piece);marked.forEach(el=>{delete el.dataset.printCut;delete el.dataset.printStart});
         holder.querySelectorAll('[data-print-start]').forEach(ol=>ol.setAttribute('start',ol.dataset.printStart));
         return holder;
       });
     });
   }
   function exportPdf(layout='pages'){
     const dark=document.body.classList.contains('dark'),option=(name,value,on,label,hint)=>`<label><input type="radio" name="${name}" value="${value}" ${on?'checked':''}><span><b>${label}</b><small>${hint}</small></span></label>`;
     dialog('Export PDF',`<p class="notebook-pdf-label">Layout</p><div class="notebook-pdf-form" role="radiogroup" aria-label="Layout">${option('notebookPdfLayout','pages',layout!=='book','Pages','One page after another, as in page view and Word.')}${option('notebookPdfLayout','book',layout==='book','Book','Two pages side by side, as in Book View.')}</div>${dark?`<p class="notebook-pdf-label">Colours</p><div class="notebook-pdf-form" role="radiogroup" aria-label="Colours">${option('notebookPdfTheme','dark',true,'Dark, as on screen','The colours you see now.')}${option('notebookPdfTheme','light',false,'Light paper','Best for printing.')}</div>`:''}<p class="muted">Your browser's print window opens with a preview of every page. Choose <b>Save as PDF</b> as the destination (or pick a printer), then save.</p>`,[['Cancel',dismiss],['Export PDF',()=>{
       const pick=name=>$(`[name=${name}]:checked`)?.value;const choice={layout:pick('notebookPdfLayout'),light:pick('notebookPdfTheme')!=='dark'};dismiss();printNote(choice);
     }]]);
   }
   let printed=null;
   async function printNote({layout,light}){
     printed?.();
     const p=PAGE,book=layout==='book',room=p.h-p.top-p.bottom,theme=getComputedStyle(light?document.documentElement:document.body),value=n=>theme.getPropertyValue(n).trim();
     const paper=value('--panel')||'#fff',folio=`font:11px ${getComputedStyle(document.body).fontFamily};color:${value('--muted')||'#71778d'};font-variant-numeric:tabular-nums;vertical-align:top;padding-top:${Math.round(p.bottom*.45)}px`;
     // Book sheets number their two pages 1–2, 3–4…: counter styles map the sheet number to those page numbers.
     const numbers=from=>Array.from({length:1000},(_,i)=>`"${2*i+from}"`).join(' ');
     const style=document.createElement('style');style.textContent=`@page{size:${book?2*p.w:p.w}px ${p.h}px;margin:${p.top}px ${p.side}px ${p.bottom}px;background:${paper};${book?`@bottom-left{content:counter(page,notebook-left-page);${folio};text-align:center;width:50%;box-sizing:border-box;padding-right:${p.side}px}@bottom-right{content:counter(page,notebook-right-page);${folio};text-align:center;width:50%;box-sizing:border-box;padding-left:${p.side}px}`:`@bottom-center{content:counter(page);${folio}}`}}
       ${book?`@counter-style notebook-left-page{system:fixed;symbols:${numbers(1)}}@counter-style notebook-right-page{system:fixed;symbols:${numbers(2)}}`:''}
       @media screen{.notebook-print{display:none!important}}
       @media print{html,body{margin:0!important;padding:0!important;width:auto!important;height:auto!important;min-height:0!important;overflow:visible!important;background:${paper}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}body>:not(.notebook-print){display:none!important}
         .notebook-print{display:block!important;color:var(--text)}.notebook-print>.notebook-document{width:auto;max-width:none;min-height:0;margin:0;padding:0!important;overflow:visible}
         .notebook-print>.notebook-document>:not(:last-child){break-after:page}.notebook-print-sheet{display:flex;align-items:flex-start;gap:${2*p.side}px}.notebook-print-sheet>.notebook-print-page{flex:0 0 ${p.w-2*p.side}px;min-width:0}
         .notebook-print [data-print-cut~=lead]{margin-top:0!important}.notebook-print [data-print-cut~=before]{margin-top:0!important;padding-top:0!important;border-top-width:0!important;border-top-left-radius:0!important;border-top-right-radius:0!important}.notebook-print [data-print-cut~=after]{margin-bottom:0!important;padding-bottom:0!important;border-bottom-width:0!important;border-bottom-left-radius:0!important;border-bottom-right-radius:0!important}.notebook-print [data-print-cut~=tail]{margin-bottom:0!important}.notebook-print li[data-print-cut~=before]{list-style-type:none}
         .notebook-print pre{overflow:visible}.notebook-print img{max-height:${room-8}px;vertical-align:bottom}.notebook-print input{pointer-events:none}}`;
     const box=document.createElement('div'),sheet=document.createElement('div');box.className='notebook-print';box.setAttribute('aria-hidden','true');sheet.className='notebook-document';box.append(sheet);
     for(const name of ['--bg','--panel','--panel2','--text','--muted','--line','--primary','--primary2'])if(value(name))box.style.setProperty(name,value(name));
     await showInk();
     // Book sheets hold two pages side by side; otherwise every page is a printed page of its own.
     pageFragments().forEach((piece,k)=>{
       const page=document.createElement('div');page.className='notebook-print-page';page.append(piece);
       if(!book)sheet.append(page);else{if(k%2===0)sheet.append(Object.assign(document.createElement('div'),{className:'notebook-print-sheet'}));sheet.lastChild.append(page)}
     });
     // The zero-width placeholders left by formatting at the cursor are not printed.
     const blank=String.fromCharCode(0x200b),texts=document.createTreeWalker(box,NodeFilter.SHOW_TEXT);
     while(texts.nextNode())if(texts.currentNode.data.includes(blank))texts.currentNode.data=texts.currentNode.data.split(blank).join('');
     const name=document.title;document.head.append(style);document.body.append(box);document.title=title.value.trim()||'Untitled Note';
     printed=()=>{printed=null;box.remove();style.remove();document.title=name;removeEventListener('afterprint',printed)};
     addEventListener('afterprint',printed);
     // Pictures must be ready before the browser takes its copy for printing.
     await Promise.all([...box.querySelectorAll('img')].map(img=>Promise.race([img.decode().catch(()=>{}),new Promise(r=>setTimeout(r,3000))])));
     const was=status.textContent;status.textContent='Print window open · choose Save as PDF';print();
     if(!disposed&&status.textContent.startsWith('Print window'))status.textContent=was;
   }
   // Page view: the note laid out on fixed-size pages, the same pages book view shows. Off when the editor is too narrow.
   let pageView=true,pageCount=1,pageFrame=0,pageTimer=0;try{pageView=localStorage.getItem('notebook.pageView')!=='false'}catch{}
   const editorEl=$('.notebook-editor'),scroller=$('.notebook-paper-scroll'),sheetLayer=$('.notebook-sheets'),edgeLayer=$('.notebook-sheet-edges'),pageRules=document.createElement('style'),pageStep=PAGE.h+PAGE.gap,pushes=new Map();
   host.append(pageRules);for(const [k,v] of Object.entries(PAGE))editorEl.style.setProperty('--page-'+k,v+'px');
   function currentPage(){return Math.min(pageCount,Math.max(1,Math.floor((scroller.getBoundingClientRect().top+scroller.clientHeight/3-doc.getBoundingClientRect().top)/pageStep)+1))}
   function showPage(){$('#notebookPage').textContent=editorEl.classList.contains('paged')?`Page ${currentPage()} of ${pageCount}`:''}
   // Push margins live in a stylesheet keyed by position (and the page shape in the editor's own style), so the
   // editable content, undo history and saved HTML stay untouched.
   function pushRule(el,path,m){
     const key=path.map(i=>`>:nth-child(${i+1})`).join('');if(m==null)pushes.delete(key);else pushes.set(key,m);
     pageRules.textContent=[...pushes].map(([k,v])=>`#notebookDocument${k}{margin-top:${v.toFixed(2)}px!important}`).join('');
   }
   function layoutPages(){
     const on=pageView&&scroller.clientWidth>=PAGE.w+56;editorEl.classList.toggle('paged',on);pushes.clear();pageRules.textContent='';
     if(on){
       const keep=scroller.scrollTop;
       pageCount=paginate(doc,PAGE,pushRule,pageCount);editorEl.style.setProperty('--pages',pageCount);
       // Sheets lie under the text; their edges (margins and the gap between pages) are drawn over it, hiding any
       // code block or callout background that runs on from one page to the next.
       if(sheetLayer.children.length!==pageCount){
         sheetLayer.innerHTML=Array.from({length:pageCount},(_,k)=>`<div style="top:${k*pageStep}px"><span>${k+1}</span></div>`).join('');
         edgeLayer.innerHTML=Array.from({length:pageCount-1},(_,k)=>`<div style="top:${k*pageStep+PAGE.h-PAGE.bottom}px"><span>${k+1}</span></div>`).join('');
       }
       scroller.scrollTop=keep;
     }else{doc.style.removeProperty('--page-shape');doc.style.removeProperty('--page-float')}
     showPage();if(sidebar==='outline')panel();
   }
   // Layout runs in the next frame, or after a pause (while typing); a sooner request replaces a later one.
   function schedulePages(delay=0){
     if(pageFrame)return;clearTimeout(pageTimer);pageTimer=0;
     if(delay)pageTimer=setTimeout(()=>{pageTimer=0;schedulePages()},delay);else pageFrame=requestAnimationFrame(()=>{pageFrame=0;layoutPages()});
   }
   const pageObserver=new ResizeObserver(()=>schedulePages());pageObserver.observe(scroller);
   scroller.addEventListener('scroll',showPage,{passive:true});doc.addEventListener('load',()=>schedulePages(),true);document.fonts?.ready.then(()=>{if(!disposed)schedulePages()});
   // Book view: the note's pages as a two-page spread (one page when only one fits). On phones a full page would be
   // too small to read, so the note is laid out again on pages the size of the screen.
   let book=null;
   function bookView(){
     if(book)return;
     const el=document.createElement('div'),bb=(label,name,extra='')=>`<button type="button" data-book="${name}" ${extra}>${label}</button>`;
     let page=0,total=1,per=2,geo=PAGE,flow=null,headPages=[],size='',wheelAt=0,touch=null,frame=0;
     el.className='notebook-book';el.tabIndex=-1;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Book view');
     el.innerHTML=`<header class="notebook-book-bar"><strong></strong><select data-book="contents" aria-label="Jump to section"></select>${bb('⬇ PDF','pdf','title="Export these pages as a PDF"')}${bb('⛶ Full Screen','fullscreen','aria-pressed="false"')}${bb('✕ Close','close','aria-label="Close book view"')}</header><div class="notebook-book-desk">${bb('‹','prev','class="notebook-book-turn" aria-label="Previous page"')}<div class="notebook-book-spread"><div class="notebook-book-page" aria-hidden="true"></div><div class="notebook-book-page" aria-hidden="true"></div></div>${bb('›','next','class="notebook-book-turn" aria-label="Next page"')}</div><footer><input type="range" min="0" max="0" value="0" aria-label="Go to page"><span role="status"></span></footer><div class="notebook-book-master" inert aria-hidden="true"></div>`;
     const q=s=>el.querySelector(s),desk=q('.notebook-book-desk'),spread=q('.notebook-book-spread'),sheets=[...el.querySelectorAll('.notebook-book-page')],master=q('.notebook-book-master'),slider=q('input[type=range]'),where=q('footer span'),contents=q('[data-book=contents]'),fsButton=q('[data-book=fullscreen]');
     const step=()=>geo.h+geo.gap,pageOf=node=>pageIndex(node.getBoundingClientRect().top-flow.getBoundingClientRect().top,geo);
     const firstOn=n=>[...flow.children].findIndex(c=>pageOf(c)>=n);
     // at.page is a page number in the shared layout; at.index (a top-level block) is the fallback when the layout differs.
     function layout(at=flow?{index:firstOn(page),page:geo===PAGE?page:null}:{index:0}){
       const w=spread.clientWidth,h=spread.clientHeight,fit=n=>Math.min(h/PAGE.h,w/(n*PAGE.w));let scale=1;size=w+'x'+h;
       if(fit(2)>=.75){per=2;scale=fit(2);geo=PAGE}else if(fit(1)>=.75){per=1;scale=fit(1);geo=PAGE}else{per=1;geo={w:Math.floor(w),h:Math.floor(h),top:28,bottom:44,side:20,gap:0}}
       for(const [k,v] of Object.entries(geo))el.style.setProperty('--page-'+k,v+'px');el.style.setProperty('--book-scale',Math.min(scale,1.35));spread.classList.toggle('single',per===1);
       flow=doc.cloneNode(true);for(const a of [...flow.attributes])flow.removeAttribute(a.name);flow.className='notebook-document notebook-book-flow';
       flow.querySelectorAll('input').forEach(i=>i.disabled=true);flow.querySelectorAll('a').forEach(a=>a.tabIndex=-1);
       master.replaceChildren(flow);total=paginate(flow,geo,inlinePushes());sheets.forEach(s=>s.replaceChildren(flow.cloneNode(true)));
       const heads=[...flow.querySelectorAll('h1,h2,h3')];headPages=heads.map(pageOf);contents.hidden=!heads.length;
       contents.innerHTML='<option value="">Contents</option>'+heads.map((x,i)=>`<option value="${i}">${'  '.repeat(x.tagName[1]-1)}${esc(x.textContent.trim()||'Untitled heading')}</option>`).join('');
       q('.notebook-book-bar strong').textContent=title.value.trim()||'Untitled Note';
       const target=flow.children[at.index];go(geo===PAGE&&at.page!=null?at.page:target?pageOf(target):0,0);
     }
     function go(n,dir=Math.sign(n-page)){
       const was=page;page=Math.max(0,Math.min(total-1,n));page-=page%per;
       sheets.forEach((s,i)=>{s.hidden=i>=per;s.style.setProperty('--at',-(page+i)*step()+'px');s.dataset.folio=page+i<total?page+i+1:''});
       if(page!==was&&dir){spread.classList.remove('turn-next','turn-prev');void spread.offsetWidth;spread.classList.add(dir>0?'turn-next':'turn-prev')}
       const last=Math.min(total,page+per),section=headPages.findLastIndex(p=>p<=page);
       where.textContent=(last>page+1?`Pages ${page+1}–${last}`:`Page ${page+1}`)+` of ${total}`+(geo===PAGE?'':' · fitted to screen');
       slider.max=Math.ceil(total/per)-1;slider.value=page/per;slider.setAttribute('aria-valuetext',where.textContent);
       q('[data-book=prev]').disabled=!page;q('[data-book=next]').disabled=last>=total;contents.value=section<0?'':String(section);
     }
     const isFull=()=>document.fullscreenElement===el||el.classList.contains('expanded');
     function label(){const on=isFull();fsButton.textContent=on?'Exit Full Screen':'⛶ Full Screen';fsButton.setAttribute('aria-pressed',String(on))}
     // Real browser full screen when allowed; otherwise (e.g. iPhone Safari) the book covers the whole window.
     function full(){
       if(document.fullscreenElement===el){document.exitFullscreen().catch(()=>{});return}
       if(el.classList.contains('expanded')){el.classList.remove('expanded');label();return}
       Promise.resolve().then(()=>el.requestFullscreen()).catch(()=>{el.classList.add('expanded');label()});
     }
     const moves={ArrowRight:1,ArrowDown:1,PageDown:1,ArrowLeft:-1,ArrowUp:-1,PageUp:-1};
     function key(ev){
       if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();if(el.classList.contains('expanded'))full();else shut();return true}
       if(ev.ctrlKey||ev.metaKey||ev.altKey||/^(INPUT|SELECT)$/.test(ev.target.tagName))return false;
       const d=ev.key===' '&&ev.target.tagName!=='BUTTON'?(ev.shiftKey?-1:1):moves[ev.key];
       if(d)go(page+d*per);else if(ev.key==='Home'||ev.key==='End')go(ev.key==='Home'?0:total);else if(ev.key.toLowerCase()==='f')full();else return false;
       ev.preventDefault();return true;
     }
     // Closing returns the editor to the page that was open in the book.
     function shut(){
       const index=firstOn(page),samePages=geo===PAGE&&editorEl.classList.contains('paged'),target=page;
       if(document.fullscreenElement===el)document.exitFullscreen().catch(()=>{});
       ro.disconnect();cancelAnimationFrame(frame);document.removeEventListener('fullscreenchange',label);el.remove();covered.forEach(n=>n.inert=false);book=null;
       if(target!==start)if(samePages)scroller.scrollTop+=doc.getBoundingClientRect().top+target*pageStep-scroller.getBoundingClientRect().top-16;else doc.children[index]?.scrollIntoView({block:'start'});
       if(!disposed){showPage();$('[data-action=book]').focus()}
     }
     el.querySelectorAll('button[data-book]').forEach(b=>b.onclick=()=>({prev:()=>go(page-per),next:()=>go(page+per),fullscreen:full,close:shut,pdf:()=>exportPdf('book')})[b.dataset.book]());
     contents.onchange=()=>{const i=contents.value;if(i){go(headPages[+i]);contents.value=i}};slider.oninput=()=>go(+slider.value*per);
     sheets.forEach(s=>s.onscroll=()=>{s.scrollTop=s.scrollLeft=0});
     desk.addEventListener('wheel',ev=>{if(ev.ctrlKey)return;ev.preventDefault();const d=Math.abs(ev.deltaX)>Math.abs(ev.deltaY)?ev.deltaX:ev.deltaY;if(Math.abs(d)<2)return;const quiet=Date.now()-wheelAt>250;wheelAt=Date.now();if(quiet)go(page+Math.sign(d)*per)},{passive:false});
     desk.addEventListener('touchstart',ev=>{touch=ev.touches.length===1?[ev.touches[0].clientX,ev.touches[0].clientY]:null},{passive:true});
     desk.addEventListener('touchend',ev=>{if(!touch)return;const t=ev.changedTouches[0],dx=t.clientX-touch[0],dy=t.clientY-touch[1];touch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)go(page+(dx<0?per:-per))},{passive:true});
     document.addEventListener('fullscreenchange',label);
     // Open on the page the editor is showing (or, without page view, at the block at the top of the editor).
     const top=scroller.getBoundingClientRect().top+8,index=Math.max(0,[...doc.children].findIndex(c=>c.getBoundingClientRect().bottom>top));
     const covered=[...editorEl.children].filter(n=>n.id!=='notebookDialog');covered.forEach(n=>n.inert=true);
     editorEl.append(el);layout({index,page:editorEl.classList.contains('paged')?currentPage()-1:null});const start=page;el.focus();
     const ro=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(spread.clientWidth+'x'+spread.clientHeight!==size)layout()})});ro.observe(desk);
     book={key,close:shut,refresh:()=>layout({index:firstOn(page)})};
   }
   const actions={
     save,close,book:bookView,handwriting:addHandwriting,
     pin:()=>{note.is_pinned=note.is_pinned?0:1;const b=$('[data-action=pin]');b.textContent=note.is_pinned?'⌖ Pinned':'⌖ Pin';b.setAttribute('aria-pressed',String(!!note.is_pinned));changed()},
     fullscreen:()=>{const full=$('.notebook-editor').classList.toggle('fullscreen');$('[data-action=fullscreen]').textContent=full?'Exit Full Screen':'⛶ Full Screen'},
     pages:()=>{pageView=!pageView;try{localStorage.setItem('notebook.pageView',String(pageView))}catch{}$('[data-action=pages]').setAttribute('aria-pressed',String(pageView));layoutPages()},
     sidebar:()=>{const hidden=$('.notebook-editor').classList.toggle('side-hidden');try{localStorage.setItem('notebook.hideSidebar',String(hidden))}catch{}},
     undo:()=>travel(-1),redo:()=>travel(1),grow:()=>stepSize(1),shrink:()=>stepSize(-1),
     heading:()=>command('formatBlock','h2'),quote:()=>command('formatBlock','blockquote'),divider:()=>insert('<hr><p><br></p>'),
     checklist:()=>insert('<ul><li><input type="checkbox"> '+esc(selectedText()||'Task')+'</li></ul><p><br></p>'),
     highlight:()=>insert('<mark>'+esc(selectedText()||'Highlighted text')+'</mark>'),inlinecode:()=>insert('<code>'+esc(selectedText()||'code')+'</code>'),
     code:()=>insert('<pre><code>'+esc(selectedText()||'Write code here')+'</code></pre><p><br></p>'),
     callout:()=>dialog('Insert a study callout','<p>Choose a callout type.</p>',[['Cancel',dismiss],...Object.entries({takeaway:'💡 Key Takeaway',important:'⚠ Important',tip:'✓ Exam Tip',example:'✎ Example',question:'? Question'}).map(([k,l])=>[l,()=>{dismiss();insert(`<aside data-callout="${k}"><b>${l}</b><p>${esc(selectedText()||'Your key idea')}</p></aside><p><br></p>`)}])]),
     image:()=>$('#notebookImage').click(),link:()=>dialog('Insert link','<label>URL (https:// or mailto:)<input id="notebookLink" type="url" placeholder="https://…"></label>',[['Cancel',dismiss],['Insert',()=>{const url=$('#notebookLink').value.trim();if(!/^(https?:\/\/|mailto:)/i.test(url)){status.textContent='Use an https://, http:// or mailto: link.';return}const label=selectedText()||url;dismiss();insert(`<a href="${esc(url)}">${esc(label)}</a>`)}]]),
     more:()=>shared?dialog('Shared note',`<p>${esc(shared.ownerName)} shared this note with you. Their latest saved version always shows here.</p>`,[['Close',dismiss],...(readOnly?[[shared.request?'Edit request sent':'✋ Ask to edit',async()=>{if(shared.request)return;try{await shared.requestEdit();shared.request=true;dismiss();status.textContent='Asked to edit. The answer will appear in your messages.'}catch(err){status.textContent=err.message}}]]:[]),[shared.saved?'Remove from my subjects':'Save to my subjects',async()=>{dismiss();try{if(shared.saved){await shared.unsave();shared.saved=false}else if(await shared.saveToSubjects())shared.saved=true}catch(err){status.textContent=err.message}}],['📄 Export PDF',()=>exportPdf()],['Export HTML',exportHtml],['Stop receiving this note',()=>dialog('Stop receiving this note?','<p>It disappears from your notes. The owner keeps it and can share it again.</p>',[['Keep it',dismiss],['Stop receiving',async()=>{try{await shared.leave();clearRecovery();dispose()}catch(err){status.textContent=err.message}}]])]]):dialog('Note actions','<p>Organise, export, or manage this note.</p>',[['Close',dismiss],...(o.share?[['👥 Share with friends',async()=>{if(!await save())return;dismiss();o.share({...snapshot(),updated_at:note.updated_at})}]]:[]),['Rename',()=>{dismiss();title.focus()}],['Move to Topic',()=>{dismiss();$('#notebookTopic').focus()}],['Change Week',()=>{dismiss();$('#notebookWeek').focus()}],['Edit tags',()=>dialog('Tags',`<input id="notebookTags" value="${esc((note.tags||[]).join(', '))}" aria-label="Tags, comma separated">`,[['Cancel',dismiss],['Apply',()=>{note.tags=$('#notebookTags').value.split(',').map(s=>s.trim()).filter(Boolean);dismiss();changed()}]])],['Duplicate Note',async()=>{if(!await save())return;try{await api('/api/portal',{table:'notes',item:{...snapshot(),id:id(),title:snapshot().title+' (copy)',base_updated_at:null}});await o.refresh();dismiss();status.textContent='Saved · Duplicate created in your library'}catch(err){status.textContent=err.message}}],['📄 Export PDF',()=>exportPdf()],['Export HTML',exportHtml],['Delete Note',()=>dialog('Delete this note?','<p>This cannot be undone.</p>',[['Keep note',dismiss],['Delete',async()=>{clearTimeout(timer);if(pending)await pending;try{await api('/api/portal/delete',{table:'notes',id:note.id});await o.refresh();dispose()}catch(err){status.textContent=err.message}}]])]])
   };
   host.querySelectorAll('[data-action]').forEach(b=>{b.onmousedown=ev=>ev.preventDefault();b.onclick=()=>{const a=b.dataset.action;if(a.startsWith('tab-')){sidebar=a.slice(4);panel()}else if(actions[a])actions[a]();else command(a)}});
   $('#notebookHeading').onchange=ev=>command('formatBlock',ev.target.value);$('#notebookImage').onchange=ev=>{image(ev.target.files[0]);ev.target.value=''};
   // Font size: type a number of points and press Enter (Escape or leaving the box keeps the old size), or pick one.
   const sizeBox=$('#notebookFontSize');sizeBox.onblur=()=>syncToolbar(true);
   $('#notebookFontSizes').onchange=ev=>{const v=+ev.target.value;ev.target.value='';if(v)setSize(v)};
   $('#notebookLineSpacing').onchange=ev=>{const v=ev.target.value;ev.target.value='';if(v==='options')spacingOptions();else if(v)lineSpacing(v)};
   $('#notebookLetterSpacing').onchange=ev=>{const v=ev.target.value;ev.target.value='';if(v==='custom')customLetters();else if(v)letterSpacing(+v)};
   $('.notebook-color-btn').style.setProperty('--note-ink',$('#notebookColor').value);$('#notebookColor').onchange=ev=>{const c=ev.target.value;$('.notebook-color-btn').style.setProperty('--note-ink',c);styleText('color',c)};
   [title,$('#notebookWeek'),$('#notebookTopic')].forEach(el=>el.oninput=changed);$('#notebookSubject').onchange=()=>{note.topic_name=null;topics();changed()};
   doc.oninput=()=>{typed();changed()};
   // Browser undo (menu, shortcut, gesture) uses this editor's history; the first keystroke of a burst notes the caret.
   doc.addEventListener('beforeinput',ev=>{if(/^history(Undo|Redo)$/.test(ev.inputType)){ev.preventDefault();travel(ev.inputType==='historyUndo'?-1:1)}else if(!past.timer&&!past.before)past.before=caretNow()});
   doc.addEventListener('compositionstart',()=>{past.composing=true});doc.addEventListener('compositionend',()=>{past.composing=false;typed()});
   doc.addEventListener('change',ev=>{if(ev.target.type==='checkbox'){beginEdit();ev.target.toggleAttribute('checked',ev.target.checked);record();changed()}});
   doc.onpaste=ev=>{ev.preventDefault();const file=[...ev.clipboardData.files].find(f=>f.type.startsWith('image/'));if(file){image(file);return}const rich=ev.clipboardData.getData('text/html');insert(rich?sanitize(rich):esc(ev.clipboardData.getData('text/plain')).replace(/\n/g,'<br>'))};
   doc.ondrop=ev=>{ev.preventDefault();const file=ev.dataTransfer.files[0];if(file)image(file);else insert(esc(ev.dataTransfer.getData('text/plain')))};
   function unload(ev){if(revision!==savedRevision||pending){ev.preventDefault();ev.returnValue=''}}window.addEventListener('beforeunload',unload);
   function keys(ev){
     if(ink&&$('#notebookDialog').hidden&&ink.key(ev))return;
     if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();save();return}
     if(book&&$('#notebookDialog').hidden&&book.key(ev))return;
     if(ev.target===sizeBox&&(ev.key==='Enter'||ev.key==='Escape')){
       ev.preventDefault();ev.stopImmediatePropagation();
       if(ev.key==='Enter')setSize(parseFloat(sizeBox.value.replace(',','.')));else{syncToolbar(true);restore()}
       return;
     }
     if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();if(!$('#notebookDialog').hidden)dismiss();else close();return}
     if((ev.ctrlKey||ev.metaKey)&&doc.contains(ev.target)){
       const k=ev.key.toLowerCase();
       if(k==='z'||k==='y'){ev.preventDefault();travel(k==='y'||ev.shiftKey?1:-1);return}
       // Word's shortcuts: Ctrl+Shift+> and < step through the size list, Ctrl+] and [ change the size by 1 pt.
       if(ev.shiftKey&&/^[<>,.]$/.test(ev.key)){ev.preventDefault();stepSize(/[>.]/.test(ev.key)?1:-1);return}
       if(ev.key===']'||ev.key==='['){ev.preventDefault();nudgeSize(ev.key===']'?1:-1);return}
       const cmd={b:'bold',i:'italic',u:'underline'}[k];if(cmd){ev.preventDefault();command(cmd)}
     }
     if(ev.key==='Tab'){const box=$('#notebookDialog').hidden?ink?.element||$('.notebook-book')||host:$('#notebookDialog'),els=[...box.querySelectorAll('button,input,select,[contenteditable]')].filter(el=>!el.disabled&&el.offsetParent!==null);if(ev.shiftKey&&document.activeElement===els[0]){ev.preventDefault();els.at(-1).focus()}else if(!ev.shiftKey&&document.activeElement===els.at(-1)){ev.preventDefault();els[0].focus()}}
   }document.addEventListener('keydown',keys,true);
   $('[data-action=pages]').setAttribute('aria-pressed',String(pageView));
   try{if(localStorage.getItem('notebook.hideSidebar')==='true'||innerWidth<700)$('.notebook-editor').classList.add('side-hidden')}catch{}
   async function remote(next){
     if(disposed)return;if(pending)try{await pending}catch{}
     if(disposed)return;
     if(!next||next.deleted){dialog('This note is no longer available','<p>It was deleted, or it is no longer shared with you.</p>',[['Close',()=>{clearRecovery();dispose()}]]);return}
     if(next.updated_at===note.updated_at)return;
     const apply=()=>{note={...note,...next,base_updated_at:next.updated_at};title.value=next.title;doc.innerHTML=html(next)||'<p><br></p>';resetHistory();savedRevision=revision;clearRecovery();clearSaveError();status.textContent='Updated just now';$('#notebookEdited').textContent='Last edited '+new Date(next.updated_at).toLocaleString();update()};
     if(revision===savedRevision){apply();return}
     dialog('This note was just changed','<p>Someone else saved a newer version while you were editing. Load it (your unsaved changes here are discarded), or keep editing: saving will then ask you to reload first.</p>',[['Keep my changes',dismiss],['Load the new version',()=>{dismiss();apply()}]]);
   }
   const stopWatching=o.watch?.(remote);
   resetHistory();update();if(!readOnly)doc.focus();
   if(recovery&&(recovery.id===note.id||!note.updated_at))dialog('Recover unsaved draft?','<p>A local recovery copy was found for this subject. Restore it to the editor, then save it to SQLite. If another device changed the note, saving will report a conflict rather than overwrite it.</p>',[['Not now',dismiss],['Restore draft',()=>{note={...recovery};recoveryKey=recoveryPrefix+note.id;title.value=note.title;$('#notebookSubject').value=note.subject_id;topics();$('#notebookWeek').value=note.week||'';doc.innerHTML=html(note);resetHistory();$('[data-action=pin]').textContent=note.is_pinned?'⌖ Pinned':'⌖ Pin';dismiss();changed()}]]);
   return {dispose};
 }
 g.StudentNotebook={createNotes,sanitize,plain};
})(window);
