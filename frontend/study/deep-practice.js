/* Deep Practice: open-response practice from imported Markdown workbooks, alongside multiple choice.
   The server parses and stores workbooks and attempts (backend/study/deep_practice.py). Worked solutions
   reach the browser only after a reveal (practice) or after an assessment is submitted, and nothing a
   student writes is ever run. Imported Markdown is rendered with every character escaped. */
(function(g){'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPE_LABEL={mcq:'Multiple choice',recall:'Short answer',explain:'Explanation',fill_blank:'Fill in the blank',trace:'Code tracing / output',debug:'Debugging',implementation:'Implementation'};
const FORMAT_LABEL={selection:'Selection',text:'Text',code:'Code',mixed:'Text + code'};
const LANG_LABEL={mips:'MIPS',c:'C',python:'Python',java:'Java',javascript:'JavaScript',shell:'Shell',text:'Plain text'};
const STATE={not_started:['○','Not started'],draft:['✎','Draft saved'],submitted:['●','Submitted'],skipped:['↷','Skipped'],revealed:['◐','Solution revealed'],needs_review:['⚑','Needs review'],independent:['★','Independent (self-assessed)'],correct:['✓','Correct (auto-marked)']};
const OUTCOME={independent:'Solved independently',partial:'Partly correct / needed help',needs_practice:'Needs more practice'};
const CONFIDENCE={unsure:'Unsure',partly:'Partly confident',confident:'Confident'};
const when=d=>d?new Date(d).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'';
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;

// ---- Safe Markdown: everything is escaped first; only a small, known set of formatting is added back.
function inline(text){
 const codes=[];let s=String(text).replace(/\u0000/g,'').replace(/`([^`\n]+)`/g,(_,c)=>'\u0000'+(codes.push('<code>'+E(c)+'</code>')-1)+'\u0000');
 s=E(s).replace(/\*\*(\S(?:[^*]*\S)?)\*\*/g,'<strong>$1</strong>')
  .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,(_,t,u)=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
 return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>codes[+i]||'');
}
function codeBlock(code,lang,opts){
 let body;
 if(opts.blanks&&/_{3,}/.test(code)){
  body=code.split(/_{3,}/).map(E).reduce((html,part,k)=>{if(k===0)return part;const n=opts.blankIndex++,value=opts.blanks[n]??'';return html+`<input class="dp-blank" data-blank="${n}" aria-label="Blank ${n+1}" value="${E(value)}" size="${Math.max(5,String(value).length+1)}" spellcheck="false" autocomplete="off" ${opts.readonly?'readonly':''}>`+part},'');
 }else body=E(code);
 const label=LANG_LABEL[lang]||(lang?E(lang):'');
 return `<div class="dp-code">${label&&label!=='Plain text'?`<span class="dp-code-lang">${label}</span>`:''}<pre tabindex="0"><code>${body}</code></pre></div>`;
}
function markdown(source,opts={}){
 opts={blankIndex:0,...opts};
 const lines=String(source||'').replace(/\r\n?/g,'\n').split('\n'),out=[];let i=0;
 const startsBlock=l=>/^\s*(```|~~~)/.test(l)||/^#{1,6}\s/.test(l)||/^\s*([-*+]|\d+[.)])\s+/.test(l)||/^>/.test(l)||/^\s*\|.*\|\s*$/.test(l);
 const cells=row=>row.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(c=>c.replace(/\\\|/g,'|').trim());
 while(i<lines.length){
  const l=lines[i];
  if(!l.trim()){i++;continue}
  const fence=l.match(/^\s*(```|~~~)\s*([\w+#.-]*)\s*$/);
  if(fence){const code=[];i++;while(i<lines.length&&!lines[i].trim().startsWith(fence[1]))code.push(lines[i++]);i++;out.push(codeBlock(code.join('\n'),fence[2],opts));continue}
  const h=l.match(/^(#{1,6})\s+(.*)$/);
  if(h){const level=Math.min(6,h[1].length+2);out.push(`<h${level}>${inline(h[2])}</h${level}>`);i++;continue}
  if(/^\s*\|.*\|\s*$/.test(l)&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]||'')){
   const head=cells(l),rows=[];i+=2;while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i]))rows.push(cells(lines[i++]));
   out.push(`<div class="dp-table" tabindex="0"><table><thead><tr>${head.map(c=>`<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue}
  if(/^\s*([-*+]|\d+[.)])\s+/.test(l)){
   const ordered=/^\s*\d+[.)]/.test(l),items=[];
   while(i<lines.length&&(ordered?/^\s*\d+[.)]\s+/:/^\s*[-*+]\s+/).test(lines[i])){const item=lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/,''),task=item.match(/^\[([ xX])\]\s*(.*)$/);items.push(`<li>${task?`<span class="dp-task" aria-hidden="true">${task[1].trim()?'☑':'☐'}</span> ${inline(task[2])}`:inline(item)}</li>`)}
   out.push(`<${ordered?'ol':'ul'}>${items.join('')}</${ordered?'ol':'ul'}>`);continue}
  if(/^>/.test(l)){const quote=[];while(i<lines.length&&/^>/.test(lines[i]))quote.push(inline(lines[i++].replace(/^>\s?/,'')));out.push(`<blockquote>${quote.join('<br>')}</blockquote>`);continue}
  const para=[inline(l)];i++;while(i<lines.length&&lines[i].trim()&&!startsBlock(lines[i]))para.push(inline(lines[i++]));out.push(`<p>${para.join('<br>')}</p>`);
 }
 return out.join('');
}

function create(o){
 const view=document.createElement('section');view.className='view dp-view';view.id='view-deep-practice';document.querySelector('.main').append(view);
 const dialog=document.createElement('dialog');dialog.className='dp-dialog';document.body.append(dialog);
 let lib=null,page='library',open=null,att=null,idx=0,preview=null,pv=freshImport(),navOpen=false,collapsed=false,notice='',busy=false;
 const pending=new Map(),failed=new Set();let saveTimer=null,retryTimer=null,saveState='';
 try{collapsed=localStorage.getItem('dp.navCollapsed')==='1'}catch{}
 function freshImport(){return {source:'',name:'',subject:'',topic:'',title:'',description:'',overrides:{},only:false}}
 async function api(payload){
  const r=await fetch('/api/deep-practice',payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});
  let j;try{j=await r.json()}catch{throw Error('The server sent an unexpected reply. Restart the portal server and try again.')}
  if(!r.ok||j.error)throw Error(j.error||'Deep Practice request failed.');return j;
 }
 const btn=(label,action,cls='',extra='')=>`<button type="button" class="dp-btn ${cls}" data-dp="${action}" ${extra}>${label}</button>`;
 const subjects=()=>o.subjects?.()||[];
 const subjectName=id=>subjects().find(s=>s.id===id)?.name||'';
 const question=id=>open?.quiz.questions.find(q=>q.id===id);
 const ids=()=>att?.attempt.question_ids||[];
 const assessmentOpen=()=>att&&att.attempt.mode==='assessment'&&att.attempt.status!=='submitted';
 const resp=id=>att?.responses[id]||null;
 const working=r=>r?.revision?.response||r?.original?.response||r?.draft||{};
 function announce(text){notice=text;view.querySelectorAll('[data-dp-notice]').forEach(n=>n.textContent=text)}

 // ------------------------------------------------------------------ shared dialog (no native alerts)
 function ask(title,body,actions){return new Promise(resolve=>{
  dialog.innerHTML=`<form method="dialog"><h2>${E(title)}</h2><div class="dp-dialog-body">${body}</div><footer>${actions.map(([value,label,cls])=>`<button value="${value}" class="dp-btn ${cls||''}">${label}</button>`).join('')}</footer></form>`;
  dialog.onclose=()=>resolve(dialog.returnValue||'cancel');dialog.returnValue='';dialog.showModal();dialog.querySelector('footer button:last-child')?.focus();
  dialog.querySelectorAll('[data-dp-jump]').forEach(b=>b.onclick=ev=>{ev.preventDefault();dialog.close('jump:'+b.dataset.dpJump)});
 })}

 // ------------------------------------------------------------------ library
 async function loadLibrary(){lib=await api()}
 function hero(title,text,action=''){return `<header class="dp-hero"><div><span class="dp-eyebrow">Deep Practice</span><h1>${E(title)}</h1><p>${text}</p></div>${action}</header>`}
 function libraryPage(){
  const list=lib?.quizzes||[];
  const cards=list.map(q=>{const s=q.summary;return `<article class="dp-card"><h2><button type="button" class="dp-card-open" data-dp="open" data-id="${q.id}">${E(q.title)}</button></h2><p>${E(q.description)}</p><div class="dp-chips"><span>${plural(q.questions,'question')}</span><span>${plural(q.topics.length,'topic')}</span>${q.subject_id&&subjectName(q.subject_id)?`<span>${E(subjectName(q.subject_id))}</span>`:''}${q.status!=='complete'?'<span class="dp-chip-warn">Incomplete import</span>':''}</div><p class="dp-card-progress">${s.submitted} of ${s.questions} submitted${s.mcq_answered?` · multiple choice ${s.mcq_correct}/${s.mcq_answered} correct`:''}${s.awaiting_review?` · ${s.awaiting_review} awaiting self-review`:''}</p><div class="dp-actions">${btn(q.active_practice?'Resume practice':'Start practice',q.active_practice?'resume-card':'start-card','dp-primary',`data-id="${q.id}"`)}${btn('Overview','open','',`data-id="${q.id}"`)}</div></article>`}).join('');
  return `${hero('Deep Practice','Recall, explain, trace, debug and write code — attempt each question first, then compare with a worked solution. Multiple-choice quizzes stay where they are.',btn('＋ Import a workbook','import','dp-primary'))}<p class="dp-notice" data-dp-notice role="status">${E(notice)}</p>${list.length?`<div class="dp-grid">${cards}</div>`:`<div class="dp-empty"><h2>No Deep Practice quizzes yet</h2><p>Import a Markdown workbook with question IDs (such as P1-001) and a matching answer section. You will see a full preview before anything is saved.</p>${btn('＋ Import a workbook','import','dp-primary')}</div>`}`;
 }

 // ------------------------------------------------------------------ import with preview
 function importPage(){
  const subjectOptions=`<option value="">No subject</option>${subjects().map(s=>`<option value="${E(s.id)}" ${s.id===pv.subject?'selected':''}>${E(s.name)}</option>`).join('')}`;
  const topics=subjects().find(s=>s.id===pv.subject)?.topics||[];
  return `<nav class="dp-crumbs">${btn('← Deep Practice','library','dp-link')}</nav>${hero('Import a Deep Practice workbook','Upload or paste Markdown. Questions and answers are matched by ID, never by position, and nothing is saved until you choose <b>Save</b>.')}
  <section class="dp-panel"><div class="dp-import-grid"><div><label class="dp-label" for="dpFile">Upload a Markdown file</label><input id="dpFile" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain"><p class="dp-hint">${pv.name?`Loaded <b>${E(pv.name)}</b> (${pv.source.length.toLocaleString()} characters).`:'A .md file such as COMP1521_Part_1_Workbook.md.'}</p>
   <label class="dp-label" for="dpSource">Or paste the Markdown</label><textarea id="dpSource" class="dp-source" spellcheck="false" placeholder="P1-001 · Foundation · Recall&#10;Question: …">${E(pv.source)}</textarea></div>
   <div class="dp-import-side"><label class="dp-label" for="dpSubject">Subject (optional)</label><select id="dpSubject">${subjectOptions}</select><label class="dp-label" for="dpTopic">Topic (optional)</label><select id="dpTopic"><option value="">No topic</option>${topics.map(t=>`<option ${t===pv.topic?'selected':''}>${E(t)}</option>`).join('')}</select>
   <details class="dp-format"><summary>What format does the importer understand?</summary><ul><li>Each question starts with an ID line, e.g. <code>P1-001 · Foundation · Recall</code> (ID · difficulty · learning stage).</li><li><code>Question:</code> text, optional <code>Answer choices:</code> with <code>A.</code>–<code>H.</code></li><li>A separate answers section where each block starts with the same ID, then <code>Answer:</code>, <code>Explain:</code>, <code>Key rule:</code>, <code>Common mistakes:</code>, <code>Why other options are wrong:</code>, <code>Check your solution:</code>.</li><li>Topic headings, fenced or unfenced code, tables and an independence checklist (<code>- [ ]</code>) are kept.</li></ul></details>
   ${btn('Preview import','preview','dp-primary dp-wide')}</div></div><p class="dp-notice" data-dp-notice role="status">${E(notice)}</p></section>${preview?previewPanel():''}`;
 }
 function chips(obj){return Object.entries(obj||{}).map(([k,n])=>`<span>${E(TYPE_LABEL[k]||k)} <b>${n}</b></span>`).join('')}
 function typeRow(q,overrides){
  const o=overrides[q.id]||{},type=o.type||q.type,format=o.format||q.format,lang=o.language||q.language,changed=Object.keys(o).length>0;
  const sel=(field,options,value,label)=>`<select data-override="${q.id}" data-field="${field}" aria-label="${label} for ${q.id}">${Object.entries(options).filter(([k])=>field!=='type'||k!=='mcq'||q.choices.length).map(([k,l])=>`<option value="${k}" ${k===value?'selected':''}>${l}</option>`).join('')}</select>`;
  return `<tr class="${q.inferred.confidence==='low'?'dp-low':''}"><th scope="row">${E(q.id)}</th><td>${E(q.topic)}</td><td>${E(q.difficulty)}<br><small>${E(q.stage)}</small></td><td>${sel('type',TYPE_LABEL,type,'Question type')}</td><td>${sel('format',FORMAT_LABEL,format,'Response format')}</td><td>${sel('language',LANG_LABEL,lang,'Code language')}</td><td><small>${changed?'<b>Changed by you.</b> ':''}${E(q.inferred.reason)}</small>${q.inferred.confidence==='low'?' <span class="dp-chip-warn">Check</span>':''}</td><td>${q.has_solution?'<span class="dp-ok">✓ Matched</span>':'<span class="dp-bad">✗ No answer</span>'}</td></tr>`;
 }
 function typeTable(questions,overrides,filterLow){
  const rows=questions.filter(q=>!filterLow||q.inferred.confidence==='low'||!q.has_solution||overrides[q.id]);
  return `<div class="dp-table dp-type-table" tabindex="0"><table><caption>Question types are inferred from the workbook. Correct any that look wrong; your choices are saved with the quiz.</caption><thead><tr><th scope="col">ID</th><th scope="col">Topic</th><th scope="col">Difficulty · stage</th><th scope="col">Type</th><th scope="col">Response</th><th scope="col">Language</th><th scope="col">Why</th><th scope="col">Answer</th></tr></thead><tbody>${rows.map(q=>typeRow(q,overrides)).join('')||'<tr><td colspan="8">Nothing to check.</td></tr>'}</tbody></table></div>`;
 }
 function previewPanel(){
  const {quiz,report}=preview,c=report.counts,levels={error:[],warning:[],info:[]};
  report.issues.forEach(i=>levels[i.level].push(i));
  const banner=report.status==='complete'?`<div class="dp-banner ok">✓ Ready to save — all ${c.questions} questions were matched to their answers by ID.</div>`:report.status==='incomplete'?`<div class="dp-banner warn">⚠ Incomplete import — ${c.matched} of ${c.questions} questions have answers${levels.warning.length?` and ${plural(levels.warning.length,'warning')} need a look`:''}. You can save, but it will be labelled incomplete.</div>`:`<div class="dp-banner bad">✕ This workbook cannot be saved yet. Fix the ${plural(levels.error.length,'error')} below in the Markdown and preview again.</div>`;
  const issueList=(level,title)=>levels[level].length?`<section class="dp-issues ${level}"><h3>${title} (${levels[level].length})</h3><ul>${levels[level].map(i=>`<li>${i.line?`<b>Line ${i.line}</b>${i.id?' · '+E(i.id):''} — `:i.id?`<b>${E(i.id)}</b> — `:''}${E(i.id&&i.message.startsWith(i.id+':')?i.message.slice(i.id.length+1).trim():i.message)}</li>`).join('')}</ul></section>`:'';
  return `<section class="dp-panel dp-preview" aria-labelledby="dpPreviewTitle"><h2 id="dpPreviewTitle" tabindex="-1">Preview</h2>${banner}
   <div class="dp-import-grid"><div><label class="dp-label" for="dpTitle">Quiz title</label><input id="dpTitle" value="${E(pv.title||quiz.title)}" maxlength="200"><label class="dp-label" for="dpDescription">Short description</label><textarea id="dpDescription" rows="2" maxlength="1000">${E(pv.description||quiz.description)}</textarea></div>
   <dl class="dp-stats"><div><dt>Questions</dt><dd>${c.questions}</dd></div><div><dt>Matched to answers</dt><dd>${c.matched} / ${c.questions}</dd></div><div><dt>Multiple choice</dt><dd>${c.mcq} <small>(${c.graded_mcq} auto-marked)</small></dd></div><div><dt>Topics</dt><dd>${c.topics}</dd></div><div><dt>Code blocks kept</dt><dd>${c.code_blocks}</dd></div><div><dt>Checklist items</dt><dd>${c.checklist_items}</dd></div></dl></div>
   <div class="dp-breakdown"><div><h3>Topics</h3><div class="dp-chips">${quiz.topics.map(t=>`<span>${E(t.name)} <b>${t.count}</b></span>`).join('')}</div></div><div><h3>Question types</h3><div class="dp-chips">${chips(c.types)}</div></div><div><h3>Difficulty</h3><div class="dp-chips">${chips(c.difficulties)}</div></div><div><h3>Learning stages</h3><div class="dp-chips">${chips(c.stages)}</div></div></div>
   ${issueList('error','Errors — must be fixed')}${issueList('warning','Warnings')}${issueList('info','Notes')}${!report.issues.length?'<p class="dp-hint">No problems were found. Every line of the file was placed in a section, question or answer.</p>':''}
   <div class="dp-row"><h3>Question types and response formats</h3><label class="dp-check"><input type="checkbox" id="dpOnlyCheck" ${pv.only?'checked':''}> Only show questions to check</label></div>${typeTable(quiz.questions,pv.overrides,pv.only)}
   <div class="dp-actions dp-sticky-actions">${btn(report.status==='blocked'?'Cannot save — fix errors first':report.status==='incomplete'?'Save incomplete quiz':'Save Deep Practice quiz','save-import','dp-primary',report.status==='blocked'?'disabled':'')}${btn('Cancel','cancel-import')}</div></section>`;
 }
 async function readFile(file){
  if(!file)return;if(file.size>2_000_000)throw Error('Choose a Markdown file up to 2 MB.');
  pv.source=await file.text();pv.name=file.name;preview=null;render();
 }
 async function runPreview(){
  pv.source=view.querySelector('#dpSource')?.value??pv.source;
  if(!pv.source.trim())throw Error('Upload or paste a workbook first.');
  announce('Reading the workbook…');
  const r=await api({action:'preview',source:pv.source});preview=r;pv.title='';pv.description='';
  for(const id of Object.keys(pv.overrides))if(!r.quiz.questions.some(q=>q.id===id))delete pv.overrides[id];
  announce('');render();view.querySelector('#dpPreviewTitle')?.focus();
 }
 async function saveImport(){
  const r=await api({action:'import',source:pv.source,source_name:pv.name||'workbook.md',title:view.querySelector('#dpTitle').value,description:view.querySelector('#dpDescription').value,subject_id:pv.subject||null,topic_name:pv.topic||null,overrides:pv.overrides});
  pv=freshImport();preview=null;await openQuiz(r.id);announce(r.status==='complete'?'Saved. Every question was matched to its answer.':'Saved as an incomplete import. Questions without answers have no worked solution.');
 }

 // ------------------------------------------------------------------ overview
 async function openQuiz(id){open=await api({action:'open',quiz_id:id});att=null;page='overview';render();view.querySelector('h1')?.focus?.()}
 function bar(states,ids){const counts={};ids.forEach(id=>{const s=states[id]||'not_started';counts[s]=(counts[s]||0)+1});return `<div class="dp-bar" aria-hidden="true">${Object.entries(STATE).map(([k])=>counts[k]?`<span class="s-${k}" style="flex:${counts[k]}"></span>`:'').join('')}</div><p class="dp-bar-text">${Object.entries(STATE).filter(([k])=>counts[k]).map(([k,[icon,label]])=>`<span>${icon} ${counts[k]} ${label.toLowerCase()}</span>`).join(' · ')}</p>`}
 function overviewPage(){
  const q=open.quiz,s=open.summary,active=open.attempts.find(a=>a.status==='active'&&a.mode==='practice'),assessment=open.attempts.find(a=>a.status==='active'&&a.mode==='assessment');
  const topicIds=t=>q.questions.filter(x=>x.topic===t).map(x=>x.id),sections=q.sections.filter(x=>x.markdown.trim());
  const opts=(label,name,values)=>`<label class="dp-label">${label}<select name="${name}"><option value="">Any</option>${values.map(v=>`<option value="${E(v[0])}">${E(v[1])}</option>`).join('')}</select></label>`;
  const uniq=a=>[...new Set(a)];
  return `<nav class="dp-crumbs">${btn('← Deep Practice','library','dp-link')}</nav>
  <header class="dp-hero dp-overview-head"><div><span class="dp-eyebrow">Deep Practice${open.subject_id&&subjectName(open.subject_id)?' · '+E(subjectName(open.subject_id)):''}</span><h1 tabindex="-1">${E(q.title)}</h1><p>${E(q.description)}</p><div class="dp-chips"><span>${plural(q.questions.length,'question')}</span><span>${plural(q.topics.length,'topic')}</span><span>${q.questions.filter(x=>x.type==='mcq').length} multiple choice</span><span>Imported ${E(when(open.created_at))}</span>${open.report.status!=='complete'?'<span class="dp-chip-warn">Incomplete import</span>':''}</div></div>
   <div class="dp-actions dp-main-actions">${btn(active?'Resume practice':'Start practice',active?'resume':'practice-all','dp-primary',active?`data-id="${active.id}"`:'')}${active?btn('Start fresh','practice-all'):''}${btn(assessment?'Resume assessment':'Start assessment',assessment?'resume':'assessment','',assessment?`data-id="${assessment.id}"`:'')}${btn(`Review questions needing work (${s.review_ids.length})`,'practice-review','',s.review_ids.length?'':'disabled')}</div></header>
  <p class="dp-notice" data-dp-notice role="status">${E(notice)}</p>
  <div class="dp-overview-grid"><div class="dp-col-main">
   <section class="dp-panel" aria-labelledby="dpProgressTitle"><h2 id="dpProgressTitle">Your progress</h2><dl class="dp-stats">
    <div><dt>Answers submitted</dt><dd>${s.submitted} / ${s.questions}</dd></div>
    <div><dt>Multiple choice (auto-marked)</dt><dd>${s.mcq_answered?`${s.mcq_correct} / ${s.mcq_answered} correct`:'None yet'}</dd></div>
    <div><dt>Awaiting your self-review</dt><dd>${s.awaiting_review}</dd></div>
    <div><dt>Self-assessed</dt><dd><small>${s.outcomes.independent} independent · ${s.outcomes.partial} partly · ${s.outcomes.needs_practice} need practice</small></dd></div>
    <div><dt>Revealed without an attempt</dt><dd>${s.revealed_without_attempt}</dd></div>
    <div><dt>Skipped</dt><dd>${s.skipped}</dd></div></dl>
    <p class="dp-hint">These are kept separate on purpose: only multiple-choice answers with an answer key are marked by the app. Everything else is your own assessment, and finishing every question is not a guarantee of mastery.</p>
    ${s.topics_needing_work.length?`<h3>Topics needing more work</h3><div class="dp-chips">${s.topics_needing_work.map(t=>`<button type="button" class="dp-chip-btn" data-dp="practice-topic" data-topic="${E(t.topic)}">${E(t.topic)} · ${t.questions}</button>`).join('')}</div>`:''}</section>
   <section class="dp-panel" aria-labelledby="dpPathTitle"><h2 id="dpPathTitle">Learning path</h2><ol class="dp-path">${q.topics.map(t=>`<li><div><h3>${E(t.name)}</h3><small>${plural(t.count,'question')} · ${E(uniq(q.questions.filter(x=>x.topic===t.name).flatMap(x=>x.stages)).join(', '))}</small>${bar(s.states,topicIds(t.name))}</div>${btn('Practise topic','practice-topic','',`data-topic="${E(t.name)}"`)}</li>`).join('')}</ol>
    <details class="dp-filter"><summary>Practise by filter</summary><form id="dpFilter" class="dp-filter-form">${opts('Topic','topic',q.topics.map(t=>[t.name,t.name]))}${opts('Difficulty','difficulty',uniq(q.questions.map(x=>x.difficulty)).map(v=>[v,v]))}${opts('Learning stage','stage',uniq(q.questions.flatMap(x=>x.stages)).map(v=>[v,v]))}${opts('Question type','type',uniq(q.questions.map(x=>x.type)).map(v=>[v,TYPE_LABEL[v]]))}<button class="dp-btn" type="submit">Start filtered practice</button></form></details></section>
   ${open.attempts.length?`<section class="dp-panel"><h2>Attempt history</h2><ul class="dp-history">${open.attempts.map(a=>`<li><div><b>${a.mode==='assessment'?'Assessment':'Practice'}</b> · ${E(scopeLabel(a.scope))}<small>${E(when(a.created_at))} · ${a.answered} of ${a.questions} submitted · ${a.status==='active'?'In progress':a.status==='submitted'?'Submitted':'Ended (kept as history)'}${a.content_version!==open.content_version?' · earlier version':''}</small></div>${btn(a.status==='active'?'Resume':'Review','resume','',`data-id="${a.id}"`)}</li>`).join('')}</ul></section>`:''}
  </div><aside class="dp-col-side">
   <section class="dp-panel" aria-labelledby="dpChecklistTitle"><h2 id="dpChecklistTitle">Independence checklist</h2><p class="dp-hint">Your own assessment of what you can do without help — the app does not check these.</p>${q.checklist.items.length?`<ul class="dp-checklist">${q.checklist.items.map((it,i)=>`<li><label><input type="checkbox" data-checklist="${i}" ${open.checklist[i]?'checked':''}> <span>${inline(it.text)}</span></label></li>`).join('')}</ul>`:'<p>This workbook has no checklist.</p>'}${q.checklist.notes?`<details><summary>Notes from the workbook</summary><div class="dp-md">${markdown(q.checklist.notes)}</div></details>`:''}</section>
   ${sections.length?`<section class="dp-panel"><h2>About this workbook</h2>${sections.map(x=>`<details><summary>${E(x.title)}</summary><div class="dp-md">${markdown(x.markdown)}</div></details>`).join('')}${q.questions_intro?`<details><summary>Before the questions</summary><div class="dp-md">${markdown(q.questions_intro)}</div></details>`:''}</section>`:''}
   <section class="dp-panel"><h2>Manage</h2><label class="dp-label" for="dpLinkSubject">Subject</label><select id="dpLinkSubject"><option value="">No subject</option>${subjects().map(x=>`<option value="${E(x.id)}" ${x.id===open.subject_id?'selected':''}>${E(x.name)}</option>`).join('')}</select>
    <div class="dp-actions dp-stack">${btn('Edit question types','edit-types')}${btn('Download original Markdown','download')}${btn('Reprocess original Markdown','reprocess')}<label class="dp-btn dp-file-btn">Replace with updated workbook<input type="file" id="dpReplace" accept=".md,.markdown,.txt"></label>${btn('Delete quiz','delete','dp-danger')}</div>
    <p class="dp-hint">Imported ${E(open.source_name)} · content version ${open.content_version}${open.report.issues.length?` · ${plural(open.report.issues.length,'import note')}`:''}.</p></section>
  </aside></div>`;
 }
 const scopeLabel=s=>s.kind==='topic'?'Topic: '+s.topic:s.kind==='review'?'Questions needing work':s.kind==='filter'?'Filtered: '+['topic','difficulty','stage','type'].filter(k=>s[k]).map(k=>k==='type'?TYPE_LABEL[s[k]]:s[k]).join(', '):'All questions';

 // ------------------------------------------------------------------ attempts
 async function startAttempt(mode,scope){att=await api({action:'start',quiz_id:open.id,mode,scope});idx=firstOpen();page='workspace';restoreBackups();render();focusQuestion()}
 async function resumeAttempt(id){att=await api({action:'attempt',attempt_id:id});idx=att.attempt.status==='submitted'?-1:firstOpen();page='workspace';restoreBackups();render();focusQuestion()}
 function firstOpen(){const list=ids(),k=list.findIndex(id=>!resp(id)?.original&&!resp(id)?.skipped&&!resp(id)?.revealed);return k<0?0:k}
 function stateOf(id){return resp(id)?.state||'not_started'}

 // Autosave: each change is saved after a short pause; failures keep a copy in this browser and retry.
 const backupKey=id=>`dp.backup.${att.attempt.id}.${id}`;
 function collect(){
  const box=view.querySelector('[data-answer]');if(!box)return null;
  const q=question(box.dataset.answer),value={};
  const text=box.querySelector('[data-field=text]'),code=box.querySelector('[data-field=code]'),lang=box.querySelector('[data-field=language]');
  value.text=text?text.value:(working(resp(q.id)).text||'');value.code=code?code.value:(working(resp(q.id)).code||'');value.language=lang?lang.value:q.language;
  const blanks=[...view.querySelectorAll('.dp-prompt .dp-blank')];value.blanks=blanks.length?blanks.map(b=>b.value):(working(resp(q.id)).blanks||[]);
  value.selected=q.choices.length?[...view.querySelectorAll('.dp-choices [data-choice]:checked')].map(c=>c.value):[];
  return {id:q.id,value};
 }
 function changed(){
  const c=collect();if(!c)return;
  pending.set(c.id,c.value);try{localStorage.setItem(backupKey(c.id),JSON.stringify({value:c.value,at:Date.now()}))}catch{}
  setSave('Saving…');clearTimeout(saveTimer);saveTimer=setTimeout(flush,700);
 }
 async function flush(){
  clearTimeout(saveTimer);if(!att)return true;
  for(const [id,value] of [...pending]){
   try{const r=await api({action:'response',attempt_id:att.attempt.id,question_id:id,op:'draft',response:value});
    if(pending.get(id)===value)pending.delete(id);att.responses[id]=r.response;failed.delete(id);try{localStorage.removeItem(backupKey(id))}catch{}
    updateNavItem(id);
   }catch(e){failed.add(id);setSave('Not saved — '+e.message.replace(/\.$/,'')+'. Retrying; keep this tab open.',true);clearTimeout(retryTimer);retryTimer=setTimeout(flush,4000);return false}
  }
  if(!pending.size)setSave('All changes saved');return true;
 }
 function setSave(text,bad=false){saveState=text;const el=view.querySelector('[data-dp-save]');if(el){el.textContent=text;el.classList.toggle('bad',bad)}}
 function restoreBackups(){
  let restored=0;
  for(const id of ids()){let b=null;try{b=JSON.parse(localStorage.getItem(backupKey(id))||'null')}catch{}
   const r=resp(id),saved=Date.parse(r?.revision?.saved_at||r?.draft_saved_at||0)||0;
   if(b&&b.at>saved&&att.attempt.status==='active'){pending.set(id,b.value);restored++}else try{localStorage.removeItem(backupKey(id))}catch{}}
  if(restored){announce(`Restored ${plural(restored,'unsaved answer')} from this browser; saving now.`);flush()}
 }
 async function op(payload){
  await flush();
  const r=await api({action:'response',attempt_id:att.attempt.id,...payload});
  att.responses[payload.question_id]=r.response;if(r.solution)att.solutions[payload.question_id]=r.solution;return r;
 }

 // ------------------------------------------------------------------ workspace
 function navigator(){
  const groups=[];ids().forEach((id,k)=>{const q=question(id);if(!q)return;let g=groups.find(x=>x.topic===q.topic);if(!g)groups.push(g={topic:q.topic,items:[]});g.items.push([id,k])});
  const answered=ids().filter(id=>resp(id)?.original||(assessmentOpen()&&stateOf(id)==='draft')).length;
  return `<div class="dp-nav-head"><b>${assessmentOpen()?'Assessment':att.attempt.mode==='assessment'?'Assessment review':'Practice'}</b><small>${answered} of ${ids().length} ${assessmentOpen()?'answered':'submitted'}</small></div>${groups.map(gr=>`<h3>${E(gr.topic)}</h3><ol>${gr.items.map(([id,k])=>navItem(id,k)).join('')}</ol>`).join('')}<button type="button" class="dp-nav-item dp-nav-summary ${idx===-1?'current':''}" data-dp="go" data-i="-1" ${idx===-1?'aria-current="step"':''}><span class="dp-state-icon" aria-hidden="true">≡</span><span class="dp-nav-id">Summary</span></button>`;
 }
 function navItem(id,k){const s=stateOf(id),[icon,label]=STATE[s],flag=resp(id)?.flagged;return `<li><button type="button" class="dp-nav-item s-${s} ${k===idx?'current':''}" data-dp="go" data-i="${k}" data-nav="${E(id)}" ${k===idx?'aria-current="step"':''}><span class="dp-state-icon" aria-hidden="true">${icon}</span><span class="dp-nav-id">${E(id)}</span><span class="dp-nav-label">${label}${resp(id)?.revealed_without_attempt?' (no attempt)':''}</span>${flag?'<span class="dp-flag" title="Flagged">⚑<span class="dp-sr"> flagged</span></span>':''}</button></li>`}
 function updateNavItem(id){const el=view.querySelector(`[data-nav="${CSS.escape(id)}"]`);if(el){const k=+el.dataset.i;el.closest('li').outerHTML=navItem(id,k);bindIn(view.querySelector(`[data-nav="${CSS.escape(id)}"]`).parentElement)}const head=view.querySelector('.dp-nav-head small');if(head){const answered=ids().filter(x=>resp(x)?.original||(assessmentOpen()&&stateOf(x)==='draft')).length;head.textContent=`${answered} of ${ids().length} ${assessmentOpen()?'answered':'submitted'}`}}
 function workspacePage(){
  const a=att.attempt,submitted=a.status==='submitted';
  return `<div class="dp-ws ${collapsed?'collapsed':''} ${navOpen?'nav-open':''}"><header class="dp-ws-bar">${btn('← Overview','back-overview','dp-link')}<div class="dp-ws-title"><b>${E(open.quiz.title)}</b><small>${a.mode==='assessment'?(submitted?'Assessment · submitted':'Assessment · solutions hidden until you submit'):'Practice'} · ${E(scopeLabel(a.scope))}</small></div><span class="dp-save" data-dp-save role="status" aria-live="polite">${E(saveState)}</span>${btn(`☰ Questions`,'toggle-nav','dp-nav-toggle',`aria-expanded="${navOpen||!collapsed}" aria-controls="dpNav"`)}${assessmentOpen()?btn('Finish assessment','finish','dp-primary'):''}</header>
   ${a.stale?'<p class="dp-banner warn">This attempt was started on an earlier version of the quiz. Answers are kept; some questions may have changed.</p>':''}${a.status==='closed'?'<p class="dp-banner warn">This attempt was replaced by a newer one and is kept as history. Start or resume the latest attempt to keep answering.</p>':''}
   <p class="dp-notice" data-dp-notice role="status">${E(notice)}</p>
   <div class="dp-ws-body"><aside id="dpNav" class="dp-nav" aria-label="Questions">${navigator()}</aside><button type="button" class="dp-scrim" data-dp="close-nav" aria-label="Close question list" tabindex="-1"></button><div class="dp-main">${idx===-1?summaryView():questionView()}</div></div></div>`;
 }
 function responseView(r,q){
  if(!r)return '<p class="dp-hint">No answer.</p>';
  const parts=[];
  if(q.choices.length)parts.push(r.selected?.length?`<p>Chose <b>${r.selected.map(E).join(', ')}</b></p>`:'');
  if(r.blanks?.some(b=>b.trim()))parts.push(`<p>Blanks: ${r.blanks.map((b,i)=>`<code>${i+1}: ${E(b)||'—'}</code>`).join(' ')}</p>`);
  if(r.text?.trim())parts.push(`<div class="dp-md">${markdown(r.text)}</div>`);
  if(r.code?.trim())parts.push(codeBlock(r.code,r.language,{}));
  return parts.join('')||'<p class="dp-hint">Empty answer.</p>';
 }
 function editor(value,lang,label){
  const count=Math.max(1,String(value||'').split('\n').length);
  return `<div class="dp-editor"><div class="dp-editor-bar"><span>${E(label)}</span><label>Language <select data-field="language">${Object.entries(LANG_LABEL).map(([k,l])=>`<option value="${k}" ${k===lang?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="dp-editor-body"><pre class="dp-gutter" aria-hidden="true">${Array.from({length:count},(_,i)=>i+1).join('\n')}</pre><textarea class="dp-code-input" data-field="code" data-editor spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="${E(label)}" aria-describedby="dpEditorHelp">${E(value||'')}</textarea></div><small id="dpEditorHelp" class="dp-hint">Tab indents and Shift+Tab outdents. Press Esc, then Tab, to move on. Code is never run.</small></div>`;
 }
 function textArea(value,label,mono=false){
  return `<div class="dp-text"><div class="dp-text-bar"><label for="dpText">${E(label)}</label>${mono?btn('Show whitespace','toggle-ws','dp-small','aria-pressed="false"'):btn('Preview','toggle-preview','dp-small','aria-pressed="false"')}</div><textarea id="dpText" class="${mono?'dp-mono':''}" data-field="text" rows="${mono?6:5}" spellcheck="${mono?'false':'true'}" ${mono?'wrap="off"':''}>${E(value||'')}</textarea><div class="dp-text-preview ${mono?'dp-ws-view':''}" hidden></div></div>`;
 }
 function controls(q,w,locked){
  if(q.format==='selection'&&q.choices.length)return '';
  const t=q.type,f=q.format;
  if(f==='code'&&t==='trace')return textArea(w.text,'Your predicted output / values (spaces and newlines are kept)',true);
  if(f==='code')return editor(w.code,w.language||q.language,t==='trace'?'Your output':'Your code');
  if(f==='mixed'){
   if(t==='debug')return textArea(w.text,'What is wrong, and why?')+editor(w.code,w.language||q.language,'Corrected code');
   if(t==='fill_blank')return (q.blanks_in_code?'<p class="dp-hint">Type into the blanks in the code above.</p>':'')+textArea(w.text,'Anything else the question asks for');
   return editor(w.code,w.language||q.language,'Your code')+textArea(w.text,'Reasoning, assumptions and tests');
  }
  return textArea(w.text,t==='explain'?'Your explanation (in your own words)':t==='trace'?'Your trace':t==='fill_blank'?'Your answers for the blanks':'Your answer');
 }
 function choicesView(q,w,r,locked,showMarks,sol){
  const key=sol?.answer_key||[],multi=q.multiple,selected=w.selected||[];
  return `<fieldset class="dp-choices" ${locked?'disabled':''}><legend class="dp-sr">Answer choices</legend>${q.multiple?'<p class="dp-hint">Choose every correct answer.</p>':''}${q.choices.map(c=>{const mine=selected.includes(c.label),right=showMarks&&key.includes(c.label);return `<label class="dp-choice ${mine?'chosen':''} ${showMarks&&right?'right':''} ${showMarks&&mine&&!right?'wrong':''}"><input type="${multi?'checkbox':'radio'}" name="dpChoice" data-choice value="${E(c.label)}" ${mine?'checked':''}><span class="dp-choice-letter" aria-hidden="true">${E(c.label)}</span><span class="dp-choice-body"><span class="dp-sr">${E(c.label)}. </span><span class="dp-md">${markdown(c.markdown)}</span>${showMarks&&(mine||right)?`<span class="dp-mark ${right?'':'bad'}">${[mine?'Your choice':'',right?'Correct answer':''].filter(Boolean).join(' · ')}</span>`:''}</span></label>`}).join('')}</fieldset>`;
 }
 function questionView(){
  const id=ids()[idx],q=question(id);if(!q)return '<p>This question is no longer in the quiz.</p>';
  const r=resp(id)||{},a=att.attempt,sol=att.solutions[id],submitted=!!r.original,assessment=a.mode==='assessment',done=a.status!=='active';
  const w=pending.has(id)?pending.get(id):working(r),locked=done&&!(a.mode==='practice'&&a.status==='active');
  const showMarks=!!sol&&(!assessment||a.status==='submitted')&&q.type==='mcq';
  const promptHtml=markdown(q.prompt,{blanks:q.type==='fill_blank'&&q.blanks_in_code?(w.blanks||[]):null,readonly:locked});
  const conf=!assessment&&!submitted&&!done?`<fieldset class="dp-confidence"><legend>How confident are you? <small>(optional)</small></legend>${Object.entries(CONFIDENCE).map(([k,l])=>`<label><input type="radio" name="dpConfidence" value="${k}" ${r.confidence===k?'checked':''}> ${l}</label>`).join('')}</fieldset>`:r.confidence?`<p class="dp-hint">Confidence recorded: ${CONFIDENCE[r.confidence]}.</p>`:'';
  let actions='';
  if(a.mode==='practice'&&a.status==='active'){
   actions=submitted?(sol?'':btn('Reveal worked solution','reveal','dp-primary')):btn('Submit answer','submit','dp-primary')+btn('Skip for now','skip')+btn('Reveal solution','reveal','dp-quiet');
  }else if(assessmentOpen())actions=`<p class="dp-hint">Your answer saves automatically. Solutions and marks appear after you finish the assessment.</p>`;
  const status=submitted?`<p class="dp-submitted">● Submitted ${E(when(r.original.submitted_at))}${r.revision?` · revised ${E(when(r.revision.saved_at))}`:''}.${!done?' Further changes are saved as a revision; your original answer is kept.':''}</p>`:r.skipped?'<p class="dp-hint">↷ Skipped for now — come back whenever you are ready.</p>':r.revealed_without_attempt?'<p class="dp-hint">◐ Solution revealed without an attempt. You can still write an answer.</p>':'';
  return `<article class="dp-q" aria-labelledby="dpQTitle"><header class="dp-q-head"><div><h2 id="dpQTitle" tabindex="-1">${E(q.id)}</h2><p class="dp-q-meta">${[q.topic,q.difficulty,q.stage,q.stages.some(x=>x.toLowerCase()===TYPE_LABEL[q.type].toLowerCase())?'':TYPE_LABEL[q.type]].filter(Boolean).map(E).join(' · ')}</p></div>${a.status==='active'||a.status==='submitted'?btn(r.flagged?'⚑ Flagged for review':'⚐ Flag for review','flag','dp-small',`aria-pressed="${!!r.flagged}"`):''}</header>
   <div class="dp-prompt dp-md">${promptHtml}</div>
   ${q.choices.length?choicesView(q,w,r,locked||(submitted&&a.mode==='practice'),showMarks,sol):''}
   <section class="dp-answer" data-answer="${E(id)}" aria-label="Your answer">${q.choices.length&&q.format==='selection'?'':controls(q,w,locked)}</section>
   ${status}${conf}<div class="dp-actions">${actions}</div></article>
   ${sol?reviewView(q,r,sol):''}
   <nav class="dp-pager" aria-label="Question navigation">${btn('← Previous','prev','',idx<=0?'disabled':'')}<span>Question ${idx+1} of ${ids().length}</span>${btn(idx>=ids().length-1?'Summary →':'Next →','next')}</nav>`;
 }
 function reviewView(q,r,sol){
  const assessment=att.attempt.mode==='assessment',graded=r.mcq,options=sol.option_explanations;
  const marked=graded?`<p class="dp-banner ${graded.correct?'ok':'bad'}">${graded.correct?'✓ Correct':'✕ Not correct'} — you chose ${graded.selected.join(', ')||'nothing'}; the answer is ${sol.answer_key.join(', ')}. <small>(Marked automatically from the answer key.)</small></p>`:q.type==='mcq'&&!sol.answer_key.length?'<p class="dp-hint">This multiple-choice question has no answer key, so it is not marked automatically.</p>':'';
  const yours=r.original?responseView(r.original.response,q)+(r.revision?`<h4>Your revision ${r.revision.after_reveal?'(after viewing the solution)':''}</h4>${responseView(r.revision.response,q)}`:''):`<p class="dp-hint">${r.revealed_without_attempt?'You revealed this without submitting an answer.':'No answer submitted.'}</p>${has(working(r))?`<h4>Unsubmitted draft</h4>${responseView(working(r),q)}`:''}`;
  const checks=sol.check_items||[];
  return `<section class="dp-review" aria-labelledby="dpReviewTitle"><h2 id="dpReviewTitle" tabindex="-1">Compare your answer</h2>${marked}
   <div class="dp-compare"><div class="dp-col"><h3>Your answer</h3>${yours}</div><div class="dp-col dp-worked"><h3>${/```/.test(sol.answer)?'Example solution':'Worked answer'}</h3><div class="dp-md">${markdown(sol.answer)}</div>${/```/.test(sol.answer)?'<p class="dp-hint">One valid solution. Others can be correct if they meet the same specification.</p>':''}</div></div>
   ${sol.explain?`<section class="dp-sol-part"><h3>Explanation</h3><div class="dp-md">${markdown(sol.explain)}</div></section>`:''}
   ${sol.key_rule?`<aside class="dp-keyrule"><h3>Key rule</h3><div class="dp-md">${markdown(sol.key_rule)}</div></aside>`:''}
   ${options?`<section class="dp-sol-part"><h3>Why the other options are wrong</h3><ul class="dp-options">${Object.entries(options).map(([k,v])=>`<li><b>${E(k)}</b> ${inline(v)}</li>`).join('')}</ul></section>`:sol.options?`<section class="dp-sol-part"><h3>Why the other options are wrong</h3><div class="dp-md">${markdown(sol.options)}</div></section>`:''}
   ${sol.mistakes?`<details class="dp-sol-part"><summary>Common mistakes</summary><div class="dp-md">${markdown(sol.mistakes)}</div></details>`:''}
   ${checks.length?`<fieldset class="dp-checks"><legend>Check your solution <small>— a self-review checklist</small></legend>${checks.map((c,i)=>`<label><input type="checkbox" data-check="${i}" ${(r.checks||[]).includes(i)?'checked':''}> <span>${/```/.test(c)?markdown(c):inline(c)}</span></label>`).join('')}</fieldset>`:''}
   ${!assessment||att.attempt.status==='submitted'?`<fieldset class="dp-outcome"><legend>How did it go? <small>Your own assessment — not automated marking.</small></legend><div class="dp-actions">${Object.entries(OUTCOME).map(([k,l])=>btn(l,'outcome','',`data-outcome="${k}" aria-pressed="${r.review===k}"`)).join('')}</div></fieldset>`:''}</section>`;
 }
 const has=w=>!!(w&&((w.text||'').trim()||(w.code||'').trim()||(w.blanks||[]).some(b=>String(b).trim())||(w.selected||[]).length));
 function summaryView(){
  const s=att.summary;
  if(!s)return `<section class="dp-panel"><h2 id="dpQTitle" tabindex="-1">Assessment in progress</h2><p>Marks and solutions appear after you finish the assessment.</p>${unansweredList()}${btn('Finish assessment','finish','dp-primary')}</section>`;
  return `<section class="dp-panel dp-summary"><h2 id="dpQTitle" tabindex="-1">Attempt summary</h2><dl class="dp-stats"><div><dt>Submitted</dt><dd>${s.submitted} / ${s.questions}</dd></div><div><dt>Multiple choice (auto-marked)</dt><dd>${s.mcq_answered?`${s.mcq_correct} / ${s.mcq_answered} correct`:'—'}</dd></div><div><dt>Awaiting your self-review</dt><dd>${s.awaiting_review}</dd></div><div><dt>Solved independently (self-assessed)</dt><dd>${s.outcomes.independent}</dd></div><div><dt>Partly / needed help (self-assessed)</dt><dd>${s.outcomes.partial}</dd></div><div><dt>Needs more practice (self-assessed)</dt><dd>${s.outcomes.needs_practice}</dd></div><div><dt>Revealed without an attempt</dt><dd>${s.revealed_without_attempt}</dd></div><div><dt>Skipped / not started</dt><dd>${s.skipped} / ${s.not_started}</dd></div></dl>
   ${s.topics_needing_work.length?`<h3>Topics needing more work</h3><ul>${s.topics_needing_work.map(t=>`<li>${E(t.topic)} — ${plural(t.questions,'question')}</li>`).join('')}</ul>`:'<p>No topic is flagged as needing more work in this attempt.</p>'}
   <p class="dp-hint">Self-assessments are your own judgement. Only multiple choice with an answer key is marked by the app.</p><div class="dp-actions">${s.review_ids.length?btn('Practise questions needing work','practice-review','dp-primary'):''}${btn('Back to overview','back-overview')}</div></section>`;
 }
 function unansweredList(){const list=ids().filter(id=>!has(pending.get(id)||working(resp(id))));return list.length?`<p><b>${plural(list.length,'unanswered question')}:</b> ${list.map(id=>`<button type="button" class="dp-chip-btn" data-dp-jump="${E(id)}">${E(id)}</button>`).join(' ')}</p>`:'<p>Every question has an answer.</p>'}
 function focusQuestion(){requestAnimationFrame(()=>view.querySelector('#dpQTitle')?.focus({preventScroll:false}))}
 async function go(k){await flush();announce('');idx=Math.max(-1,Math.min(ids().length-1,k));if(idx===-1&&!assessmentOpen())att=await api({action:'attempt',attempt_id:att.attempt.id});navOpen=false;render();focusQuestion();view.querySelector('.dp-main')?.scrollTo?.(0,0);scrollTo({top:0})}

 // ------------------------------------------------------------------ rendering and events
 function render(){
  view.innerHTML=page==='import'?importPage():page==='overview'&&open?overviewPage():page==='workspace'&&att?workspacePage():libraryPage();
  bindIn(view);bindInputs();
 }
 // One action at a time (e.g. Reveal cannot start while Submit is still saving); view toggles are always allowed.
 const instant=new Set(['toggle-preview','toggle-ws','toggle-nav','close-nav']);
 function bindIn(root){root.querySelectorAll('[data-dp]').forEach(b=>b.onclick=ev=>{ev.preventDefault();const a=b.dataset.dp;if(instant.has(a)){act(a,b).catch(e=>announce(e.message));return}if(busy)return;busy=true;act(a,b).catch(e=>{announce(e.message);if(page==='workspace'&&!pending.size)setSave('',false)}).finally(()=>busy=false)})}
 function bindInputs(){
  const file=view.querySelector('#dpFile');if(file)file.onchange=()=>readFile(file.files[0]).catch(e=>announce(e.message));
  const src=view.querySelector('#dpSource');if(src)src.oninput=()=>{pv.source=src.value};
  const subj=view.querySelector('#dpSubject');if(subj)subj.onchange=()=>{pv.subject=subj.value;pv.topic='';pv.source=view.querySelector('#dpSource').value;render()};
  const topic=view.querySelector('#dpTopic');if(topic)topic.onchange=()=>pv.topic=topic.value;
  view.querySelector('#dpTitle')?.addEventListener('input',e=>pv.title=e.target.value);view.querySelector('#dpDescription')?.addEventListener('input',e=>pv.description=e.target.value);
  const only=view.querySelector('#dpOnlyCheck');if(only)only.onchange=()=>{pv.only=only.checked;const t=view.querySelector('.dp-type-table');t.outerHTML=typeTable(preview.quiz.questions,pv.overrides,pv.only);bindOverrides(view,pv.overrides)};
  bindOverrides(view,pv.overrides);
  view.querySelectorAll('[data-checklist]').forEach(c=>c.onchange=async()=>{c.disabled=true;try{await api({action:'checklist',quiz_id:open.id,item:+c.dataset.checklist,checked:c.checked});open.checklist[+c.dataset.checklist]=c.checked;announce('Checklist saved.')}catch(e){c.checked=!c.checked;announce(e.message)}finally{c.disabled=false}});
  const filter=view.querySelector('#dpFilter');if(filter)filter.onsubmit=ev=>{ev.preventDefault();const v=Object.fromEntries(new FormData(filter));startAttempt('practice',{kind:'filter',...Object.fromEntries(Object.entries(v).filter(([,x])=>x))}).catch(e=>announce(e.message))};
  const link=view.querySelector('#dpLinkSubject');if(link)link.onchange=async()=>{try{open={...open,...await api({action:'update',quiz_id:open.id,subject_id:link.value||null,topic_name:null})};announce(link.value?'Linked to '+subjectName(link.value)+'.':'Subject link removed.');lib=null}catch(e){announce(e.message)}};
  const replace=view.querySelector('#dpReplace');if(replace)replace.onchange=async()=>{const f=replace.files[0];if(!f)return;try{if(f.size>2_000_000)throw Error('Choose a Markdown file up to 2 MB.');const text=await f.text();if(await ask('Replace with the updated workbook?','<p>The quiz is re-imported from the new file. Your attempts, answers and type corrections are kept; questions are matched by ID.</p>',[['cancel','Cancel'],['ok','Replace','dp-primary']])!=='ok')return;open=await api({action:'reprocess',quiz_id:open.id,source:text,source_name:f.name});render();announce(`Updated from ${f.name}. Content version ${open.content_version}.`)}catch(e){announce(e.message)}finally{replace.value=''}};
  view.querySelectorAll('.dp-main [data-dp-jump]').forEach(b=>b.onclick=()=>go(ids().indexOf(b.dataset.dpJump)).catch(e=>announce(e.message)));
  const box=view.querySelector('[data-answer]');
  if(box&&page==='workspace'){
   const editable=att.attempt.status==='active'&&!(att.attempt.mode==='assessment'&&att.attempt.status==='submitted');
   const fields=[...view.querySelectorAll('[data-answer] textarea,[data-answer] select,.dp-prompt .dp-blank,[data-choice]')];
   fields.forEach(f=>{f.disabled=f.disabled||!editable||(f.matches('[data-choice]')&&!!resp(box.dataset.answer)?.original&&att.attempt.mode==='practice');f.addEventListener(f.matches('select,[data-choice]')?'change':'input',()=>{changed();if(f.matches('.dp-blank'))f.size=Math.max(5,f.value.length+1)})});
   view.querySelectorAll('[data-answer] textarea').forEach(autosize);
   view.querySelectorAll('[data-editor]').forEach(codeEditor);
   view.querySelectorAll('input[name=dpConfidence]').forEach(r=>r.onchange=()=>op({question_id:box.dataset.answer,op:'confidence',confidence:r.value}).then(()=>announce('Confidence recorded.')).catch(e=>announce(e.message)));
   view.querySelectorAll('[data-check]').forEach(c=>c.onchange=()=>{const list=[...view.querySelectorAll('[data-check]:checked')].map(x=>+x.dataset.check);op({question_id:box.dataset.answer,op:'checks',checks:list}).catch(e=>announce(e.message))});
   const ta=view.querySelector('[data-answer] textarea[data-field=text]');if(ta&&ta.classList.contains('dp-mono'))ta.addEventListener('input',()=>wsView(ta));
  }
 }
 function bindOverrides(root,store){root.querySelectorAll('[data-override]').forEach(s=>s.onchange=()=>{const id=s.dataset.override;store[id]={...(store[id]||{}),[s.dataset.field]:s.value};const row=s.closest('tr');const small=row.querySelector('td small:last-of-type');if(small&&!small.textContent.startsWith('Changed'))small.insertAdjacentHTML('afterbegin','<b>Changed by you.</b> ')})}
 function autosize(t){const fit=()=>{t.style.height='auto';t.style.height=Math.min(Math.max(t.scrollHeight+2,t.classList.contains('dp-code-input')?180:120),900)+'px'};t.addEventListener('input',fit);fit()}
 function wsView(t){const out=t.parentElement.querySelector('.dp-ws-view');if(out&&!out.hidden)out.innerHTML=E(t.value).replace(/ /g,'<span class="dp-wsmark">·</span>').replace(/\t/g,'<span class="dp-wsmark">→\t</span>').replace(/\n/g,'<span class="dp-wsmark">↵</span>\n')+'<span class="dp-wsmark">⊣</span>'}
 // A monospaced editor: indentation with Tab/Shift+Tab, auto-indent on Enter, Esc releases Tab for keyboard users.
 function codeEditor(t){
  const gutter=t.parentElement.querySelector('.dp-gutter');let release=false;
  const lines=()=>{const n=t.value.split('\n').length;if(gutter.dataset.n!=n){gutter.textContent=Array.from({length:n},(_,i)=>i+1).join('\n');gutter.dataset.n=n}};
  const insert=text=>{if(!document.execCommand('insertText',false,text))t.setRangeText(text,t.selectionStart,t.selectionEnd,'end');t.dispatchEvent(new Event('input',{bubbles:true}))};
  t.addEventListener('keydown',ev=>{
   if(ev.key==='Escape'){release=true;return}
   if(ev.key==='Tab'&&!release&&!ev.ctrlKey&&!ev.altKey&&!ev.metaKey){
    ev.preventDefault();const {selectionStart:s,selectionEnd:e,value:v}=t,from=v.lastIndexOf('\n',s-1)+1;
    if(s===e&&!ev.shiftKey){insert('    ');return}
    const to=e>s&&v[e-1]==='\n'?e-1:e,block=v.slice(from,to),next=ev.shiftKey?block.replace(/^( {1,4}|\t)/gm,''):block.replace(/^/gm,'    ');
    t.setSelectionRange(from,to);insert(next);t.setSelectionRange(from,from+next.length);return}
   release=false;
   if(ev.key==='Enter'&&!ev.ctrlKey&&!ev.metaKey&&!ev.altKey&&!ev.shiftKey){const v=t.value,from=v.lastIndexOf('\n',t.selectionStart-1)+1,indent=v.slice(from).match(/^[ \t]*/)[0];if(indent){ev.preventDefault();insert('\n'+indent)}}
  });
  t.addEventListener('input',lines);t.addEventListener('scroll',()=>gutter.scrollTop=t.scrollTop);lines();autosize(t);
 }

 async function act(a,el){
  if(a==='library'){await flush();page='library';open=null;att=null;await loadLibrary();announce('');render();return}
  if(a==='import'){openImport();return}
  if(a==='preview'){await runPreview();return}
  if(a==='save-import'){el.disabled=true;try{await saveImport()}finally{el.disabled=false}return}
  if(a==='cancel-import'){preview=null;pv=freshImport();page='library';await loadLibrary();render();return}
  if(a==='open'){await openQuiz(el.dataset.id);return}
  if(a==='start-card'){await openQuiz(el.dataset.id);await startAttempt('practice',{kind:'all'});return}
  if(a==='resume-card'){const q=lib.quizzes.find(x=>x.id===el.dataset.id);open=await api({action:'open',quiz_id:q.id});await resumeAttempt(q.active_practice);return}
  if(a==='practice-all'){const active=open.attempts.find(x=>x.status==='active'&&x.mode==='practice');if(active&&await ask('Start a fresh practice attempt?','<p>Your current attempt is kept in the attempt history with all its answers. The new attempt starts with every question unanswered.</p>',[['cancel','Keep current attempt'],['ok','Start fresh','dp-primary']])!=='ok')return;await startAttempt('practice',{kind:'all'});return}
  if(a==='practice-topic'){await startAttempt('practice',{kind:'topic',topic:el.dataset.topic});return}
  if(a==='practice-review'){if(page==='workspace'){await flush();open=await api({action:'open',quiz_id:open.id})}await startAttempt('practice',{kind:'review'});return}
  if(a==='assessment'){if(await ask('Start an assessment?',`<p>Answer the questions without solutions or marks. You can move between questions and change answers; everything saves as you go.</p><p>When you choose <b>Finish assessment</b>, unanswered questions are listed first. After you submit, you can review every question with its worked solution.</p><p class="dp-hint">This is self-study practice, not a proctored exam.</p>`,[['cancel','Cancel'],['ok','Start assessment','dp-primary']])!=='ok')return;await startAttempt('assessment',{kind:'all'});return}
  if(a==='resume'){await resumeAttempt(el.dataset.id);return}
  if(a==='back-overview'){await flush();await openQuiz(open.id);return}
  if(a==='toggle-nav'){if(matchMedia('(max-width: 900px)').matches)navOpen=!navOpen;else{collapsed=!collapsed;try{localStorage.setItem('dp.navCollapsed',collapsed?'1':'0')}catch{}}const ws=view.querySelector('.dp-ws');ws.classList.toggle('nav-open',navOpen);ws.classList.toggle('collapsed',collapsed);el.setAttribute('aria-expanded',String(navOpen||!collapsed));if(navOpen)view.querySelector('#dpNav .current')?.focus();return}
  if(a==='close-nav'){navOpen=false;view.querySelector('.dp-ws')?.classList.remove('nav-open');view.querySelector('.dp-nav-toggle')?.focus();return}
  if(a==='go'){await go(+el.dataset.i);return}
  if(a==='prev'){await go(idx-1);return}
  if(a==='next'){await go(idx>=ids().length-1?-1:idx+1);return}
  const id=ids()[idx];
  if(a==='flag'){const on=!resp(id)?.flagged;await op({question_id:id,op:'flag',flagged:on});updateNavItem(id);el.textContent=on?'⚑ Flagged for review':'⚐ Flag for review';el.setAttribute('aria-pressed',String(on));announce(on?'Flagged for review.':'Flag removed.');return}
  if(a==='submit'){const c=collect();if(!c||!has(c.value))throw Error('Write or choose an answer before submitting, or choose Skip for now.');pending.delete(id);const conf=view.querySelector('input[name=dpConfidence]:checked')?.value;await op({question_id:id,op:'submit',response:c.value,...(conf?{confidence:conf}:{})});try{localStorage.removeItem(backupKey(id))}catch{}render();announce(resp(id).mcq?'Answer submitted and marked. You can now reveal the worked solution.':'Answer submitted. Reveal the worked solution to compare.');view.querySelector('[data-dp=reveal]')?.focus();return}
  if(a==='skip'){await op({question_id:id,op:'skip'});announce('Skipped for now.');await go(idx>=ids().length-1?-1:idx+1);return}
  if(a==='reveal'){
   const r=resp(id)||{};
   if(!r.original){const draft=has(collect()?.value);const choice=await ask('Reveal without submitting?',`<p>${draft?'You have an unsubmitted draft. Submit it first so it is kept as your original attempt, or reveal now.':'You have not answered this question yet.'}</p><p class="dp-hint">Revealing now is recorded as <b>revealed without an attempt</b>. You can still write an answer afterwards.</p>`,[['cancel','Cancel'],...(draft?[['submit','Submit, then reveal']]:[]),['reveal','Reveal anyway','dp-primary']]);if(choice==='cancel')return;if(choice==='submit'){await act('submit');}}
   await op({question_id:id,op:'reveal'});render();announce('Worked solution shown below your answer.');requestAnimationFrame(()=>view.querySelector('#dpReviewTitle')?.focus());return}
  if(a==='outcome'){const outcome=el.dataset.outcome,now=resp(id)?.review===outcome?null:outcome;await op({question_id:id,op:'review',outcome:now});view.querySelectorAll('[data-dp=outcome]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.outcome===now)));updateNavItem(id);announce(now?`Recorded: ${OUTCOME[now]} (self-assessment).`:'Self-assessment cleared.');return}
  if(a==='toggle-preview'){const box=el.closest('.dp-text'),out=box.querySelector('.dp-text-preview'),on=out.hidden;out.hidden=!on;el.setAttribute('aria-pressed',String(on));if(on)out.innerHTML=markdown(box.querySelector('textarea').value)||'<p class="dp-hint">Nothing to preview yet.</p>';return}
  if(a==='toggle-ws'){const box=el.closest('.dp-text'),out=box.querySelector('.dp-ws-view'),on=out.hidden;out.hidden=!on;el.setAttribute('aria-pressed',String(on));if(on)wsView(box.querySelector('textarea'));return}
  if(a==='finish'){await flush();const choice=await ask('Finish the assessment?',`${unansweredList()}<p>After submitting, answers can no longer change. Multiple-choice questions are marked and every worked solution becomes available.</p>`,[['cancel','Keep working'],['ok','Submit assessment','dp-primary']]);if(choice.startsWith('jump:')){const k=ids().indexOf(choice.slice(5));if(k>=0)await go(k);return}if(choice!=='ok')return;att=await api({action:'finish',attempt_id:att.attempt.id});idx=-1;render();announce('Assessment submitted. Review each question with its worked solution.');focusQuestion();return}
  if(a==='edit-types'){const store=JSON.parse(JSON.stringify(open.overrides||{}));dialog.innerHTML=`<form method="dialog" class="dp-wide-dialog"><h2>Edit question types</h2>${typeTable(open.quiz.questions.map(q=>({...q,type:q.inferred.type,format:q.inferred.format,language:q.inferred.language})),store,false)}<footer><button value="cancel" class="dp-btn">Cancel</button><button value="ok" class="dp-btn dp-primary">Save types</button></footer></form>`;bindOverrides(dialog,store);dialog.returnValue='';dialog.showModal();dialog.onclose=async()=>{if(dialog.returnValue!=='ok')return;try{open={...open,...await api({action:'update',quiz_id:open.id,overrides:store})};render();announce('Question types saved.')}catch(e){announce(e.message)}};return}
  if(a==='download'){const r=await api({action:'source',quiz_id:open.id});const url=URL.createObjectURL(new Blob([r.source],{type:'text/markdown;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=r.name||'workbook.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return}
  if(a==='reprocess'){open=await api({action:'reprocess',quiz_id:open.id});render();announce(`Reprocessed the original Markdown (content version ${open.content_version}).`);return}
  if(a==='delete'){if(await ask('Delete this Deep Practice quiz?','<p>The quiz, its original Markdown and every attempt and answer are permanently deleted. Download the original Markdown first if you may need it.</p>',[['cancel','Keep quiz'],['ok','Delete permanently','dp-danger']])!=='ok')return;await api({action:'delete',quiz_id:open.id});open=null;page='library';await loadLibrary();announce('Deleted.');render();return}
 }

 function openImport(subjectId=''){pv.subject=subjectId||pv.subject;page='import';o.show?.('deep-practice');render();view.querySelector('#dpFile')?.focus()}
 async function onShow(name){
  document.body.classList.toggle('dp-open',name==='deep-practice');
  if(name!=='deep-practice')return;
  if(page==='import'||(page==='workspace'&&att)||(page==='overview'&&open)){render();return}
  view.innerHTML='<p class="dp-loading" role="status">Loading Deep Practice…</p>';
  try{await loadLibrary();render()}catch(e){view.innerHTML=`<div class="dp-empty"><h2>Deep Practice could not load</h2><p>${E(e.message)}</p><button type="button" class="dp-btn" data-dp="library">Retry</button></div>`;bindIn(view)}
 }
 // Linked quizzes inside a subject's Quizzes tab.
 async function mountSubject(host,subjectId){
  try{await loadLibrary()}catch{host.innerHTML='';return}
  const list=(lib.quizzes||[]).filter(q=>q.subject_id===subjectId);
  host.innerHTML=`<div class="dp-subject"><div class="dp-subject-head"><h3>Deep Practice</h3><button type="button" class="dp-btn" data-dp-subject-import>＋ Import a workbook</button></div>${list.length?list.map(q=>`<button type="button" class="dp-subject-card" data-dp-subject-open="${q.id}"><b>${E(q.title)}</b><small>${plural(q.questions,'question')} · ${q.summary.submitted} submitted${q.active_practice?' · in progress':''}</small></button>`).join(''):'<p class="dp-hint">Open-response practice — recall, explain, trace, debug and write code. Import a Markdown workbook to add one to this subject.</p>'}</div>`;
  host.querySelector('[data-dp-subject-import]').onclick=()=>openImport(subjectId);
  host.querySelectorAll('[data-dp-subject-open]').forEach(b=>b.onclick=async()=>{o.show?.('deep-practice');await openQuiz(b.dataset.dpSubjectOpen)});
 }
 function canLeave(){
  if(pending.size||failed.size){if(!confirm('Some Deep Practice answers are not saved yet. Leave anyway? A copy is kept in this browser and restored when you return.'))return false}
  flush();return true;
 }
 addEventListener('beforeunload',ev=>{if(pending.size||failed.size){ev.preventDefault();ev.returnValue=''}});
 return {onShow,canLeave,openImport,mountSubject,openQuiz:async id=>{o.show?.('deep-practice');await openQuiz(id)},refresh:async()=>{lib=null;await loadLibrary()}};
}
g.StudentDeepPractice={create,markdown};
})(typeof window==='undefined'?globalThis:window);
