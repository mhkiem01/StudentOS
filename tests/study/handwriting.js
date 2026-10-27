const assert=require('node:assert/strict');require('../../frontend/study/handwriting.js');
const ink=global.StudentInk;
// Stored form: compact, exact to a quarter pixel, and accepted by the server's checks (backend/study/note_document.py).
const page={template:'lined',paper:'cream',strokes:[
  {tool:'p',color:'#1D1D1F',size:2.4,points:[[100,120,.5],[110.3,118.9,.62],[125.1,121.4,.8]]},
  {tool:'h',color:'#ffe14d',size:18,points:[[60,200,.5],[300,200,.5]]},
  {tool:'s',color:'#e5484d',size:2.5,points:[[10,10,.5],[200,10,.5],[200,90,.5],[10,10,.5]]}]};
const text=ink.encode(page);
assert.equal(ink.encode({template:'blank',paper:'white',strokes:[]}),'v1 blank white');
const [head,...strokes]=text.split('|');
assert.match(head,/^v1 (?:blank|lined|narrow|grid|dotted|cornell|music) (?:white|cream|yellow|dark)$/);
for(const s of strokes)assert.match(s,/^[pnmhs] [0-9a-f]{6} \d{1,3}(?: -?\d{1,5},-?\d{1,5}(?:,-?\d{1,3})?)+$/);
assert.equal(strokes[0].split(' ')[3],'400,480,50','first point absolute, in quarter pixels, with pressure');
const back=ink.decode(text);
assert.equal(back.template,'lined');assert.equal(back.paper,'cream');assert.equal(back.strokes.length,3);
back.strokes.forEach((s,i)=>{const o=page.strokes[i];assert.equal(s.tool,o.tool);assert.equal(s.color,o.color.toLowerCase());assert.equal(s.size,o.size);
  s.points.forEach((p,k)=>{assert(Math.abs(p[0]-o.points[k][0])<=.125&&Math.abs(p[1]-o.points[k][1])<=.125,'position kept to a quarter pixel');assert(Math.abs(p[2]-o.points[k][2])<=.005)})});
assert.equal(ink.encode(back),text,'decoding and encoding again changes nothing');
for(const bad of ['v2 lined white','v1 plaid white','v1 lined white extra','v1 lined white|p 1d1d1f 24','v1 lined white|p red 24 1,2,3','v1 lined white|p 1d1d1f 24 1,2','v1 lined white|m 1d1d1f 24 1.5,2','v1 lined white|q 1d1d1f 24 1,2','v1 lined white|p 1d1d1f 24 1,2,3<b>'])
  assert.throws(()=>ink.decode(bad),/damaged/,bad);
// The picture: paper, ruling, highlighter under the writing, a filled pressure outline for the pen, nothing else.
const svg=ink.svg(back);
assert(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 592 740"'));assert(svg.includes('<rect width="592" height="740" fill="#fbf5e6"/>'));
assert(svg.indexOf('stroke="#ffe14d"')<svg.indexOf('fill="#1d1d1f"'),'highlighter is drawn first, under the pen');
assert(/<path d="M[^"]+Z" fill="#1d1d1f"\/>/.test(svg),'the pen is a closed, filled outline');assert(svg.includes('opacity="0.42"'));
assert(/stroke="#e5484d"[^>]*stroke-linejoin="round"/.test(svg));assert(!/<script|on\w+=|javascript:/i.test(svg));
for(const [template,lines] of [['blank',0],['lined',2],['grid',1],['dotted',1],['cornell',2],['music',1]])
  assert.equal((ink.svg({template,paper:'white',strokes:[]}).match(/<path /g)||[]).length,lines,template);
assert(ink.svg({template:'lined',paper:'dark',strokes:[]}).includes('fill="#1f2330"'));
assert(ink.thumbnail('grid','yellow').startsWith('data:image/svg+xml;charset=utf-8,%3Csvg'));
console.log('PASS handwriting pages: compact stored form, exact round trip, damaged pages rejected, SVG paper, ruling and layering');
