/* Subject notes reuse the portal's existing subjects/topics, editors and AI. */
(function(global){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const pinIcon='<svg class="note-pin-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m16 3 5 5-4 1-3 5 1 3-3-1-7 7 4-9-1-3 5-3z"/></svg>';
 const uid=()=>global.crypto?.randomUUID?.()||'note_'+Date.now()+Math.random().toString(36).slice(2);
 function inline(text){
   const codes=[];let s=String(text).replace(/\u0000/g,'').replace(/`([^`]+)`/g,(_,c)=>'\u0000'+(codes.push('<code>'+esc(c)+'</code>')-1)+'\u0000');
   s=esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/==(.+?)==/g,'<mark>$1</mark>').replace(/\+\+(.+?)\+\+/g,'<u>$1</u>');
   return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>codes[+i]||'');
 }
 function markdown(source){
   const lines=String(source||'').replace(/\r\n?/g,'\n').split('\n'),out=[];let i=0;
   while(i<lines.length){const l=lines[i];
     if(!l.trim()){i++;continue}
     if(/^```/.test(l)){const code=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');continue}
     if(/^#{1,6}\s/.test(l)){const m=l.match(/^(#{1,6})\s+(.*)$/),level=Math.min(6,m[1].length+1);out.push(`<h${level}>${inline(m[2])}</h${level}>`);i++;continue}
     if(/^\s*---+\s*$/.test(l)){out.push('<hr>');i++;continue}
     if(/^>/.test(l)){const quote=[];while(i<lines.length&&/^>/.test(lines[i]))quote.push(lines[i++].replace(/^>\s?/,''));const m=quote[0]?.match(/^\[!(TAKEAWAY|IMPORTANT|EXAMPLE|REMEMBER|TIP)\]\s*(.*)$/i);if(m){quote[0]=m[2];if(!quote[0])quote.shift();const labels={TAKEAWAY:'💡 Key takeaway',IMPORTANT:'⚠ Important',EXAMPLE:'✎ Example',REMEMBER:'✓ Remember',TIP:'? Exam tip'};out.push(`<aside class="note-callout"><b>${labels[m[1].toUpperCase()]}</b><p>${quote.map(inline).join('<br>')}</p></aside>`)}else out.push('<blockquote>'+quote.map(inline).join('<br>')+'</blockquote>');continue}
     if(/^\s*([-*]|\d+\.)\s+/.test(l)){const ordered=/^\s*\d+\./.test(l),items=[];while(i<lines.length&&(ordered?/^\s*\d+\.\s+/:/^\s*[-*]\s+/).test(lines[i])){const item=lines[i++].replace(/^\s*([-*]|\d+\.)\s+/,''),task=item.match(/^\[([ xX])\]\s*(.*)$/);items.push('<li'+(task?' class="note-task"':'')+'>'+(task?`<input type="checkbox" disabled ${task[1].trim()?'checked':''} aria-label="Task status"> ${inline(task[2])}`:inline(item))+'</li>')}out.push(`<${ordered?'ol':'ul'}>${items.join('')}</${ordered?'ol':'ul'}>`);continue}
     const paragraph=[l];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,6}\s|>|```|\s*([-*]|\d+\.)\s+|---)/.test(lines[i]))paragraph.push(lines[i++]);out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');
   }return out.join('');
 }
 // The document workspace lives in note-editor.js; keep Markdown for legacy notes.
 global.StudentNotes={create:o=>global.StudentNotebook.createNotes(o),markdown};
})(typeof window==='undefined'?globalThis:window);
