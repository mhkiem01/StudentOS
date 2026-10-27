/* CTF practice: capture-the-flag challenges inside a subject's topics, next to its quizzes.
   The server checks flags against salted hashes, sends hints one at a time and keeps solutions
   hidden until earned (backend/study/ctf_store.py). Challenges are solved on your own machine. */
(function(g){'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATEGORIES={pwn:'Pwn',rev:'Reversing',web:'Web',crypto:'Crypto',forensics:'Forensics',misc:'Misc',osint:'OSINT'};
const POINTS={easy:100,medium:200,hard:300,insane:500};
const size=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
const when=d=>d?new Date(d).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'';
// Safe formatting for descriptions and solutions: ``` fenced code, `inline code` and paragraphs.
function rich(source){
 const out=[];let code=null,para=[];
 const flush=()=>{if(para.length)out.push('<p>'+para.map(l=>E(l).replace(/`([^`]+)`/g,'<code>$1</code>')).join('<br>')+'</p>');para=[]};
 for(const line of String(source||'').replace(/\r\n/g,'\n').split('\n')){
  if(line.trim().startsWith('```')){if(code){out.push('<pre><code>'+E(code.join('\n'))+'</code></pre>');code=null}else{flush();code=[]}continue}
  if(code)code.push(line);else if(line.trim())para.push(line);else flush();
 }
 if(code)out.push('<pre><code>'+E(code.join('\n'))+'</code></pre>');flush();return out.join('');
}
function prompt({subject,topic,count,level,focus}){return `Create ${count} capture-the-flag practice challenges for the topic "${topic}" in my ${subject} course${focus?`, focusing on: ${focus}`:''}.
${level==='mixed'?'Mix the difficulties, from easy warm-ups to harder ones.':`Make every challenge ${level} difficulty.`} Use the categories that suit the topic.

Make every challenge self-contained and solvable from its description alone: include any source code, disassembly, hex dumps, encoded data or memory layout that is needed. Do not rely on a server or files I do not have.
For binary challenges (pwn or rev), give the full C source and a one-line build command (for example: gcc -fno-stack-protector -no-pie -o chall chall.c) so I can compile it and open the binary in Binary Ninja, and include the exact checksec output.
The flag must follow exactly from solving the challenge, and the Solution must show every step that leads to it.

Reply with ONLY the challenges as plain text in this EXACT format, with a blank line between challenges. No introduction, no closing remarks, no code block around the whole answer.

Challenge: [short title]
Category: [pwn, rev, web, crypto, forensics, misc or osint]
Difficulty: [easy, medium, hard or insane]
Points: [100, 200, 300 or 500]
Flag: FLAG{...}
Flag format: FLAG{...}
Hint: [a small nudge]
Hint: [a bigger nudge]
Description:
[the challenge text; put code inside \`\`\` fences]
Solution:
[step-by-step solution ending with the flag]

Rules: no markdown headings, bold text or tables, and never reveal the flag in the Description or the Hints.`}
async function copy(text,button){
 try{await navigator.clipboard.writeText(text);button.textContent='Copied ✓'}
 catch{const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;opacity:0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();button.textContent=ok?'Copied ✓':'Copy failed: select the text manually'}
 setTimeout(()=>button.textContent=button.dataset.label||'Copy',2500);
}

function create(o){
 let data={subjects:[],challenges:[]},loaded=false,loads=0,inflight=0,mounted=null,filters={topic:'',category:'',status:''},current=null,notesTimer=null,codeTimer=null;
 const dialog=document.createElement('dialog');dialog.className='ctf-dialog';document.body.append(dialog);
 dialog.addEventListener('close',()=>{current=null;clearTimeout(notesTimer);clearTimeout(codeTimer)});
 async function api(payload){
  let r;
  try{r=await fetch('/api/ctf',payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})}
  catch{throw Error('The portal could not be reached. Check that this device is online (and connected to Tailscale if you use it), then try again.')}
  const j=await r.json().catch(()=>null);
  // A proxy such as Tailscale answers 502/504 itself when the portal server is not running or is restarting.
  if(!r.ok)throw Error(j?.error||([502,503,504].includes(r.status)?`The portal server did not answer (error ${r.status}). Make sure it is running, wait a moment and try again.`:`CTF practice could not be updated (error ${r.status}).`));
  return j||{};
 }
 // Only the newest load counts: an older, slower answer must not undo a change made since.
 async function load(){const mine=++loads;inflight++;try{const fresh=await api();if(mine!==loads)return;data=fresh;loaded=true;o.refresh?.();render()}finally{inflight--}}
 const enabled=sid=>data.subjects.includes(sid);
 const byTopic=topic=>data.challenges.filter(c=>c.topic===topic);
 const earned=c=>c.progress.solved&&!c.progress.revealed?c.points:0;
 function counts(topic){const list=byTopic(topic);return {total:list.length,solved:list.filter(c=>c.progress.solved).length}}
 function replace(challenge){if(!challenge)return;const i=data.challenges.findIndex(c=>c.id===challenge.id);if(i<0)data.challenges.push(challenge);else data.challenges[i]=challenge;render();o.refresh?.();if(inflight)load().catch(()=>{})}

 /* Topic page card (only for subjects with CTF practice turned on). */
 function modeCard(topic,sid){
  if(!sid||!enabled(sid))return '';const n=counts(topic);
  return `<article class="mode-card ctf-mode" style="--modeColor:#c2410c"><div class="mode-icon">🚩</div><h3>CTF challenges</h3><p>Capture the flag: solve hands-on challenges for this topic and submit the flag.</p><div class="mode-meta">${n.total?`${n.solved} / ${n.total} solved`:'No challenges yet'}</div><div class="mode-actions"><button class="btn primary" data-ctf-topic-open>${n.total?'Open challenges':'Open CTF practice'}</button><button class="btn secondary" data-ctf-topic-add>✨ Generate with AI</button></div></article>`;
 }
 function bindMode(root,topic,sid){
  root.querySelector('[data-ctf-topic-open]')?.addEventListener('click',()=>o.open(sid,topic));
  root.querySelector('[data-ctf-topic-add]')?.addEventListener('click',()=>{o.open(sid,topic);importDialog(topic)});
 }

 /* Board: scoreboard, filters and challenge cards grouped by topic. */
 function mount(host,sid,topic){mounted={host,sid};filters={topic:topic||'',category:'',status:''};render();if(!loaded)load().catch(err=>{host.innerHTML=`<p role="alert">${E(err.message)}</p>`})}
 function render(){
  if(!mounted||!mounted.host.isConnected)return;
  const {host,sid}=mounted,topics=o.topics(sid),all=data.challenges.filter(c=>topics.includes(c.topic));
  if(!loaded){host.innerHTML='<p role="status">Loading CTF practice…</p>';return}
  const shown=all.filter(c=>(!filters.topic||c.topic===filters.topic)&&(!filters.category||c.category===filters.category)&&(!filters.status||(filters.status==='solved')===c.progress.solved));
  const solved=all.filter(c=>c.progress.solved).length,points=all.reduce((n,c)=>n+c.points,0),score=all.reduce((n,c)=>n+earned(c),0);
  const cats=[...new Set(all.map(c=>c.category))];
  const card=c=>`<button type="button" class="ctf-card${c.progress.solved?' solved':''}" data-ctf-open="${c.id}"><span class="ctf-cat cat-${c.category}">${E(CATEGORIES[c.category])}</span><b>${E(c.title)}</b><span class="ctf-meta">${E(c.difficulty)} · ${c.points} pts</span><span class="ctf-state">${c.progress.solved?(c.progress.revealed?'✓ Solved after the solution':'✓ Solved'):c.progress.revealed?'Solution viewed':c.progress.attempts?`${c.progress.attempts} ${c.progress.attempts===1?'try':'tries'}`:'Not started'}</span></button>`;
  const groups=topics.filter(t=>!filters.topic||t===filters.topic).map(t=>{const list=shown.filter(c=>c.topic===t);if(!list.length&&(filters.category||filters.status||!byTopic(t).length&&!filters.topic))return '';const n=counts(t);return `<section class="ctf-topic"><h3>${E(t)} <small>${n.solved} / ${n.total} solved</small></h3>${list.length?`<div class="ctf-grid">${list.map(card).join('')}</div>`:'<p class="muted">No challenges in this topic yet.</p>'}</section>`}).join('');
  host.innerHTML=`<div class="ctf"><div class="ctf-top"><div class="ctf-score"><span class="ctf-flag" aria-hidden="true">🚩</span><div><b>${solved} / ${all.length} solved</b><small>${score} of ${points} points</small></div><progress max="${all.length||1}" value="${solved}" aria-label="Challenges solved"></progress></div><div class="ctf-buttons"><button type="button" class="btn primary" data-ctf="import">✨ Generate with AI</button><button type="button" class="btn secondary" data-ctf="add">＋ Add your own</button></div></div>
   ${all.length?`<div class="ctf-filters"><label>Topic <select data-ctf-filter="topic"><option value="">All topics</option>${topics.map(t=>`<option value="${E(t)}" ${t===filters.topic?'selected':''}>${E(t)}</option>`).join('')}</select></label><div class="ctf-chips" role="group" aria-label="Category">${['',...cats].map(k=>`<button type="button" class="ctf-chip${filters.category===k?' active':''}" data-ctf-category="${k}" aria-pressed="${filters.category===k}">${k?E(CATEGORIES[k]):'All'}</button>`).join('')}</div><label>Show <select data-ctf-filter="status"><option value="">All</option><option value="open" ${filters.status==='open'?'selected':''}>Unsolved</option><option value="solved" ${filters.status==='solved'?'selected':''}>Solved</option></select></label></div>${groups||'<p class="ctf-empty">No challenges match these filters.</p>'}`
   :`<div class="ctf-empty"><h3>Start practising with AI</h3><ol class="ctf-how"><li><b>Choose</b> a topic and how many challenges you want.</li><li><b>Copy</b> the prompt into ChatGPT, DeepSeek or another AI tool.</li><li><b>Paste</b> its answer back here and start solving.</li></ol><button type="button" class="btn primary" data-ctf="import-empty">✨ Generate challenges with AI</button><p>You can also add challenges from your course (wargames, labs, past CTFs) with “＋ Add your own”. You solve them on your own computer or VM; the portal checks flags and keeps your hints, notes and progress.</p></div>`}</div>`;
  host.querySelector('[data-ctf=add]').onclick=()=>editDialog(null,filters.topic);
  host.querySelectorAll('[data-ctf=import],[data-ctf=import-empty]').forEach(b=>b.onclick=()=>importDialog(filters.topic));
  host.querySelectorAll('[data-ctf-filter]').forEach(s=>s.onchange=()=>{filters[s.dataset.ctfFilter]=s.value;render()});
  host.querySelectorAll('[data-ctf-category]').forEach(b=>b.onclick=()=>{filters.category=b.dataset.ctfCategory;render()});
  host.querySelectorAll('[data-ctf-open]').forEach(b=>b.onclick=()=>show(b.dataset.ctfOpen));
 }

 const VERDICT={correct:['✓','Looks correct','ok'],close:['●','Almost — small fixes','warn'],wrong:['✕','Not there yet','bad']};
 function reviewHtml(rev){if(!rev)return '';const v=VERDICT[rev.verdict]||VERDICT.close;
  return `<div class="ctf-verdict ${v[2]}"><b>${v[0]} ${E(v[1])}</b>${rev.model?`<small>reviewed by ${E(rev.model)}</small>`:''}</div>${rev.summary?`<p>${E(rev.summary)}</p>`:''}${rev.issues&&rev.issues.length?`<ul class="ctf-issues">${rev.issues.map(i=>`<li><b>${E(i.problem)}</b>${i.fix?`<span>→ ${E(i.fix)}</span>`:''}</li>`).join('')}</ul>`:''}${rev.next_step?`<p class="ctf-next-step">→ ${E(rev.next_step)}</p>`:''}<small class="muted ctf-review-note">AI feedback is a guide, not proof. Run your exploit and submit the real flag above to solve.</small>`}
 /* One challenge: description, connection, files, hints, flag, notes and solution. */
 function show(id){return show_(id)}
 function show_(id){
  const c=data.challenges.find(x=>x.id===id);if(!c)return;current=id;const p=c.progress,more=c.hints_total-c.hints.length;
  // Next: the following unsolved challenge in board order (same subject), wrapping around.
  const order=mounted?data.challenges.filter(x=>o.topics(mounted.sid).includes(x.topic)):data.challenges,at=order.findIndex(x=>x.id===id),next=[...order.slice(at+1),...order.slice(0,Math.max(at,0))].find(x=>!x.progress.solved&&x.id!==id);
  dialog.innerHTML=`<div class="ctf-dialog-inner"><header><div><span class="ctf-cat cat-${c.category}">${E(CATEGORIES[c.category])}</span><span class="ctf-diff">${E(c.difficulty)} · ${c.points} pts</span><h2>${E(c.title)}</h2><small>${E(c.topic)}${c.source?' · '+(/^https?:\/\//.test(c.source)?`<a href="${E(c.source)}" target="_blank" rel="noopener noreferrer">${E(c.source)}</a>`:E(c.source)):''}</small></div><button type="button" class="ctf-x" data-ctf="close" aria-label="Close">×</button></header>
   <p class="ctf-status${p.solved?' solved':''}" role="status">${p.solved?`✓ Solved ${E(when(p.solved_at))}${p.revealed?' (after viewing the solution, so no points)':` · ${c.points} points`}`:`Not solved yet${p.attempts?` · ${p.attempts} ${p.attempts===1?'try':'tries'}`:''}${p.hints_used?` · ${p.hints_used} hint${p.hints_used===1?'':'s'} used`:''}`}</p>
   <div class="ctf-desc">${rich(c.description)}</div>
   ${c.connection?`<div class="ctf-connect"><span>Connect</span><code>${E(c.connection)}</code><button type="button" class="btn secondary small" data-ctf="copy-connect" data-label="Copy">Copy</button></div>`:''}
   <section><h3>Files</h3>${c.files.length?`<ul class="ctf-files">${c.files.map(f=>`<li><a href="/api/ctf/files/${f.id}" download>${E(f.name)}</a><small>${size(f.size)}</small><button type="button" class="ctf-remove" data-ctf-remove-file="${f.id}" aria-label="Remove ${E(f.name)}">✕</button></li>`).join('')}</ul>`:'<p class="muted">No files.</p>'}<label class="btn secondary small ctf-attach">＋ Attach file<input type="file" data-ctf-file hidden></label><small class="muted"> Downloads only, up to 10 MB each. Files are never run by the portal.</small></section>
   <section><h3>Hints</h3>${c.hints.map((h,i)=>`<p class="ctf-hint"><b>Hint ${i+1}</b> ${E(h)}</p>`).join('')}${more?`<button type="button" class="btn secondary small" data-ctf="hint">Reveal hint ${c.hints.length+1} of ${c.hints_total}</button>`:c.hints_total?'':'<p class="muted">No hints for this challenge.</p>'}</section>
   <section class="ctf-submit"><h3>${c.has_flag?'Submit the flag':'Your result'}</h3>${c.has_flag?`<form data-ctf-flag><input name="flag" placeholder="${E(c.flag_format||'FLAG{...}')}" aria-label="Flag" autocomplete="off" spellcheck="false" ${p.solved?`value="${E(p.found_flag)}"`:''}><button class="btn primary" type="submit">Submit flag</button></form><p class="ctf-feedback" role="alert"></p>`:`<p class="muted">No flag is stored for this challenge (for example a course wargame). Mark it solved once you have the flag.</p><form data-ctf-solve><input name="found" placeholder="Flag you found (optional)" aria-label="Flag you found" autocomplete="off" spellcheck="false" value="${E(p.found_flag)}"><button class="btn primary" type="submit">${p.solved?'Update':'Mark as solved'}</button>${p.solved?'<button type="button" class="btn secondary" data-ctf="unsolve">Mark as unsolved</button>':''}</form>`}</section>
   <section><h3>Your notes &amp; writeup</h3><textarea data-ctf-notes rows="6" placeholder="Ideas, offsets, payloads and how you solved it…">${E(p.notes)}</textarea><small class="muted" data-ctf-notes-status>Saved automatically.</small></section>
   <section class="ctf-review"><h3>Your solution <small class="muted">· AI mentor review</small></h3>
   <textarea data-ctf-code rows="10" spellcheck="false" placeholder="Write or paste your solve.py / exploit here. The AI reads it and tells you what to fix — you still run it locally and submit the real flag above.">${E(p.solution_code||'')}</textarea>
   <div class="ctf-review-bar"><button type="button" class="btn primary small" data-ctf="review">✨ Check my code</button><small class="muted" data-ctf-code-status>Saved automatically.</small></div>
   <div class="ctf-review-out" data-ctf-review-out>${p.review?reviewHtml(p.review):''}</div></section>
   ${c.solution!=null?`<section class="ctf-solution"><h3>Solution</h3><div class="ctf-desc">${rich(c.solution)}</div></section>`:c.has_solution?`<section><button type="button" class="btn secondary small" data-ctf="reveal">Show solution</button><small class="muted"> If you view it before solving, the challenge gives no points.</small></section>`:''}
   ${p.history.length?`<details class="ctf-history"><summary>Your submissions (${p.history.length})</summary><ul>${p.history.map(h=>`<li class="${h.correct?'right':'wrong'}"><code>${E(h.submitted)}</code><small>${h.correct?'Correct':'Wrong'} · ${E(when(h.at))}</small></li>`).join('')}</ul></details>`:''}
   <footer>${next?`<button type="button" class="btn primary small ctf-next" data-ctf="next">Next challenge →</button>`:''}<button type="button" class="btn secondary small" data-ctf="edit">Edit</button><button type="button" class="btn secondary small" data-ctf="reset">Start over</button><button type="button" class="btn danger small" data-ctf="delete">Delete</button></footer></div>`;
  const act=async(action,extra={})=>{const r=await api({action,id,data:extra});replace(r.challenge);return r};
  const on=(sel,fn)=>dialog.querySelectorAll(sel).forEach(el=>el.onclick=async ev=>{try{await fn(ev,el)}catch(err){alert(err.message)}});
  on('[data-ctf=close]',()=>dialog.close());
  on('[data-ctf=copy-connect]',(ev,b)=>copy(c.connection,b));
  on('[data-ctf=hint]',async()=>{await act('hint');show(id)});
  on('[data-ctf=reveal]',async()=>{if(!confirm('Show the solution? This challenge will give no points, even if you solve it afterwards.'))return;await act('reveal');show(id)});
  on('[data-ctf=unsolve]',async()=>{await act('solve',{solved:false});show(id)});
  on('[data-ctf=reset]',async()=>{if(!confirm('Start this challenge over? Your tries, hints, solved status and submissions are cleared; your notes stay.'))return;await act('reset');show(id)});
  on('[data-ctf=delete]',async()=>{if(!confirm(`Delete “${c.title}” and its files? This cannot be undone.`))return;await api({action:'delete',id});data.challenges=data.challenges.filter(x=>x.id!==id);dialog.close();render();o.refresh?.()});
  on('[data-ctf=edit]',()=>editDialog(c));
  on('[data-ctf=next]',()=>show_(next.id));
  on('[data-ctf-remove-file]',async(ev,b)=>{if(!confirm('Remove this file?'))return;await api({action:'file_delete',data:{file_id:b.dataset.ctfRemoveFile}});await load();show(id)});
  const flag=dialog.querySelector('[data-ctf-flag]');
  if(flag)flag.onsubmit=async ev=>{ev.preventDefault();const box=flag.elements.flag,button=flag.querySelector('button'),feedback=dialog.querySelector('.ctf-feedback');if(!box.value.trim())return;button.disabled=true;try{const r=await act('submit',{flag:box.value});if(r.correct){show(id);const s=dialog.querySelector('.ctf-status');s.textContent='🎉 Correct! '+s.textContent;s.classList.add('celebrate')}else{feedback.textContent=r.message;box.select()}}catch(err){feedback.textContent=err.message}finally{button.disabled=false}};
  const solve=dialog.querySelector('[data-ctf-solve]');
  if(solve)solve.onsubmit=async ev=>{ev.preventDefault();try{await act('solve',{found_flag:solve.elements.found.value});show(id)}catch(err){alert(err.message)}};
  const file=dialog.querySelector('[data-ctf-file]');
  file.onchange=async()=>{const f=file.files[0];if(!f)return;if(f.size>10*1024*1024)return alert('Choose a file up to 10 MB.');try{const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]||'');reader.onerror=()=>reject(Error('The file could not be read.'));reader.readAsDataURL(f)});await act('file',{name:f.name,base64});show(id)}catch(err){alert(err.message)}};
  const notes=dialog.querySelector('[data-ctf-notes]'),status=dialog.querySelector('[data-ctf-notes-status]');
  const saveNotes=async()=>{clearTimeout(notesTimer);try{const r=await api({action:'notes',id,data:{notes:notes.value}});const i=data.challenges.findIndex(x=>x.id===id);if(i>=0)data.challenges[i]=r.challenge;status.textContent='Saved ✓'}catch(err){status.textContent=err.message}};
  notes.oninput=()=>{status.textContent='Saving…';clearTimeout(notesTimer);notesTimer=setTimeout(saveNotes,800)};notes.onblur=()=>{if(status.textContent==='Saving…')saveNotes()};
  const code=dialog.querySelector('[data-ctf-code]'),codeStatus=dialog.querySelector('[data-ctf-code-status]'),reviewOut=dialog.querySelector('[data-ctf-review-out]');
  const saveCode=async()=>{clearTimeout(codeTimer);try{const r=await api({action:'code',id,data:{code:code.value}});const i=data.challenges.findIndex(x=>x.id===id);if(i>=0)data.challenges[i]=r.challenge;codeStatus.textContent='Saved ✓'}catch(err){codeStatus.textContent=err.message}};
  code.oninput=()=>{codeStatus.textContent='Saving…';clearTimeout(codeTimer);codeTimer=setTimeout(saveCode,800)};code.onblur=()=>{if(codeStatus.textContent==='Saving…')saveCode()};
  on('[data-ctf=review]',async(ev,b)=>{if(!code.value.trim()){reviewOut.innerHTML='<p class="muted">Write your solution first, then ask for a review.</p>';return}if(codeStatus.textContent==='Saving…')await saveCode();b.disabled=true;const label=b.textContent;b.textContent='Reviewing…';reviewOut.innerHTML='<p class="muted" role="status">Asking the AI mentor — this can take a few seconds…</p>';
   try{const res=await fetch('/api/ctf/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,code:code.value})});const j=await res.json().catch(()=>null);if(!res.ok||!j||!j.ok)throw Error(j&&j.error?j.error:`The review could not be completed (error ${res.status}).`);const i=data.challenges.findIndex(x=>x.id===id);if(i>=0&&j.challenge)data.challenges[i]=j.challenge;reviewOut.innerHTML=reviewHtml(j.review)}
   catch(err){reviewOut.innerHTML=`<p class="ctf-feedback">${E(err.message)}</p>`}finally{b.disabled=false;b.textContent=label}});
  if(!dialog.open)dialog.showModal();
 }

 /* Add or edit one challenge. */
 function editDialog(c,topic){
  const sid=mounted?.sid,topics=o.topics(sid);if(!topics.length)return alert('Add a topic to this subject first.');
  const pick=c?.topic||topic||topics[0];
  dialog.innerHTML=`<form class="ctf-dialog-inner ctf-form"><header><h2>${c?'Edit challenge':'Add a challenge'}</h2><button type="button" class="ctf-x" data-ctf="close" aria-label="Close">×</button></header>
   <label>Title<input name="title" required maxlength="160" value="${E(c?.title||'')}"></label>
   <div class="ctf-row"><label>Topic<select name="topic_name">${topics.map(t=>`<option value="${E(t)}" ${t===pick?'selected':''}>${E(t)}</option>`).join('')}</select></label><label>Category<select name="category">${Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}" ${k===(c?.category||'pwn')?'selected':''}>${v}</option>`).join('')}</select></label><label>Difficulty<select name="difficulty">${Object.keys(POINTS).map(k=>`<option value="${k}" ${k===(c?.difficulty||'easy')?'selected':''}>${k}</option>`).join('')}</select></label><label>Points<input name="points" type="number" min="0" max="1000" step="1" value="${c?c.points:''}" placeholder="${POINTS[c?.difficulty||'easy']}"></label></div>
   <label>Description<textarea name="description" rows="8" required maxlength="20000" placeholder="What to do. Put code inside \`\`\` fences.">${E(c?.description||'')}</textarea></label>
   <label>Connection (optional)<input name="connection" maxlength="300" placeholder="nc localhost 1337" value="${E(c?.connection||'')}"></label>
   <div class="ctf-row"><label>Flag${c?.has_flag?' (stored; leave blank to keep it)':' (optional)'}<input name="flag" maxlength="300" autocomplete="off" spellcheck="false" placeholder="${c?.has_flag?'••••••••':'FLAG{...}'}"></label><label>Flag format (optional)<input name="flag_format" maxlength="120" placeholder="FLAG{...}" value="${E(c?.flag_format||'')}"></label></div>
   ${c?.has_flag?'<label class="ctf-check"><input type="checkbox" name="remove_flag"> Remove the stored flag (you will mark it solved yourself)</label>':''}
   <small class="muted">The flag is saved as a hash: the portal can check it but never shows it again. Without a flag you mark the challenge solved yourself.</small>
   <label>Hints (optional, one per line, revealed in order)<textarea name="hints" rows="3" placeholder="Hints are revealed in order, only when asked for." data-hints></textarea></label>
   <label>Solution (optional, hidden until solved or revealed)<textarea name="solution" rows="5" maxlength="20000">${E(c?.solution||'')}</textarea></label>
   <label>Source (optional)<input name="source" maxlength="500" placeholder="Course wargame week 3, link or CTF name" value="${E(c?.source||'')}"></label>
   <p class="ctf-feedback" role="alert"></p><footer><button type="button" class="btn secondary" data-ctf="close">Cancel</button><button class="btn primary" type="submit">${c?'Save changes':'Add challenge'}</button></footer></form>`;
  const form=dialog.querySelector('form');
  // Hints already revealed are shown; unrevealed hints stay on the server, so editing keeps them unless replaced.
  if(c&&c.hints_total>c.hints.length){form.elements.hints.placeholder=`${c.hints_total} hints are stored (${c.hints.length} revealed). Type new hints here to replace them, or leave blank to keep them.`}else form.elements.hints.value=(c?.hints||[]).join('\n');
  if(c&&c.solution==null&&c.has_solution){const s=form.elements.solution;s.placeholder='A solution is stored but hidden until you solve or reveal it. Type here to replace it, or leave blank to keep it.'}
  form.elements.difficulty.onchange=()=>form.elements.points.placeholder=POINTS[form.elements.difficulty.value];
  dialog.querySelectorAll('[data-ctf=close]').forEach(b=>b.onclick=()=>c?show(c.id):dialog.close());
  form.onsubmit=async ev=>{ev.preventDefault();const v=Object.fromEntries(new FormData(form)),button=form.querySelector('[type=submit]');button.disabled=true;
   try{
    // Blank fields for hidden hints or a hidden solution mean "keep what is stored".
    const keepHints=c&&c.hints_total>c.hints.length&&!v.hints.trim(),keepSolution=c&&c.solution==null&&c.has_solution&&!v.solution.trim();
    const r=await api({action:'save',id:c?.id,data:{...v,hints:keepHints?undefined:v.hints.split('\n').map(h=>h.trim()).filter(Boolean),solution:keepSolution?undefined:v.solution,remove_flag:!!v.remove_flag,updated_at:c?.updated_at}});
    await load();show(r.id);
   }catch(err){form.querySelector('.ctf-feedback').textContent=err.message}finally{button.disabled=false}};
  if(!dialog.open)dialog.showModal();form.elements.title.focus();
 }

 /* Practise with AI, like the quiz import: choose, copy the prompt, paste the answer, start practising. */
 function importDialog(topic){
  const sid=mounted?.sid,topics=o.topics(sid);if(!topics.length)return alert('Add a topic to this subject first.');
  const subject=o.subject(sid)?.name||'my';
  dialog.innerHTML=`<form class="ctf-dialog-inner ctf-form ctf-generate"><header><div><span class="ctf-eyebrow">✨ Practise with AI</span><h2>Generate CTF challenges</h2><small>Like the quiz import: copy the prompt into an AI tool, then paste its answer here.</small></div><button type="button" class="ctf-x" data-ctf="close" aria-label="Close">×</button></header>
   <section class="ctf-step"><h3><span>1</span>Choose what to practise</h3><div class="ctf-row"><label>Topic<select name="topic_name">${topics.map(t=>`<option value="${E(t)}" ${t===(topic||topics[0])?'selected':''}>${E(t)}</option>`).join('')}</select></label><label>Challenges<select name="count">${[3,5,8,10].map(n=>`<option ${n===5?'selected':''}>${n}</option>`).join('')}</select></label><label>Difficulty<select name="level"><option value="mixed">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div><label>Focus (optional)<input name="focus" maxlength="200" placeholder="For example: format strings, ROP chains, heap tcache"></label></section>
   <section class="ctf-step"><h3><span>2</span>Copy this prompt into ChatGPT, DeepSeek, Gemini or another AI tool</h3><pre class="ctf-prompt" data-prompt tabindex="0" aria-label="AI prompt"></pre><div class="ctf-buttons"><button type="button" class="btn primary small" data-ctf="prompt" data-label="Copy prompt">Copy prompt</button></div></section>
   <section class="ctf-step"><h3><span>3</span>Paste the AI's answer</h3><textarea name="text" rows="9" spellcheck="false" placeholder="Paste everything the AI wrote. It starts with “Challenge:”."></textarea><div class="ctf-preview" aria-live="polite"></div>
   <details class="ctf-format"><summary>Writing challenges yourself? See the format</summary><pre>Challenge: Return address offset
Category: pwn
Difficulty: easy
Points: 100
Flag: FLAG{72}
Flag format: FLAG{...}
Connect: nc localhost 1337   (optional)
Hint: Count the buffer first.
Description:
How many bytes reach the saved return address?
\`\`\`c
void vuln(){ char buf[64]; gets(buf); }
\`\`\`
Solution:
64 bytes of buffer + 8 bytes of saved RBP = 72.</pre><p>Start every challenge with “Challenge:”. Only the title and description are required. Without a flag you mark the challenge solved yourself.</p></details></section>
   <p class="muted ctf-check-note">AI tools make mistakes: if a flag does not follow from its challenge, edit the challenge or read its solution.</p>
   <footer><button type="button" class="btn secondary" data-ctf="close">Cancel</button><button type="button" class="btn secondary" data-ctf="preview">Check paste</button><button class="btn primary" type="submit">Start practising →</button></footer></form>`;
  const form=dialog.querySelector('form'),preview=dialog.querySelector('.ctf-preview'),box=dialog.querySelector('[data-prompt]');
  const current=()=>prompt({subject,topic:form.elements.topic_name.value,count:form.elements.count.value,level:form.elements.level.value,focus:form.elements.focus.value.trim()});
  const refresh=()=>box.textContent=current();refresh();
  for(const name of ['topic_name','count','level'])form.elements[name].onchange=refresh;form.elements.focus.oninput=refresh;
  dialog.querySelectorAll('[data-ctf=close]').forEach(b=>b.onclick=()=>dialog.close());
  dialog.querySelector('[data-ctf=prompt]').onclick=ev=>copy(current(),ev.currentTarget);
  const show=r=>{preview.innerHTML=r.errors.length?`<div class="ctf-errors"><b>${r.errors.length} thing${r.errors.length===1?'':'s'} to fix</b><ul>${r.errors.map(e=>`<li>${e.challenge?`Challenge ${e.challenge}`:'Start'}${e.line?`, line ${e.line}`:''}: ${E(e.problem)} <small>${E(e.fix)}</small></li>`).join('')}</ul></div>`:`<div class="ctf-ok"><b>${r.challenges.length} challenge${r.challenges.length===1?'':'s'} ready</b><ul>${r.challenges.map(c=>`<li><span class="ctf-cat cat-${c.category}">${E(CATEGORIES[c.category])}</span> ${E(c.title)} <small>${E(c.difficulty)} · ${c.points} pts · ${c.has_flag?'flag checked':'no flag'} · ${c.hints} hint${c.hints===1?'':'s'}${c.has_solution?' · solution':''}</small></li>`).join('')}</ul></div>`};
  const run=async action=>api({action,data:{topic_name:form.elements.topic_name.value,text:form.elements.text.value}});
  const check=async()=>{if(!form.elements.text.value.trim()){preview.innerHTML='';return}try{show(await run('preview'))}catch(err){preview.innerHTML=`<p class="ctf-feedback">${E(err.message)}</p>`}};
  let timer;form.elements.text.oninput=()=>{clearTimeout(timer);timer=setTimeout(check,500)};
  dialog.querySelector('[data-ctf=preview]').onclick=check;
  form.onsubmit=async ev=>{ev.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
   try{const r=await run('import');if(!r.ok)return show(r);filters.topic=form.elements.topic_name.value;await load();show_(r.ids[0])}
   catch(err){preview.innerHTML=`<p class="ctf-feedback">${E(err.message)}</p>`}finally{button.disabled=false}};
  if(!dialog.open)dialog.showModal();form.elements.topic_name.focus();
 }

 async function setEnabled(sid,on){await api({action:'subject',data:{subject_id:sid,enabled:!!on}});await load()}
 return {load,enabled,counts,modeCard,bindMode,mount,setEnabled,open:show};
}
g.StudentCtf={create,rich};
})(window);
