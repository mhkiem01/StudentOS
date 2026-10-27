/* Voice tutor: choose a subject, topic and mode, then study by talking.
   ask      - your questions, answered only from that scope's notes (/api/ai/voice/ask)
   quiz     - your saved multiple-choice questions, graded locally and exactly
   practice - the AI asks from your notes and marks spoken answers (/api/ai/voice/practice/*)
   The browser does the listening and speaking; typing always works as a fallback. */
(function(global){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const Recognition=global.SpeechRecognition||global.webkitSpeechRecognition;
 const LETTERS={a:'A',ay:'A',eh:'A',hey:'A',b:'B',be:'B',bee:'B',c:'C',see:'C',sea:'C',si:'C',d:'D',dee:'D',de:'D',e:'E'};
 const FILLER=new Set(['answer','option','letter','is','its','it','i','think','choose','pick','say','my','final','um','uh','er','go','with','the','number']);
 const MODES={
   ask:{label:'Ask me',icon:'💬',blurb:'You ask, it answers only from your notes.'},
   quiz:{label:'Quiz me',icon:'✓',blurb:'Your saved multiple-choice questions, read aloud. Answer A, B, C or D.'},
   practice:{label:'Oral practice',icon:'🎓',blurb:'It asks questions from your notes. Answer in your own words and get marked.'},
 };
 const HINTS={
   ask:'Ask things like “what does lb do?” or “give me an example”. Say “end session” to finish.',
   quiz:'Say “B”, “option C” or the answer’s words. Also: “repeat”, “explain more”, “next”, “end session”.',
   practice:'Answer in your own words. Also: “hint”, “repeat”, “skip”, “I don’t know”, “end session”.',
 };
 const shuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const words=s=>String(s||'').toLowerCase().replace(/[^a-z0-9' ]/g,' ').replace(/'/g,'').split(/\s+/).filter(Boolean);
 const speakable=s=>String(s||'').replace(/```[\s\S]*?```/g,' ').replace(/[`*#_>|]/g,' ').replace(/\s+/g,' ').trim();
 const validQuestion=q=>q&&q.question&&q.choices&&q.answer;

 function parseAnswer(text,choices){
   const rest=words(text).filter(w=>!FILLER.has(w));
   if(rest.length===1&&LETTERS[rest[0]]&&choices[LETTERS[rest[0]]]!==undefined)return LETTERS[rest[0]];
   // "facial expression" -> the choice whose words were spoken
   const said=new Set(rest);let best=null,bestScore=0;
   for(const [letter,choice] of Object.entries(choices)){const cw=words(choice).filter(w=>w.length>2);if(!cw.length)continue;const score=cw.filter(w=>said.has(w)).length/cw.length;if(score>bestScore){best=letter;bestScore=score}}
   return bestScore>=.6?best:null;
 }
 function micProblem(){
   if(!Recognition)return 'This browser cannot listen. Use Chrome or Edge on a computer, or type your answers.';
   if(!global.isSecureContext)return `Browsers only allow the microphone on https or localhost. On this laptop open http://localhost:${location.port||80}/ to talk, or type your answers here.`;
   return '';
 }
 // Chrome stops long utterances after about 15 seconds, so speak a sentence or two at a time.
 function sentences(text){
   const parts=speakable(text).match(/[^.!?]+[.!?]*\s*/g)||[],out=[];let current='';
   for(const part of parts){if(current&&(current+part).length>180){out.push(current);current=''}current+=part}
   if(current.trim())out.push(current);
   return out;
 }

 function create(options){
   const root=options.root;
   let prefs={subject:'',topic:'',mode:'ask',count:'10',voice:'',rate:'1',handsFree:false};
   try{prefs={...prefs,...JSON.parse(localStorage.getItem('portal.voiceTutor')||'{}')}}catch{}
   const savePrefs=()=>{try{localStorage.setItem('portal.voiceTutor',JSON.stringify(prefs))}catch{}};
   let state='idle',recognizer=null,speechToken=0,lastSpoken='',history=[],session=null,busy=null;

   root.innerHTML=`<div class="voice-shell">
     <section class="voice-setup" data-setup>
       <h2>What do you want to study?</h2>
       <p class="voice-summary" data-summary hidden></p>
       <div class="voice-pick"><label>Subject<select data-subject></select></label><label>Topic<select data-topic></select></label></div>
       <div class="voice-modes" role="radiogroup" aria-label="Study mode" data-modes></div>
       <div class="voice-pick">
         <label data-count-row>Questions<select data-count><option value="5">5</option><option value="10">10</option><option value="0">All / until I stop</option></select></label>
         <label>Voice<select data-voice></select></label>
         <label>Speed<select data-rate><option value="0.85">Slower</option><option value="1">Normal</option><option value="1.15">Faster</option></select></label>
       </div>
       <label class="voice-toggle"><input type="checkbox" data-handsfree> Hands-free: in Ask me, listen again after every answer</label>
       <p class="voice-warning" data-mic hidden></p>
       <div class="voice-begin"><button class="btn primary" data-begin>Start</button><span class="muted" data-begin-note></span></div>
     </section>
     <section class="voice-session" data-session hidden>
       <header class="voice-session-head"><div><b data-title></b><small data-score></small></div><button class="btn secondary small" data-end>End session</button></header>
       <div class="voice-stage">
         <button class="voice-orb" data-orb aria-label="Tap to talk"><span></span></button>
         <p class="voice-status" data-status role="status"></p>
         <p class="voice-live" data-live></p>
       </div>
       <div class="voice-card" data-card hidden></div>
       <form class="voice-type" data-type><input data-text autocomplete="off" aria-label="Type instead of speaking"><button class="btn primary">Send</button></form>
       <p class="voice-hint" data-hint></p>
       <div class="voice-log" data-log aria-live="polite"></div>
     </section>
   </div>`;
   const $=s=>root.querySelector(s);
   const subjectSelect=$('[data-subject]'),topicSelect=$('[data-topic]'),status=$('[data-status]'),live=$('[data-live]'),log=$('[data-log]'),orb=$('[data-orb]'),card=$('[data-card]');

   // ---- scope ----
   const subject=()=>options.subjects().find(s=>s.id===subjectSelect.value);
   const scopeName=()=>topicSelect.value||subject()?.name||'';
   const quizItems=()=>(topicSelect.value?[topicSelect.value]:subject()?.topics||[]).flatMap(t=>options.questions(t).filter(validQuestion).map(q=>({...q,topic:t})));
   const scopedNotes=()=>options.notes().filter(n=>n.subject_id===subjectSelect.value&&(!topicSelect.value||n.topic_name===topicSelect.value));
   function available(mode){
     if(!subject())return 'Choose a subject first.';
     if(mode==='quiz')return quizItems().length?'':`There are no saved quiz questions in ${scopeName()} yet.`;
     return scopedNotes().length?'':`There are no notes in ${scopeName()} yet.`;
   }

   // ---- setup screen ----
   function renderSetup(){
     const list=options.subjects();
     const wanted=list.some(s=>s.id===subjectSelect.value)?subjectSelect.value:list.some(s=>s.id===prefs.subject)?prefs.subject:(options.currentSubject()||list[0]?.id||'');
     subjectSelect.innerHTML=list.length?list.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''):'<option value="">No subjects yet</option>';
     subjectSelect.value=list.some(s=>s.id===wanted)?wanted:'';
     const topics=subject()?.topics||[],keep=topics.includes(topicSelect.value)?topicSelect.value:topics.includes(prefs.topic)?prefs.topic:'';
     topicSelect.innerHTML='<option value="">All topics</option>'+topics.map(t=>`<option>${esc(t)}</option>`).join('');
     topicSelect.value=keep;
     const counts={ask:scopedNotes().length,quiz:quizItems().length,practice:scopedNotes().length};
     $('[data-modes]').innerHTML=Object.entries(MODES).map(([key,m])=>{const why=available(key);return `<button type="button" role="radio" aria-checked="${prefs.mode===key}" class="voice-mode${prefs.mode===key?' active':''}" data-mode="${key}"${why?' aria-disabled="true"':''}><span class="voice-mode-icon" aria-hidden="true">${m.icon}</span><b>${m.label}</b><small>${m.blurb}</small><em>${key==='quiz'?counts.quiz+' question'+(counts.quiz===1?'':'s'):counts[key]+' note'+(counts[key]===1?'':'s')}</em></button>`}).join('');
     root.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{prefs.mode=b.dataset.mode;savePrefs();renderSetup()});
     $('[data-count]').value=prefs.count;$('[data-count-row]').hidden=prefs.mode==='ask';
     $('[data-rate]').value=String(prefs.rate);$('[data-handsfree]').checked=!!prefs.handsFree;
     const mic=micProblem();$('[data-mic]').hidden=!mic;$('[data-mic]').textContent=mic;
     const why=available(prefs.mode);$('[data-begin]').disabled=!!why;$('[data-begin-note]').textContent=why;
     fillVoices();
   }
   function fillVoices(){
     const voices=(global.speechSynthesis?.getVoices()||[]).filter(v=>/^en/i.test(v.lang)),select=$('[data-voice]');
     select.innerHTML='<option value="">Default</option>'+voices.map(v=>`<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('');
     select.value=voices.some(v=>v.name===prefs.voice)?prefs.voice:'';
   }
   function showSetup(){$('[data-setup]').hidden=false;$('[data-session]').hidden=true;renderSetup()}

   // ---- speaking and listening ----
   const idleText=()=>micProblem()?'Type your reply below.':'Tap the circle to talk, or type below.';
   function setState(next,message){state=next;orb.dataset.state=next;if(message!==undefined)status.textContent=message}
   function hush(){speechToken++;global.speechSynthesis?.cancel()}
   function speak(text,after){
     lastSpoken=text;hush();
     const token=++speechToken,parts=sentences(text);
     const done=()=>{if(token!==speechToken)return;speechToken++;setState('idle',idleText());if(after)after();else if(prefs.handsFree&&session?.mode==='ask')listen()};
     if(!global.speechSynthesis||!parts.length){done();return}
     const voice=speechSynthesis.getVoices().find(v=>v.name===prefs.voice),rate=Number(prefs.rate)||1;
     setState('speaking','Speaking… tap the circle to interrupt.');
     let index=0;
     const next=()=>{
       if(token!==speechToken)return;
       if(index>=parts.length){done();return}
       const utterance=new SpeechSynthesisUtterance(parts[index++]);if(voice)utterance.voice=voice;utterance.rate=rate;
       let finished=false;
       // Some browsers never report the end of speech; never let the session stall on it.
       const guard=setTimeout(()=>finish(),3000+utterance.text.length*110/rate);
       const finish=()=>{if(finished)return;finished=true;clearTimeout(guard);next()};
       utterance.onend=finish;utterance.onerror=finish;
       speechSynthesis.speak(utterance);
     };
     next();
   }
   function listen(){
     if(!session)return;
     const problem=micProblem();if(problem){setState('idle',idleText());return}
     hush();
     recognizer=new Recognition();recognizer.lang=navigator.language||'en-US';recognizer.interimResults=true;recognizer.maxAlternatives=1;
     let heard='';
     recognizer.onresult=ev=>{heard=[...ev.results].map(r=>r[0].transcript).join(' ');live.textContent=heard};
     recognizer.onerror=ev=>{recognizer=null;setState('idle',ev.error==='not-allowed'?'Microphone blocked. Allow microphone access for this site, or type below.':ev.error==='no-speech'?'I didn’t hear anything. Tap the circle to try again.':'Voice input stopped ('+ev.error+'). Tap to retry.')};
     recognizer.onend=()=>{recognizer=null;live.textContent='';if(state!=='listening')return;if(heard.trim())handle(heard.trim());else setState('idle',idleText())};
     setState('listening','Listening…');
     try{recognizer.start()}catch{setState('idle','Could not start the microphone. Tap to retry.')}
   }
   function stopAll(){busy?.abort();busy=null;hush();if(recognizer){const r=recognizer;recognizer=null;r.abort()}setState('idle',idleText())}

   // ---- transcript ----
   function add(role,text,extra={}){
     const item=document.createElement('div');item.className='voice-msg '+role;
     const by=extra.answered_by||extra.asked_by||extra.graded_by;
     item.innerHTML=`<p>${esc(text)}</p>${extra.code?`<pre>${esc(extra.code)}</pre>`:''}${extra.sources?.length?`<small>From: ${extra.sources.map(esc).join(', ')}</small>`:''}${extra.verified===false?'<small class="voice-unverified">⚠ The checker could not confirm this against your notes.</small>':''}${by?`<small>By ${esc(by)}${extra.checked_by?` · ${extra.verified?'✓ checked':'checked'} by ${esc(extra.checked_by)}`:''}</small>`:''}`;
     log.prepend(item);
   }
   async function post(url,body,waiting){
     busy?.abort();const controller=busy=new AbortController();
     setState('thinking',waiting);
     try{
       const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(body)});
       const data=await response.json().catch(()=>({}));
       if(response.status===404||response.status===401)throw Error('The server needs a restart to use the Voice Tutor. Close the server window and run START_ANYWHERE.bat again.');
       if(!response.ok||data.ok===false)throw Error(data.error||'The voice tutor could not respond.');
       return data;
     }catch(error){
       if(error.name==='AbortError')return null;
       add('tutor error',error.message);speak(error.message);return null;
     }finally{if(busy===controller)busy=null}
   }
   function updateScore(){
     const s=session;if(!s){$('[data-score]').textContent='';return}
     $('[data-score]').textContent=s.mode==='quiz'?`Question ${Math.min(s.index+1,s.items.length)} of ${s.items.length} · Score ${s.correct}/${s.answered}`:s.mode==='practice'?`${s.answered} answered · ✓ ${s.correct} · ½ ${s.partial} · ✗ ${s.incorrect}`:'';
   }

   // ---- sessions ----
   function begin(){
     const why=available(prefs.mode);if(why)return;
     const subj=subject(),topic=topicSelect.value,mode=prefs.mode;
     session={mode,subjectId:subj.id,subject:subj.name,topic,index:0,answered:0,correct:0,partial:0,incorrect:0,items:[],current:null,last:null,used:[],asked:[]};
     history=[];log.innerHTML='';$('[data-summary]').hidden=true;
     $('[data-setup]').hidden=true;$('[data-session]').hidden=false;
     $('[data-title]').textContent=`${subj.name}${topic?' · '+topic:''} · ${MODES[mode].label}`;
     $('[data-hint]').textContent=HINTS[mode];$('[data-text]').placeholder=mode==='quiz'?'Type A, B, C or D':mode==='practice'?'Type your answer':'Type a question about your notes';
     renderCard();updateScore();
     const where=topic||subj.name;
     if(mode==='ask'){const intro=`Ask me anything about ${where}. I only answer from your notes.`;add('tutor',intro);speak(intro,listen);return}
     if(mode==='quiz'){
       const all=shuffle(quizItems()),count=Number(prefs.count)||all.length;session.items=all.slice(0,count);
       const intro=`Here is a ${session.items.length}-question quiz on ${where}. Answer A, B, C or D.`;add('tutor',intro);speak(intro,readQuizQuestion);return;
     }
     session.limit=Number(prefs.count)||0;
     const intro=`Let's practise ${where}. I'll ask questions from your notes. Answer in your own words.`;add('tutor',intro);speak(intro,nextPractice);
   }
   function finish(){
     if(!session)return;const s=session;
     const msg=s.mode==='quiz'&&s.answered?`Session finished. You got ${s.correct} out of ${s.answered}.`:s.mode==='practice'&&s.answered?`Session finished. ${s.correct} correct, ${s.partial} partly right and ${s.incorrect} to review, out of ${s.answered}.`:'Session ended.';
     stopAll();session=null;showSetup();
     $('[data-summary]').hidden=false;$('[data-summary]').textContent=msg;speak(msg);
   }
   function repeat(){
     if(session?.mode==='quiz'&&!session.answeredCurrent)return readQuizQuestion();
     if(session?.mode==='practice'&&session.current)return speak(session.current.question,listen);
     speak(lastSpoken||'Nothing to repeat yet.',session?.mode==='ask'?undefined:listen);
   }
   function renderCard(){
     const s=session;updateScore();
     if(!s||s.mode==='ask'){card.hidden=true;return}
     card.hidden=false;
     if(s.mode==='quiz'){
       const q=s.items[s.index];if(!q){card.hidden=true;return}
       card.innerHTML=`<p class="voice-card-label">${esc(q.topic)}</p><p class="voice-card-question">${esc(q.question)}</p><div class="voice-choices">${Object.entries(q.choices).map(([k,v])=>`<button data-choice="${esc(k)}"${s.answeredCurrent?' disabled':''} class="${s.answeredCurrent&&k===q.answer?'right':s.answeredCurrent&&k===s.chosen?'wrong':''}"><b>${esc(k)}</b> ${esc(v)}</button>`).join('')}</div>${s.last?'<div class="voice-card-actions"><button class="btn secondary small" data-explain>Explain more</button></div>':''}`;
       card.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>gradeQuiz(b.dataset.choice));
       card.querySelector('[data-explain]')?.addEventListener('click',explainQuiz);
       return;
     }
     const q=s.current,r=s.result;
     card.innerHTML=q?`<p class="voice-card-label">Question ${s.answered+1}${s.limit?' of '+s.limit:''} · from ${esc(q.source)}</p><p class="voice-card-question">${esc(q.question)}</p><div class="voice-card-actions"><button class="btn secondary small" data-hint-btn>Hint</button><button class="btn secondary small" data-skip>Skip</button></div>`
       :r?`<p class="voice-card-label voice-verdict ${r.verdict}">${r.verdict==='correct'?'✓ Correct':r.verdict==='partial'?'½ Partly right':'✗ Not quite'}</p><p class="voice-card-question">${esc(r.question)}</p><p><b>Model answer:</b> ${esc(r.answer)}</p>`
       :'<p class="voice-card-label">Preparing the next question…</p>';
     card.querySelector('[data-hint-btn]')?.addEventListener('click',hint);
     card.querySelector('[data-skip]')?.addEventListener('click',()=>skipPractice());
   }

   // quiz: saved multiple-choice questions, graded exactly
   function readQuizQuestion(){
     const s=session;if(!s)return;const q=s.items[s.index];if(!q)return finish();
     s.answeredCurrent=false;s.chosen=null;renderCard();
     speak(`Question ${s.index+1}. ${q.question} ${Object.entries(q.choices).map(([k,v])=>`${k}: ${v}.`).join(' ')}`,listen);
   }
   function nextQuiz(){const s=session;if(!s)return;if(s.index+1>=s.items.length)return finish();s.index++;readQuizQuestion()}
   async function gradeQuiz(letter){
     const s=session;if(!s||s.answeredCurrent)return;const q=s.items[s.index];
     s.answeredCurrent=true;s.chosen=letter;s.answered++;s.last={...q,chosen:letter};
     if(letter===q.answer){s.correct++;renderCard();add('tutor','Correct!');speak('Correct!',nextQuiz);return}
     s.incorrect++;renderCard();
     const lead=`That's wrong. The answer is ${q.answer}: ${q.choices[q.answer]}.`;
     if(q.explain){add('tutor',lead+' '+q.explain);speak(lead+' '+q.explain,nextQuiz);return}
     const data=await askNotes(`Why is ${q.answer} the correct answer, and why is ${letter} wrong?`,s.last,true);
     if(session!==s)return;
     speak(data?`${lead} ${data.answer}`:lead,nextQuiz);
   }
   async function explainQuiz(){
     const s=session;if(!s?.last)return;
     const data=await askNotes('Explain this question in more detail.',s.last,true);
     if(data&&session===s)speak(data.answer+' Say next when you are ready.',listen);
   }
   function handleQuiz(said,text){
     const s=session;
     if(/^(next|skip|next question|skip (it|this))$/.test(said)){if(!s.answeredCurrent){s.answered++;s.incorrect++}return nextQuiz()}
     if(/^(explain( more| that| it)?|why|why is that|tell me more)$/.test(said)&&s.last)return explainQuiz();
     const letter=parseAnswer(said,s.items[s.index].choices);
     if(s.answeredCurrent&&letter)return speak('You already answered that one. Say next to continue.',listen);
     if(letter)return gradeQuiz(letter);
     if(/^(what|how|why|when|where|which|who|can|does|do|is|are)\b/.test(said))return askNotes(text).then(d=>{if(d&&session===s)speak(d.answer,listen)});
     speak('Say A, B, C or D.',listen);
   }

   // practice: the AI asks from the notes and marks the spoken answer
   async function nextPractice(){
     const s=session;if(!s)return;
     if(s.limit&&s.answered>=s.limit)return finish();
     s.current=null;s.result=null;renderCard();
     const data=await post('/api/ai/voice/practice/question',{subject_id:s.subjectId,topic:s.topic,used:s.used,asked:s.asked},'Thinking of a question from your notes…');
     if(!data||session!==s)return;
     s.current=data;s.used.push(data.chunk);s.asked.push(data.question);
     renderCard();add('tutor',data.question,{sources:[data.source],asked_by:data.asked_by});speak(data.question,listen);
   }
   async function gradePractice(text,skipped=false){
     const s=session,q=s?.current;if(!q)return;
     s.current=null;renderCard();
     const data=await post('/api/ai/voice/practice/grade',{question:q,answer:skipped?'':text},'Marking your answer…');
     if(!data||session!==s){if(session===s&&!data){s.current=q;renderCard()}return}
     s.answered++;s[data.verdict]++;s.result={...data,question:q.question};renderCard();
     const msg=data.verdict==='correct'?'Correct!':(data.verdict==='partial'?'Partly right. ':(skipped?'':'Not quite. '))+data.feedback;
     add('tutor',msg,{graded_by:data.graded_by});speak(msg,nextPractice);
   }
   function skipPractice(){if(session?.current)gradePractice('',true)}
   function hint(){
     const q=session?.current;if(!q)return;
     const point=q.key_points?.[0];speak(point?`Hint: think about ${point.charAt(0).toLowerCase()+point.slice(1)}.`:'No hint for this one, sorry.',listen);
   }
   function handlePractice(said,text){
     const s=session;
     if(!s.current){if(/^(next|skip)/.test(said)&&s.result)return nextPractice();return speak('One moment, the next question is on its way.')}
     if(/^(hint|give me a hint|clue)$/.test(said))return hint();
     if(/^(skip|next|pass|skip (it|this)|i (dont|do not) know|no idea|not sure)$/.test(said))return skipPractice();
     gradePractice(text);
   }

   // ask: answers only from the chosen notes
   async function askNotes(question,quizContext,silent){
     const s=session;if(!s)return null;
     const data=await post('/api/ai/voice/ask',{question,subject_id:s.subjectId,topic:quizContext?.topic||s.topic,history:history.slice(-6),quiz:quizContext||null},'Checking your notes…');
     if(!data||session!==s)return null;
     history.push({role:'user',content:question},{role:'assistant',content:data.answer});history=history.slice(-12);
     add('tutor',data.answer,data);
     if(!silent&&!quizContext)speak((data.verified===false?'I could not fully confirm this from your notes. ':'')+data.answer+(data.code?' The example is on screen.':''));
     return data;
   }

   async function handle(text){
     if(!session)return;
     add('you',text);
     const said=words(text).join(' ');
     if(/^(stop|cancel|be quiet|quiet|shut up|never mind)$/.test(said))return stopAll();
     if(/\b(end|stop|finish|quit|exit) (the )?(session|quiz|practice)\b|^(im done|thats all|goodbye|bye)$/.test(said))return finish();
     if(/^(repeat|say (that|it) again|again|pardon|sorry what)$/.test(said))return repeat();
     if(session.mode==='quiz')return handleQuiz(said,text);
     if(session.mode==='practice')return handlePractice(said,text);
     return askNotes(text);
   }

   // ---- wiring ----
   orb.onclick=()=>{if(state==='listening'){recognizer?.stop();return}if(state==='speaking'){hush();setState('idle');listen();return}if(state==='thinking')return;listen()};
   $('[data-type]').onsubmit=ev=>{ev.preventDefault();const input=$('[data-text]'),text=input.value.trim();if(!text||state==='thinking')return;input.value='';hush();setState('idle',idleText());handle(text)};
   $('[data-begin]').onclick=begin;
   $('[data-end]').onclick=finish;
   subjectSelect.onchange=()=>{prefs.subject=subjectSelect.value;prefs.topic='';topicSelect.value='';savePrefs();renderSetup()};
   topicSelect.onchange=()=>{prefs.topic=topicSelect.value;savePrefs();renderSetup()};
   $('[data-count]').onchange=ev=>{prefs.count=ev.target.value;savePrefs()};
   $('[data-voice]').onchange=ev=>{prefs.voice=ev.target.value;savePrefs()};
   $('[data-rate]').onchange=ev=>{prefs.rate=ev.target.value;savePrefs()};
   $('[data-handsfree]').onchange=ev=>{prefs.handsFree=ev.target.checked;savePrefs()};
   if(global.speechSynthesis)speechSynthesis.addEventListener?.('voiceschanged',fillVoices);
   setState('idle',idleText());

   return {onShow(){if(!session)renderSetup()},stop:stopAll};
 }
 global.StudentVoiceTutor={create,parseAnswer};
})(window);
