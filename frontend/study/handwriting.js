/* Handwriting pages for notes, in the spirit of CollaNote: write with a pen, pencil, marker or highlighter in any colour
   and size, erase whole strokes or only the part you rub, lasso strokes to move, copy, recolour or delete them, draw
   lines, arrows, boxes and circles, and rule straight lines against a ruler you can move and turn, on blank, lined,
   grid, dotted, Cornell or music paper. A page is vector strokes kept as compact text (see encode) in a file of its own;
   notes show it as an SVG picture, so it stays sharp in page view, Book View and PDFs. */
(function(g){
 'use strict';
 const W=592,H=740,Q=4,MAX_STROKES=6000,HIGHLIGHT=.42;   // page size in px (a note page's text area); points in quarter px
 const TEMPLATES=[['blank','Blank'],['lined','Lined'],['narrow','Narrow lined'],['grid','Grid'],['dotted','Dotted'],['cornell','Cornell'],['music','Music']];
 const PAPERS=[['white','White','#ffffff'],['cream','Cream','#fbf5e6'],['yellow','Yellow','#fff6c4'],['dark','Dark','#1f2330']];
 // Drawing tools. lo/hi: how thin and how thick pressure makes a pressure-sensitive line, as a share of its size.
 const TOOLS={p:{name:'Pen',pressure:true,lo:.3,hi:1,min:.5,max:12,size:2.4,color:'#1d1d1f'},n:{name:'Pencil',pressure:true,lo:.6,hi:1,min:.5,max:10,size:2,color:'#43464f'},
   m:{name:'Marker',min:2,max:24,size:6,color:'#1f6feb'},h:{name:'Highlighter',min:6,max:40,size:18,color:'#ffe14d'},s:{name:'Shapes',min:.5,max:12,size:2.4,color:'#1d1d1f'}};
 const INKS=[['#1d1d1f','Black'],['#6b6f7b','Grey'],['#1f6feb','Blue'],['#e5484d','Red'],['#2e9e5b','Green'],['#7445f5','Purple'],['#f08c00','Orange'],['#ffffff','White']];
 const HIGHLIGHTS=[['#ffe14d','Yellow'],['#9ef28c','Green'],['#ff9bd2','Pink'],['#7fd3ff','Blue'],['#ffb35c','Orange'],['#c8a6ff','Purple']];
 const SHAPES=[['line','Line'],['arrow','Arrow'],['rect','Box'],['ellipse','Circle']];
 const num=v=>Math.round(v*100)/100,clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),hex=c=>/^#[0-9a-f]{6}$/i.test(c||'');
 const paperColor=k=>(PAPERS.find(p=>p[0]===k)||PAPERS[0])[2],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 // Stored form: "v1 <template> <paper>", then "|<tool> <colour> <size x10> <points>" for each stroke. The first point is
 // "x,y" (plus ",pressure" 0-100 for pen and pencil) in quarter pixels; every later point is the change from the one
 // before, which keeps a full page small.
 function encode(page){
   return [`v1 ${page.template} ${page.paper}`,...page.strokes.map(s=>{
     const out=[s.tool,s.color.slice(1).toLowerCase(),Math.round(s.size*10)],withP=!!TOOLS[s.tool].pressure;let px=0,py=0,pp=0;
     s.points.forEach(([x,y,p],i)=>{
       const qx=Math.round(x*Q),qy=Math.round(y*Q),qp=Math.round((p??.5)*100);
       out.push((i?[qx-px,qy-py]:[qx,qy]).concat(withP?[i?qp-pp:qp]:[]).join(','));px=qx;py=qy;pp=qp;
     });
     return out.join(' ');
   })].join('|');
 }
 function decode(text){
   const fail=()=>{throw Error('This handwriting page is damaged and could not be opened.')};
   const [head,...parts]=String(text||'').split('|'),[v,template,paper,extra]=head.split(' ');
   if(v!=='v1'||extra!==undefined||!TEMPLATES.some(t=>t[0]===template)||!PAPERS.some(p=>p[0]===paper)||parts.length>MAX_STROKES)fail();
   return {template,paper,strokes:parts.map(part=>{
     const [tool,color,size,...pts]=part.split(' '),t=TOOLS[tool];
     if(!t||!/^[0-9a-f]{6}$/.test(color||'')||!/^\d{1,3}$/.test(size||'')||!pts.length)fail();
     let x=0,y=0,p=50;
     return {tool,color:'#'+color,size:+size/10,points:pts.map((token,i)=>{
       const n=token.split(',').map(Number);if(n.length!==(t.pressure?3:2)||n.some(k=>!Number.isInteger(k)))fail();
       x=i?x+n[0]:n[0];y=i?y+n[1]:n[1];if(t.pressure)p=i?p+n[2]:n[2];
       return [x/Q,y/Q,t.pressure?clamp(p/100,0,1):.5];
     })};
   })};
 }

 // Smooth curve from the first point (the current position) through the rest: quadratic segments between midpoints.
 function curve(pts){
   let d='';for(let i=1;i<pts.length-1;i++)d+=`Q${num(pts[i][0])} ${num(pts[i][1])} ${num((pts[i][0]+pts[i+1][0])/2)} ${num((pts[i][1]+pts[i+1][1])/2)}`;
   const l=pts[pts.length-1];return d+`L${num(l[0])} ${num(l[1])}`;
 }
 const drawn=new WeakMap();   // stroke -> how it is drawn (strokes never change once finished)
 // A pen or pencil stroke is a filled outline that is wider where it was pressed harder; other tools are even lines.
 function geometry(s){
   let geo=drawn.get(s);if(geo)return geo;
   const pts=s.points,t=TOOLS[s.tool],at=q=>`${num(q[0])} ${num(q[1])}`;
   if(!t.pressure)geo={width:s.size,d:'M'+at(pts[0])+(pts.length<2?'l.01 0':s.tool==='s'?pts.slice(1).map(q=>'L'+at(q)).join(''):curve(pts))};
   else{
     const press=pts.map(q=>q[2]),even=press.map((v,i)=>(press[Math.max(0,i-1)]+2*v+press[Math.min(press.length-1,i+1)])/4),r=i=>s.size*(t.lo+(t.hi-t.lo)*even[i])/2;
     if(pts.length<2){const [x,y]=pts[0],rr=num(r(0));geo={fill:true,d:`M${num(x-rr)} ${num(y)}a${rr} ${rr} 0 1 0 ${num(2*rr)} 0a${rr} ${rr} 0 1 0 ${num(-2*rr)} 0Z`}}
     else{
       const left=[],right=[],dirs=[];let dir=[1,0];
       pts.forEach((q,i)=>{
         const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len>1e-6)dir=[dx/len,dy/len];
         const rr=r(i);dirs.push(dir);left.push([q[0]-dir[1]*rr,q[1]+dir[0]*rr]);right.push([q[0]+dir[1]*rr,q[1]-dir[0]*rr]);
       });
       // Round ends: half circles of points around the last point (left side to right side) and the first (right to left).
       const around=(c,d,rr,sign)=>Array.from({length:5},(_,k)=>{const a=Math.PI*(k+1)/6,cs=sign*Math.cos(a),sn=sign*Math.sin(a);return [c[0]-d[1]*rr*cs+d[0]*rr*sn,c[1]+d[0]*rr*cs+d[1]*rr*sn]});
       const end=pts.length-1,ring=[...left,...around(pts[end],dirs[end],r(end),1),...right.reverse(),...around(pts[0],dirs[0],r(0),-1)];
       geo={fill:true,d:'M'+at(ring[0])+curve(ring)+'Z'};
     }
   }
   let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y] of pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
   geo.box=[x0,y0,x1,y1];drawn.set(s,geo);return geo;
 }
 // Highlighter strokes lie under everything else, as on paper.
 const layered=strokes=>[...strokes.keys()].sort((a,b)=>(strokes[b].tool==='h')-(strokes[a].tool==='h'));

 // Paper ruling in the colours of the paper.
 function rules(page){
   const dark=page.paper==='dark',line=dark?'#3a4257':'#c5d2e6',margin=dark?'#7d3d4a':'#f0a4a4',out=[];
   const rows=(gap,top,from=0,bottom=H-12)=>{let d='';for(let y=top;y<=bottom;y+=gap)d+=`M${from} ${y}H${W}`;return d};
   switch(page.template){
     case 'lined':out.push({d:rows(29,62),color:line,width:1},{d:`M58 0V${H}`,color:margin,width:1});break;
     case 'narrow':out.push({d:rows(22,48),color:line,width:.9},{d:`M48 0V${H}`,color:margin,width:1});break;
     case 'grid':{let d='';for(let x=(W%24)/2;x<=W;x+=24)d+=`M${x} 0V${H}`;for(let y=(H%24)/2;y<=H;y+=24)d+=`M0 ${y}H${W}`;out.push({d,color:line,width:.7});break}
     case 'dotted':{let d='';for(let x=(W%24)/2;x<=W;x+=24)for(let y=(H%24)/2;y<=H;y+=24)d+=`M${x} ${y}h0`;out.push({d,color:dark?'#59627b':'#a3b0c8',width:2.2});break}
     case 'cornell':out.push({d:rows(29,91,164,580),color:line,width:1},{d:`M0 62H${W}M164 62V594M0 594H${W}`,color:dark?'#8b94ae':'#8494b6',width:1.4});break;
     case 'music':{let d='';for(let top=56;top+36<=H-20;top+=86)for(let i=0;i<5;i++)d+=`M28 ${top+i*9}H${W-28}`;out.push({d,color:dark?'#5d6782':'#8d99b4',width:1});break}
   }
   return out;
 }
 // Pencil lines are filled with a grainy tile of their colour: the same tile in the editor and in the saved picture.
 const tiles=new Map();
 function tile(color){
   if(!tiles.has(color)){
     const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),img=x.createImageData(32,32),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
     let seed=97;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
     for(let i=0;i<img.data.length;i+=4){img.data.set(rgb,i);img.data[i+3]=Math.round(255*(rnd()<.22?.15+.35*rnd():.72+.28*rnd()))}
     x.putImageData(img,0,0);tiles.set(color,{canvas:c,url:c.toDataURL(),pattern:null});
   }
   return tiles.get(color);
 }
 // The page as an SVG picture (bold ruling makes the small template previews readable).
 function svg(page,bold=1){
   const grain=typeof document!=='undefined',pencils=grain?[...new Set(page.strokes.filter(s=>s.tool==='n').map(s=>s.color))]:[];
   const defs=pencils.map(c=>`<pattern id="grain${c.slice(1)}" width="32" height="32" patternUnits="userSpaceOnUse"><image href="${tile(c).url}" width="32" height="32"/></pattern>`).join('');
   const body=layered(page.strokes).map(i=>{
     const s=page.strokes[i],geo=geometry(s),see=s.tool==='h'?` opacity="${HIGHLIGHT}"`:'';
     return geo.fill?`<path d="${geo.d}" fill="${s.tool==='n'&&grain?`url(#grain${s.color.slice(1)})`:s.color}"${see}/>`:`<path d="${geo.d}" fill="none" stroke="${s.color}" stroke-width="${num(geo.width)}" stroke-linecap="round" stroke-linejoin="round"${see}/>`;
   }).join('');
   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs?`<defs>${defs}</defs>`:''}<rect width="${W}" height="${H}" fill="${paperColor(page.paper)}"/>${rules(page).map(r=>`<path d="${r.d}" fill="none" stroke="${r.color}" stroke-width="${num(r.width*bold)}" stroke-linecap="round"/>`).join('')}${body}</svg>`;
 }
 function paint(x,s,dx=0,dy=0){
   const geo=geometry(s);geo.path??=new Path2D(geo.d);
   x.save();if(dx||dy)x.translate(dx,dy);x.globalAlpha=s.tool==='h'?HIGHLIGHT:1;
   if(geo.fill){if(s.tool==='n'){const t=tile(s.color);x.fillStyle=t.pattern??=x.createPattern(t.canvas,'repeat')}else x.fillStyle=s.color;x.fill(geo.path)}
   else{x.strokeStyle=s.color;x.lineWidth=geo.width;x.lineCap=x.lineJoin='round';x.stroke(geo.path)}
   x.restore();
 }
 function paintPaper(x,page){
   x.clearRect(0,0,W,H);x.fillStyle=paperColor(page.paper);x.fillRect(0,0,W,H);x.lineCap='round';
   for(const r of rules(page)){x.strokeStyle=r.color;x.lineWidth=r.width;x.stroke(new Path2D(r.d))}
 }

 // Showing pages in notes: a <figure data-ink="id"> holds a page; its picture is added here and never saved in the note.
 const loaded=new Map();
 function load(id,fetcher){
   if(!loaded.has(id))loaded.set(id,Promise.resolve().then(()=>fetcher(id)).then(text=>{const page=decode(text),markup=svg(page);return {text,page,svg:markup,url:URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'}))}}));
   return loaded.get(id);
 }
 // Resolves with how many pages were newly shown.
 function hydrate(root,fetcher){
   return Promise.all([...root.querySelectorAll('figure[data-ink]')].map(async f=>{
     const id=f.dataset.ink;if(f.dataset.inkShown===id)return false;f.dataset.inkShown=id;f.contentEditable='false';
     try{const page=await load(id,fetcher);if(f.dataset.ink===id)f.innerHTML=`<img src="${page.url}" alt="Handwriting page" draggable="false">`}
     catch(err){if(f.dataset.ink===id)f.innerHTML=`<span class="ink-missing">${esc(err.message||'This handwriting page could not be loaded.')}</span>`}
     return true;
   })).then(shown=>shown.filter(Boolean).length);
 }
 const thumbnail=(template,paper)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg({template,paper,strokes:[]},4));

 // Helpers for editing.
 function segDist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len,0,1):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
 // Fewer points, same line (Ramer-Douglas-Peucker); a change in pressure counts as a change in shape.
 function simplify(pts,eps,size=0){
   if(pts.length<3)return pts.slice();
   const keep=new Uint8Array(pts.length),stack=[[0,pts.length-1]];keep[0]=keep[pts.length-1]=1;
   while(stack.length){
     const [a,b]=stack.pop();let max=0,at=-1;
     for(let i=a+1;i<b;i++){const t=(i-a)/(b-a),d=Math.max(segDist(pts[i],pts[a],pts[b]),Math.abs(pts[i][2]-(pts[a][2]+(pts[b][2]-pts[a][2])*t))*size);if(d>max){max=d;at=i}}
     if(max>eps){keep[at]=1;stack.push([a,at],[at,b])}
   }
   return pts.filter((_,i)=>keep[i]);
 }
 const shift=(s,dx,dy)=>({...s,points:s.points.map(([x,y,p])=>[clamp(x+dx,0,W),clamp(y+dy,0,H),p])});
 function shapeStrokes(kind,a,b,style){
   const st={tool:'s',...style},p=(x,y)=>[clamp(x,0,W),clamp(y,0,H),.5];
   if(kind==='rect')return [{...st,points:[a,p(b[0],a[1]),b,p(a[0],b[1]),a]}];
   if(kind==='ellipse'){const cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,rx=Math.abs(b[0]-a[0])/2,ry=Math.abs(b[1]-a[1])/2;return [{...st,points:Array.from({length:73},(_,k)=>p(cx+rx*Math.cos(k*Math.PI/36),cy+ry*Math.sin(k*Math.PI/36)))}]}
   const line={...st,points:[a,b]};if(kind!=='arrow')return [line];
   const ang=Math.atan2(b[1]-a[1],b[0]-a[0]),len=Math.min(14+style.size*2.5,Math.hypot(b[0]-a[0],b[1]-a[1])*.45),wing=k=>p(b[0]-len*Math.cos(ang+k),b[1]-len*Math.sin(ang+k));
   return [line,{...st,points:[wing(.5),b,wing(-.5)]}];
 }

 const ICONS={p:'M4 20l2.5-.6L18.5 7.4a2.1 2.1 0 0 0-3-3L3.6 16.5zM14 6l3 3',n:'M4 20l1.5-5.5L16 4l4 4L9.5 18.5zM14 6l4 4M5.5 14.5l4 4',m:'M8 15l-3 5h6l1-3M9 15l9-9-4-4-9 9z',
   h:'M6 21h9M8 17l-2.5 4M10 15l10-10-4-4L6 11z',e:'M9 20h11M5.5 16.5l9-9.5 6 6L12 21H9z',l:'M12 4c5 0 8.5 2.3 8.5 5.3S17 14.5 12 14.5 3.5 12.3 3.5 9.3 7 4 12 4zM7.5 13.2c-1.8 2.5-.3 6.8 3.5 6.8',
   s:'M3.5 20.5h7v-7h-7zM17 3.5l4 7h-8zM17.5 14a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7',ruler:'M2.5 16.5 16.5 2.5l5 5-14 14zM7 12l2 2M10 9l2 2M13 6l2 2'};
 const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
 const KEY='notebook.ink.tools';
 function remembered(){
   const out={tool:'p',shape:'line',eraser:'stroke',finger:'auto',e:{size:20}};for(const [k,t] of Object.entries(TOOLS))out[k]={color:t.color,size:t.size};
   try{
     const s=JSON.parse(localStorage.getItem(KEY)||'{}');
     if(TOOLS[s.tool]||s.tool==='e'||s.tool==='l')out.tool=s.tool;if(SHAPES.some(x=>x[0]===s.shape))out.shape=s.shape;
     if(['stroke','precise'].includes(s.eraser))out.eraser=s.eraser;if(['auto','on','off'].includes(s.finger))out.finger=s.finger;
     for(const k of Object.keys(TOOLS)){if(hex(s[k]?.color))out[k].color=s[k].color.toLowerCase();if(+s[k]?.size>=TOOLS[k].min&&+s[k]?.size<=TOOLS[k].max)out[k].size=+s[k].size}
     if(+s.e?.size>=4&&+s.e?.size<=80)out.e.size=+s.e.size;
   }catch{}
   return out;
 }

 /* The writing screen. o: {host, page, title, save(page) -> Promise, confirm() -> Promise<boolean>, onClose()}. */
 function open(o){
   const settings=remembered(),page={template:o.page.template,paper:o.page.paper,strokes:o.page.strokes.slice()},past=[],undone=[],fingers=new Map();
   let tool=settings.tool,zoom=1,fitted=true,active=null,selected=null,cursor=null,penSeen=false,dirty=false,saving=false,closed=false,frame=0,later=0;
   const ruler={on:false,x:W/2,y:H*.4,angle:0},RL=270,RH=30;   // centre, turn (degrees), half length and half width
   const el=document.createElement('div');el.className='ink-editor';el.tabIndex=-1;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',o.title);
   const tools=[['p','Pen'],['n','Pencil'],['m','Marker'],['h','Highlighter'],['e','Eraser'],['l','Lasso'],['s','Shapes']];
   el.innerHTML=`<header class="ink-top"><button type="button" data-do="cancel">Cancel</button><strong>${esc(o.title)}</strong><span class="ink-status" role="status"></span><button type="button" data-do="undo" aria-label="Undo" title="Undo (Ctrl+Z)">↶</button><button type="button" data-do="redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">↷</button><button type="button" class="ink-primary" data-do="done">Done</button></header>
     <div class="ink-toolbar" role="toolbar" aria-label="Handwriting tools">
       <div class="ink-group">${tools.map(([k,l])=>`<button type="button" class="ink-tool" data-tool="${k}" aria-pressed="false" title="${l}">${icon(k)}<span>${l}</span></button>`).join('')}</div>
       <div class="ink-group ink-options" data-for="s">${SHAPES.map(([k,l])=>`<button type="button" data-shape="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
       <div class="ink-group ink-options" data-for="e"><button type="button" data-eraser="stroke" aria-pressed="false">Whole stroke</button><button type="button" data-eraser="precise" aria-pressed="false">Just what I rub</button></div>
       <div class="ink-group ink-colours" role="group" aria-label="Colour"></div>
       <label class="ink-size"><span>Size</span><input type="range" aria-label="Size"><output></output></label>
       <div class="ink-group"><button type="button" class="ink-tool" data-do="ruler" aria-pressed="false" title="Ruler">${icon('ruler')}<span>Ruler</span></button>
         <select data-page="template" aria-label="Paper template">${TEMPLATES.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select><select data-page="paper" aria-label="Paper colour">${PAPERS.map(([k,l])=>`<option value="${k}">${l} paper</option>`).join('')}</select></div>
       <div class="ink-group"><button type="button" data-do="zoom-out" aria-label="Zoom out">−</button><button type="button" data-do="fit" title="Fit the page to the screen">100%</button><button type="button" data-do="zoom-in" aria-label="Zoom in">+</button></div>
       <div class="ink-group"><button type="button" data-do="finger" aria-pressed="true" title="Write with your finger (turn off to scroll with fingers and write with a stylus)">☝ Finger writes</button><button type="button" data-do="clear">Clear page</button></div>
     </div>
     <div class="ink-desk"><div class="ink-sheet" role="img"><canvas></canvas><canvas></canvas><canvas></canvas><div class="ink-ruler" hidden><span class="ink-ruler-angle"></span><span class="ink-ruler-knob" title="Drag to turn the ruler"></span></div>
       <div class="ink-selectbar" hidden><button type="button" data-sel="duplicate">Duplicate</button><button type="button" data-sel="delete">Delete</button><span>Drag to move · tap a colour to recolour</span></div></div></div>
     <footer class="ink-hint"></footer>`;
   o.host.append(el);
   const q=s=>el.querySelector(s),desk=q('.ink-desk'),sheet=q('.ink-sheet'),[paper,ink,live]=[...sheet.querySelectorAll('canvas')].map(c=>({c,x:c.getContext('2d')}));
   const status=t=>{q('.ink-status').textContent=t};
   const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}};
   const fingerWrites=()=>settings.finger==='on'||settings.finger==='auto'&&!penSeen;
   const snap=()=>({strokes:page.strokes,template:page.template,paper:page.paper});
   function remember(){past.push(snap());if(past.length>300)past.shift();undone.length=0;dirty=true;buttons()}
   function step(dir){
     const from=dir<0?past:undone,to=dir<0?undone:past;if(!from.length||active)return;
     to.push(snap());Object.assign(page,from.pop());selected=null;dirty=true;
     q('[data-page=template]').value=page.template;q('[data-page=paper]').value=page.paper;drawPaper();drawInk();showSelection();buttons();
   }
   function buttons(){q('[data-do=undo]').disabled=!past.length;q('[data-do=redo]').disabled=!undone.length;sheet.setAttribute('aria-label',`Handwriting page, ${page.strokes.length} stroke${page.strokes.length===1?'':'s'}`)}

   // Drawing layers: paper, finished strokes, and the stroke, loop or eraser in progress.
   function size(){
     sheet.style.width=W*zoom+'px';sheet.style.height=H*zoom+'px';
     const scale=Math.min(zoom*(g.devicePixelRatio||1),Math.sqrt(8e6/(W*H)));   // keep each layer under 8 million pixels
     for(const l of [paper,ink,live]){l.c.width=Math.round(W*scale);l.c.height=Math.round(H*scale);l.x.setTransform(scale,0,0,scale,0,0)}
     drawPaper();drawInk();paintLive();placeRuler();showSelection();q('[data-do=fit]').textContent=Math.round(zoom*100)+'%';
   }
   const drawPaper=()=>paintPaper(paper.x,page);
   function drawInk(){
     const x=ink.x,moving=active?.kind==='move'&&selected?new Set(selected.idx):null;x.clearRect(0,0,W,H);
     for(const i of layered(page.strokes))paint(x,page.strokes[i],moving?.has(i)?active.dx:0,moving?.has(i)?active.dy:0);
     buttons();
   }
   function paintLive(){
     const x=live.x;x.clearRect(0,0,W,H);const outline=d=>{x.save();x.setLineDash([6,4]);x.strokeStyle='#7445f5';x.lineWidth=1.3;d();x.restore()};
     if(active?.kind==='draw')paint(x,{...active.stroke,points:active.stroke.points.slice()});   // a new object: in-progress drawing is not cached
     if(active?.kind==='shape')shapeStrokes(settings.shape,active.from,active.to,settings.s).forEach(s=>paint(x,s));
     if(active?.kind==='lasso')outline(()=>{x.beginPath();active.pts.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.stroke()});
     if(selected){const [x0,y0,x1,y1]=selected.box,dx=active?.kind==='move'?active.dx:0,dy=active?.kind==='move'?active.dy:0;outline(()=>x.strokeRect(x0+dx-6,y0+dy-6,x1-x0+12,y1-y0+12))}
     if(tool==='e'&&cursor){x.beginPath();x.arc(cursor[0],cursor[1],settings.e.size/2,0,Math.PI*2);x.strokeStyle='#7445f5';x.lineWidth=1.2;x.stroke()}
   }
   const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(active?.kind==='move')drawInk();paintLive()})};
   function zoomAt(z,cx,cy,fx=cx,fy=cy,quick=false){
     z=clamp(z,.3,4);fitted=false;if(cx==null){const r=desk.getBoundingClientRect();cx=fx=r.left+r.width/2;cy=fy=r.top+r.height/2}
     const r=sheet.getBoundingClientRect(),px=(fx-r.left)/zoom,py=(fy-r.top)/zoom;zoom=z;
     // While pinching, only the page's size changes; its layers are redrawn sharp once the fingers rest.
     if(quick){sheet.style.width=W*z+'px';sheet.style.height=H*z+'px';placeRuler();showSelection();clearTimeout(later);later=setTimeout(size,160)}else size();
     const r2=sheet.getBoundingClientRect();desk.scrollLeft+=r2.left+px*z-cx;desk.scrollTop+=r2.top+py*z-cy;
   }
   // The page fits the screen's width, or its height on wide screens (never wider than the screen).
   function fit(){const w=desk.clientWidth-32,h=desk.clientHeight-32;zoom=clamp(Math.min(w/W,Math.max(h/H,Math.min(1,w/W))),.3,4);fitted=true;size();desk.scrollTop=0}

   // Ruler: drawing along an edge gives a straight line. Drag it to move it, drag its dot to turn it (snaps to 15°).
   const frameOf=()=>{const a=ruler.angle*Math.PI/180;return {u:[Math.cos(a),Math.sin(a)],v:[-Math.sin(a),Math.cos(a)]}};
   const local=p=>{const {u,v}=frameOf(),dx=p[0]-ruler.x,dy=p[1]-ruler.y;return [dx*u[0]+dy*u[1],dx*v[0]+dy*v[1]]};
   function rulerPart(p){const [lx,ly]=local(p);if(Math.hypot(lx-(RL-24),ly)<18)return 'ruler-turn';return Math.abs(lx)<=RL&&Math.abs(ly)<=RH?'ruler-move':null}
   function rulerEdge(p,r){
     const [lx,ly]=local(p);if(Math.abs(lx)>RL+12||Math.abs(Math.abs(ly)-RH)>18)return null;
     const {u,v}=frameOf(),off=(ly<0?-1:1)*(RH+r);
     return q=>{const [qx]=local(q);return [clamp(ruler.x+u[0]*qx+v[0]*off,0,W),clamp(ruler.y+u[1]*qx+v[1]*off,0,H),q[2]]};
   }
   function placeRuler(){
     const r=q('.ink-ruler');r.hidden=!ruler.on;if(!ruler.on)return;
     r.style.cssText=`left:${(ruler.x-RL)*zoom}px;top:${(ruler.y-RH)*zoom}px;width:${2*RL*zoom}px;height:${2*RH*zoom}px;transform:rotate(${ruler.angle}deg);--tick:${10*zoom}px`;
     q('.ink-ruler-angle').textContent=Math.round(((ruler.angle%180)+180)%180)+'°';
   }

   // Erasing: whole strokes, or only the rubbed part of each stroke (the rest stays as separate strokes).
   const dense=new WeakMap();
   function densePoints(s){
     let d=dense.get(s);if(d)return d;d=[];
     s.points.forEach((q,i)=>{if(i){const pr=s.points[i-1],n=Math.ceil(Math.hypot(q[0]-pr[0],q[1]-pr[1])/2);for(let k=1;k<n;k++)d.push([pr[0]+(q[0]-pr[0])*k/n,pr[1]+(q[1]-pr[1])*k/n,pr[2]+(q[2]-pr[2])*k/n])}d.push(q)});
     dense.set(s,d);return d;
   }
   function erase(a,b){
     const r=settings.e.size/2,precise=settings.eraser==='precise',out=[],x0=Math.min(a[0],b[0])-r,x1=Math.max(a[0],b[0])+r,y0=Math.min(a[1],b[1])-r,y1=Math.max(a[1],b[1])+r;let hit=false;
     for(const s of page.strokes){
       const [bx0,by0,bx1,by1]=geometry(s).box,pad=s.size/2;
       if(bx1+pad<x0||bx0-pad>x1||by1+pad<y0||by0-pad>y1){out.push(s);continue}
       const pts=densePoints(s),gone=pts.map(q=>segDist(q,a,b)<=r+pad);
       if(!gone.includes(true)){out.push(s);continue}
       hit=true;if(!precise)continue;
       let run=[];const flush=()=>{if(run.length>1)out.push({...s,points:simplify(run,.25,s.size)});run=[]};
       pts.forEach((q,i)=>gone[i]?flush():run.push(q));flush();
     }
     if(hit){page.strokes=out;drawInk()}
   }
   // Lasso: strokes with at least half their points inside the loop are selected.
   function lasso(poly){
     if(poly.length<3)return;
     const inside=([x,y])=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c};
     const idx=page.strokes.flatMap((s,i)=>s.points.filter(inside).length*2>=s.points.length?[i]:[]);
     selected=idx.length?{idx,box:boxOf(idx)}:null;showSelection();status(idx.length?`${idx.length} stroke${idx.length===1?'':'s'} selected`:'Nothing was inside the loop');
   }
   function boxOf(idx){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const i of idx){const s=page.strokes[i],[a,b,c,d]=geometry(s).box,pad=s.size/2;x0=Math.min(x0,a-pad);y0=Math.min(y0,b-pad);x1=Math.max(x1,c+pad);y1=Math.max(y1,d+pad)}return [x0,y0,x1,y1]}
   function showSelection(){
     const bar=q('.ink-selectbar');bar.hidden=!selected;
     if(selected){bar.style.left=Math.max(0,selected.box[0]*zoom)+'px';bar.style.top=Math.max(0,selected.box[1]*zoom-52)+'px'}
     paintLive();
   }
   function selectionAction(kind){
     if(!selected)return;remember();const idx=new Set(selected.idx);
     if(kind==='delete'){page.strokes=page.strokes.filter((_,i)=>!idx.has(i));selected=null;status('Deleted')}
     if(kind==='duplicate'){const copies=selected.idx.map(i=>shift(page.strokes[i],18,18)),n=page.strokes.length;page.strokes=[...page.strokes,...copies];selected={idx:copies.map((_,k)=>n+k),box:null};selected.box=boxOf(selected.idx);status('Duplicated · drag the copy where you want it')}
     drawInk();showSelection();
   }

   // Pointer input. A stylus always writes; fingers write until a stylus is used (then they scroll and zoom), or as set.
   const point=e=>{const r=sheet.getBoundingClientRect();return [clamp((e.clientX-r.left)/zoom,0,W),clamp((e.clientY-r.top)/zoom,0,H),e.pointerType==='pen'&&e.pressure>0?e.pressure:.5]};
   function down(ev){
     if(saving||ev.button>0)return;
     if(ev.pointerType==='pen'&&!penSeen){penSeen=true;controls()}
     try{sheet.setPointerCapture(ev.pointerId)}catch{}ev.preventDefault();
     if(ev.pointerType==='touch'){fingers.set(ev.pointerId,[ev.clientX,ev.clientY]);if(fingers.size>1||!fingerWrites()){if(active?.finger){active=null;drawInk();paintLive()}return}}
     if(active)return;
     const p=point(ev),base={id:ev.pointerId,finger:ev.pointerType==='touch'};
     if(ruler.on&&ev.pointerType!=='pen'){const part=rulerPart(p);if(part){active={...base,kind:part,from:p,was:{...ruler}};return}}
     if(selected&&tool==='l'&&p[0]>=selected.box[0]-8&&p[0]<=selected.box[2]+8&&p[1]>=selected.box[1]-8&&p[1]<=selected.box[3]+8){active={...base,kind:'move',from:p,dx:0,dy:0};return}
     if(selected){selected=null;showSelection()}
     if(tool==='e'){active={...base,kind:'erase',last:p,before:snap()};cursor=p;erase(p,p)}
     else if(tool==='l')active={...base,kind:'lasso',pts:[p]};
     else if(tool==='s')active={...base,kind:'shape',from:p,to:p};
     else{const st=settings[tool],snapTo=ruler.on?rulerEdge(p,st.size/2):null;active={...base,kind:'draw',snapTo,origin:p,last:p,stroke:{tool,color:st.color,size:st.size,points:[snapTo?snapTo(p):p]}}}
     schedule();
   }
   function extend(a,p){
     const pts=a.stroke.points;a.last=p;
     if(a.snapTo){pts.length=1;pts.push(a.snapTo(p));return}
     // Light smoothing takes the shake out of handwriting without making it lag far behind the pen.
     const l=pts[pts.length-1],next=[l[0]+(p[0]-l[0])*.55,l[1]+(p[1]-l[1])*.55,l[2]+(p[2]-l[2])*.6];
     if(Math.hypot(next[0]-l[0],next[1]-l[1])>=.35)pts.push(next);
   }
   function move(ev){
     if(ev.pointerType==='touch'&&fingers.has(ev.pointerId)){
       const before=fingers.get(ev.pointerId);fingers.set(ev.pointerId,[ev.clientX,ev.clientY]);
       if(active&&!active.finger)return;   // a hand resting on the screen while a stylus or mouse writes
       if(!active||fingers.size>1){gesture(ev.pointerId,before);return}
     }
     if(!active){if(tool==='e'&&ev.pointerType!=='touch'){cursor=point(ev);schedule()}return}
     if(ev.pointerId!==active.id)return;
     for(const e of ev.getCoalescedEvents?.().length?ev.getCoalescedEvents():[ev]){
       const p=point(e);
       switch(active.kind){
         case 'draw':extend(active,p);break;
         case 'shape':active.to=p;break;
         case 'erase':erase(active.last,p);active.last=cursor=p;break;
         case 'lasso':active.pts.push(p);break;
         case 'move':active.dx=p[0]-active.from[0];active.dy=p[1]-active.from[1];break;
         case 'ruler-move':ruler.x=clamp(active.was.x+p[0]-active.from[0],0,W);ruler.y=clamp(active.was.y+p[1]-active.from[1],0,H);placeRuler();break;
         case 'ruler-turn':{let a=Math.atan2(p[1]-ruler.y,p[0]-ruler.x)*180/Math.PI;const near=Math.round(a/15)*15;if(Math.abs(a-near)<3)a=near;ruler.angle=a;placeRuler();break}
       }
     }
     schedule();
   }
   // Fingers that are not writing: one scrolls the page, two pinch to zoom.
   function gesture(id,before){
     const all=[...fingers.entries()];
     if(all.length===1){const now=fingers.get(id);desk.scrollLeft+=before[0]-now[0];desk.scrollTop+=before[1]-now[1];return}
     const [a,b]=all.slice(0,2).map(([k,v])=>[v,k===id?before:v]),d0=Math.hypot(a[1][0]-b[1][0],a[1][1]-b[1][1]),d1=Math.hypot(a[0][0]-b[0][0],a[0][1]-b[0][1]);
     if(d0>0)zoomAt(zoom*d1/d0,(a[0][0]+b[0][0])/2,(a[0][1]+b[0][1])/2,(a[1][0]+b[1][0])/2,(a[1][1]+b[1][1])/2,true);
   }
   function up(ev){
     if(ev.pointerType==='touch')fingers.delete(ev.pointerId);
     if(!active||ev.pointerId!==active.id)return;
     const a=active;active=null;
     if(ev.type==='pointercancel'&&a.kind==='draw'){paintLive();return}
     if(a.kind==='draw'){
       const s=a.stroke;if(!a.snapTo&&a.last!==s.points[s.points.length-1])s.points.push(a.last);
       commit([{tool:s.tool,color:s.color,size:s.size,points:a.snapTo?s.points:simplify(s.points,.3,s.size)}]);
     }
     if(a.kind==='shape'&&Math.hypot(a.to[0]-a.from[0],a.to[1]-a.from[1])>2)commit(shapeStrokes(settings.shape,a.from,a.to,settings.s));
     if(a.kind==='erase'&&page.strokes!==a.before.strokes){past.push(a.before);undone.length=0;dirty=true;buttons()}   // one undo step per rub
     if(a.kind==='lasso')lasso(a.pts);
     if(a.kind==='move'){
       if(a.dx||a.dy){const idx=new Set(selected.idx);remember();page.strokes=page.strokes.map((s,i)=>idx.has(i)?shift(s,a.dx,a.dy):s);selected.box=boxOf(selected.idx)}
       drawInk();showSelection();
     }
     paintLive();
   }
   function commit(strokes){
     remember();page.strokes=[...page.strokes,...strokes];
     if(strokes.some(s=>s.tool==='h'))drawInk();else strokes.forEach(s=>paint(ink.x,s));
     buttons();
   }
   sheet.addEventListener('pointerdown',down);sheet.addEventListener('pointermove',move);sheet.addEventListener('pointerup',up);sheet.addEventListener('pointercancel',up);
   sheet.addEventListener('pointerleave',()=>{if(cursor&&!active){cursor=null;schedule()}});
   desk.addEventListener('wheel',ev=>{if(!ev.ctrlKey&&!ev.metaKey)return;ev.preventDefault();zoomAt(zoom*Math.exp(-ev.deltaY*.0015),ev.clientX,ev.clientY,ev.clientX,ev.clientY,true)},{passive:false});

   // Toolbar.
   const HINTS={p:'Pen: lines get thicker as you press harder with a stylus.',n:'Pencil: a soft, grainy line.',m:'Marker: a bold line of even width.',h:'Highlighter: see-through colour that stays under your writing.',
     l:'Lasso: draw a loop around strokes, then drag them, duplicate or delete them, or tap a colour to recolour them.'};
   function controls(){
     el.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
     el.querySelectorAll('.ink-options').forEach(g=>g.hidden=g.dataset.for!==tool);
     el.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shape===settings.shape)));
     el.querySelectorAll('[data-eraser]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eraser===settings.eraser)));
     q('[data-do=ruler]').setAttribute('aria-pressed',String(ruler.on));q('[data-do=finger]').setAttribute('aria-pressed',String(fingerWrites()));
     const swatches=q('.ink-colours'),own=tool==='l'?'p':tool,list=tool==='h'?HIGHLIGHTS:INKS,current=settings[own]?.color;swatches.hidden=tool==='e';
     swatches.innerHTML=list.map(([c,name])=>`<button type="button" class="ink-swatch" data-color="${c}" style="--swatch:${c}" aria-label="${name}" title="${name}" aria-pressed="${c===current}"></button>`).join('')+`<label class="ink-swatch ink-custom" title="Any colour"><input type="color" value="${current||'#1d1d1f'}" aria-label="Any colour"></label>`;
     swatches.querySelector('input').onchange=ev=>colour(ev.target.value);
     const box=q('.ink-size'),range=box.querySelector('input'),sized=tool==='e'?settings.e:settings[own],[min,max]=tool==='e'?[4,80]:[TOOLS[own].min,TOOLS[own].max];box.hidden=tool==='l';
     range.min=min;range.max=max;range.step=max>20?1:.5;range.value=sized.size;box.querySelector('output').textContent=sized.size;
     const hint=tool==='e'?(settings.eraser==='precise'?'Eraser: rubs out only the part you touch.':'Eraser: touch a stroke to remove all of it.'):tool==='s'?`Shapes: drag to draw a ${SHAPES.find(s=>s[0]===settings.shape)[1].toLowerCase()}.`:HINTS[tool];
     q('.ink-hint').textContent=hint+(ruler.on?' Ruler: draw along an edge for a straight line; drag the ruler to move it, drag its dot to turn it.':'')+(penSeen&&!fingerWrites()?' Your stylus writes; fingers scroll and pinch to zoom.':'');
     q('[data-page=template]').value=page.template;q('[data-page=paper]').value=page.paper;
   }
   function colour(c){
     c=c.toLowerCase();if(!hex(c))return;
     if(tool==='l'&&selected){const idx=new Set(selected.idx);remember();page.strokes=page.strokes.map((s,i)=>idx.has(i)?{...s,color:c}:s);drawInk();status('Recoloured');return}
     settings[tool==='l'?'p':tool].color=c;store();controls();
   }
   const actions={cancel,done,undo:()=>step(-1),redo:()=>step(1),fit,'zoom-in':()=>zoomAt(zoom*1.25),'zoom-out':()=>zoomAt(zoom/1.25),
     ruler:()=>{ruler.on=!ruler.on;if(ruler.on){ruler.x=W/2;ruler.y=H*.4}placeRuler();controls()},
     finger:()=>{settings.finger=fingerWrites()?'off':'on';store();controls()},
     clear:()=>{if(!page.strokes.length)return;remember();page.strokes=[];selected=null;drawInk();showSelection();status('Page cleared · Undo brings it back')}};
   el.addEventListener('click',ev=>{
     const b=ev.target.closest('button');if(!b||!el.contains(b)||saving&&b.dataset.do!=='cancel')return;
     if(b.dataset.tool){tool=settings.tool=b.dataset.tool;if(tool!=='l'){selected=null;showSelection()}cursor=null;store();controls();paintLive()}
     else if(b.dataset.shape){settings.shape=b.dataset.shape;store();controls()}
     else if(b.dataset.eraser){settings.eraser=b.dataset.eraser;store();controls()}
     else if(b.dataset.color)colour(b.dataset.color);
     else if(b.dataset.sel)selectionAction(b.dataset.sel);
     else actions[b.dataset.do]?.();
   });
   q('.ink-size input').oninput=ev=>{const v=+ev.target.value;(tool==='e'?settings.e:settings[tool]).size=v;q('.ink-size output').textContent=v;store();if(tool==='e')paintLive()};
   el.querySelectorAll('[data-page]').forEach(s=>s.onchange=()=>{remember();page[s.dataset.page]=s.value;drawPaper()});

   async function done(){
     if(saving)return;saving=true;el.classList.add('ink-saving');status('Saving your page…');
     try{await o.save({template:page.template,paper:page.paper,strokes:page.strokes});close()}
     catch(err){saving=false;el.classList.remove('ink-saving');status(err.message||'The page could not be saved. Try again.')}
   }
   async function cancel(){if(saving)return;if(dirty&&!await o.confirm())return;close()}
   function close(){if(closed)return;closed=true;cancelAnimationFrame(frame);clearTimeout(later);resized.disconnect();el.remove();o.onClose?.()}
   function key(ev){
     if(closed)return false;
     if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();if(selected){selected=null;showSelection()}else cancel();return true}
     if((ev.ctrlKey||ev.metaKey)&&/^[zy]$/i.test(ev.key)){ev.preventDefault();step(ev.key.toLowerCase()==='y'||ev.shiftKey?1:-1);return true}
     if(selected&&(ev.key==='Delete'||ev.key==='Backspace')&&!/^(INPUT|SELECT)$/.test(ev.target.tagName)){ev.preventDefault();selectionAction('delete');return true}
     return false;
   }
   const resized=new ResizeObserver(()=>{if(fitted)fit()});resized.observe(desk);
   controls();buttons();fit();el.focus();
   return {key,close,element:el};
 }

 g.StudentInk={W,H,TEMPLATES,PAPERS,encode,decode,svg,load,hydrate,thumbnail,open};
})(typeof window!=='undefined'?window:globalThis);
