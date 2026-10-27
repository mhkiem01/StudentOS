/* Turns the onboarding answers into a weekly plan: which days, which workout on each day,
   and the full exercise list with sets, reps and rest. Rule based and deterministic, so the
   same answers always give the same plan. General guidance, never a medical prescription.
   Runs in the browser and in Node tests. */
(function(g){
 'use strict';
 const R=g.GymRules;
 const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],DAY_NAMES=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const labels={goal:{muscle:'Build muscle',strength:'Get stronger',loss:'Lose fat',fitness:'Get fitter & healthier'},level:{beginner:'New to training',intermediate:'Some experience',advanced:'Experienced'},location:{gym:'At a gym',home:'At home'},style:{machines:'Machines',free:'Free weights',bodyweight:'Bodyweight',mix:'Mix of everything',dumbbells:'Dumbbells + bodyweight'},enjoy:{strength:'Strength training',cardio:'Cardio',core:'Core & abs',mobility:'Stretching & mobility'}};
 // Each slot lists suitable exercises best-first (big compound lifts before isolation moves).
 // The first ones that suit the person's equipment and level are used; A/B days rotate through the top three.
 const SLOTS={quads:['squat','legpress','goblet','hacksquat','smithsquat','frontsquat','bulgarian','lunge','walklunge','stepup','smithsplit','legext','airsquat','jumpsquat','wallsit'],
  hinge:['rdl','bbrdl','deadlift','trapbar','hipthrust','hipthrustmachine','pullthrough','kbswing','goodmorning','sumo','hyperext','backextmachine','bridge'],
  glutes:['hipthrust','hipthrustmachine','bridge','bulgarian','glutekick','abductor','stepup','pullthrough','kbswing'],
  hams:['lyingcurl','seatedcurl','goodmorning','hyperext','bridge'],calves:['calfmachine','seatedcalf','calf'],
  chest:['bench','dbbench','chestpress','smithbench','pushup','dbpress','pecdeck','cablefly','dbfly','declinebench','closepush','inclinepush','declinepush'],
  chestUpper:['dbincline','inclinemachine','inclinebench','smithincline','lowcablefly','declinepush','pushup'],
  vpull:['pulldown','assistpull','pullup','chinup','closepulldown','straightpull','pullover'],
  hpull:['cablerow','row','machinerow','bbrow','tbarrow','invrow','reardelt','prone'],
  shoulders:['ohp','shouldermachine','bbohp','smithohp','arnold','pike','frontraise'],side:['lateral','cablelateral','lateralmachine','uprightrow','scap'],rear:['facepull','reversepec','reardelt','prone','scap'],
  biceps:['curl','cablecurl','hammer','bbcurl','preachermachine','inclinecurl','preacher','concentration','cablehammer','reversecurl'],
  triceps:['pushdown','ropepushdown','extension','tricepmachine','overheadcable','skull','cgbench','kickback','dip','assistdip','benchdip','closepush'],
  core:['plank','deadbug','cablecrunch','abmachine','pallof','hangleg','captain','crunch','sideplank','legraise','bicycle','mountain','hollow','russian','woodchop','abwheel','situp','rotary'],
  cardio:['treadmill','bike','elliptical','rower','stairs','airbike','skierg','jumprope','jumpingjack','burpee','battlerope'],
  mobility:['hipflexor','hamstring','catcow','childpose','quadstretch','worldsgreatest','chestopener'],
  chestFly:['pecdeck','cablefly','dbfly','lowcablefly','inclinepush','pushup']};
 const T={
  fullA:['Full Body A','Whole body',['quads','chest','vpull','hinge','side','core','biceps','triceps']],
  fullB:['Full Body B','Whole body',['hinge','chest','hpull','quads','shoulders','core','triceps','biceps']],
  fullC:['Full Body C','Whole body',['quads','chestUpper','vpull','glutes','rear','core','biceps','calves']],
  upperA:['Upper Body A','Chest, back, shoulders & arms',['chest','hpull','shoulders','vpull','triceps','biceps','side','core']],
  upperB:['Upper Body B','Chest, back, shoulders & arms',['vpull','chestUpper','hpull','side','biceps','triceps','rear','core']],
  lowerA:['Lower Body A','Legs, glutes & core',['quads','hinge','glutes','hams','calves','core','quads']],
  lowerB:['Lower Body B','Legs, glutes & core',['hinge','quads','glutes','calves','hams','core','quads']],
  push:['Push Day','Chest, shoulders & triceps',['chest','shoulders','chestUpper','triceps','side','triceps','core']],
  pull:['Pull Day','Back, rear shoulders & biceps',['vpull','hpull','rear','biceps','hpull','biceps','core']],
  legs:['Leg Day','Legs, glutes & core',['quads','hinge','glutes','hams','calves','core']]};
 const SPLITS={1:['fullA'],2:['fullA','fullB'],3:['fullA','fullB','fullC'],4:['upperA','lowerA','upperB','lowerB'],5:['upperA','lowerA','push','pull','legs'],6:['push','pull','legs','push','pull','legs']};
 const FOCUS={Chest:'chestFly',Back:'hpull',Shoulders:'side',Arms:'biceps',Legs:'glutes',Core:'core'};
 const trains={Chest:['Chest'],Back:['Back'],Shoulders:['Shoulders'],Arms:['Biceps','Triceps'],Legs:['Legs'],Core:['Core']};
 const GYM_BODYWEIGHT=new Set(['pullup','chinup','invrow','dip','hangleg','captain','boxjump','hyperext']);
 const MAX_LIFTS={beginner:6,intermediate:7,advanced:8};
 // Does this exercise suit where and how the person wants to train?
 function fits(e,a,strict=true){
  if(e.muscle==='Mobility')return true;
  if(a.location==='home')return e.equipment==='bodyweight'||(a.style==='dumbbells'&&e.equipment==='dumbbells');
  if(!strict||a.style==='mix')return true;
  if(a.style==='machines')return e.type==='machine'||(e.equipment==='bodyweight'&&['Core','Cardio'].includes(e.muscle));
  if(a.style==='free')return e.type==='free';
  if(a.style==='bodyweight')return e.equipment==='bodyweight'||GYM_BODYWEIGHT.has(e.id);
  return true}
 const maxDifficulty={beginner:0,intermediate:1,advanced:2};
 // Beginners are never given advanced movements; others may step up one level when nothing else suits.
 function pick(slot,a,taken,turn,unit){
  const list=SLOTS[slot].map(R.byId).filter(e=>e&&!taken.has(e.id)&&(!unit||e.unit===unit)),max=maxDifficulty[a.level],up=Math.min(2,max+1);
  for(const [strict,limit] of [[true,max],[true,up],[false,max],[false,up]]){const pool=list.filter(e=>e.difficulty<=limit&&fits(e,a,strict));if(pool.length)return pool[turn%Math.min(3,pool.length)]}
  return unit?pick(slot,a,taken,turn):null}
 const scheme={strength:{main:[5,8],acc:[8,10],rest:[150,90]},muscle:{main:[8,12],acc:[10,12],rest:[90,60]},loss:{main:[12,15],acc:[12,15],rest:[60,45]},fitness:{main:[10,15],acc:[12,15],rest:[60,45]}};
 function dose(e,a,i,kind){
  const s=scheme[a.goal]||scheme.muscle,main=i<2&&kind==='lift',lvl=a.level,short=a.duration<=30;
  if(e.muscle==='Mobility')return {sets:1,reps:30,reps_max:30,unit:'seconds',rest:0};
  if(e.muscle==='Cardio'&&kind!=='lift'){const m=kind==='cardio-main'?Math.max(10,a.duration-(a.enjoy.includes('core')?20:10)-(a.enjoy.includes('mobility')?5:0)):finisher(a);
   if(e.unit==='minutes')return {sets:1,reps:m,reps_max:m,unit:'minutes',rest:0};
   if(e.unit==='seconds')return {sets:Math.max(3,Math.round(m/2)),reps:30,reps_max:30,unit:'seconds',rest:30};
   const [lo,hi]=e.id==='burpee'?[8,12]:[30,40];return {sets:Math.max(3,Math.round(m/2)),reps:lo,reps_max:hi,unit:'reps',rest:30}}
  let sets=lvl==='beginner'?(main?3:2):lvl==='intermediate'?3:(main?4:3);if(short)sets=Math.min(sets,main?3:2);
  if(e.unit==='seconds'){const [lo,hi]=lvl==='beginner'?[20,30]:[30,45];return {sets,reps:lo,reps_max:hi,unit:'seconds',rest:45}}
  const [lo,hi]=e.muscle==='Core'?[10,15]:main?s.main:s.acc,rest=e.muscle==='Core'?45:main?s.rest[0]:s.rest[1];
  return {sets,reps:lo,reps_max:hi,unit:'reps',rest:short?Math.max(45,rest-30):rest}}
 // Rough session length: 5 min warm-up, ~40 s per set plus rest, a minute to set up each exercise.
 const minutesFor=list=>5+Math.round(list.reduce((t,x)=>t+(x.unit==='minutes'?x.reps*60:x.sets*((x.unit==='seconds'?x.reps_max:40)+x.rest)+60),0)/60);
 const finisher=a=>Math.max(5,Math.min(25,Math.round(a.duration*(a.goal==='loss'||a.goal==='fitness'?.35:.22)/5)*5));
 // use: how often each slot has been filled this week, so repeated slots rotate through the top choices.
 function session(key,a,use){
  const [name,area,slots]=T[key],enjoy=new Set(a.enjoy),taken=new Set(),lifts=[],extras=[],turn=slot=>(use[slot]=(use[slot]??-1)+1);
  let list=[...slots];const focus=(a.focus||[]).filter(f=>trains[f].some(m=>slots.some(s=>R.byId(SLOTS[s][0])?.muscle===m)));
  for(const f of focus.slice(0,2))list.splice(Math.min(3,list.length),0,FOCUS[f]);
  if(!enjoy.has('core'))list=list.filter(s=>s!=='core');
  if(enjoy.has('cardio')){const e=pick('cardio',a,taken,turn('cardio'),'minutes');if(e){taken.add(e.id);extras.push({id:e.id,...dose(e,a,9,'cardio'),weight:null})}}
  if(enjoy.has('mobility'))for(let i=0;i<(a.duration<=20?0:a.duration<=30?1:2);i++){const e=pick('mobility',a,taken,turn('mobility'));if(e){taken.add(e.id);extras.push({id:e.id,...dose(e,a,9,'stretch'),weight:null})}}
  // Fill the chosen session length; core work goes last among the lifts.
  const ordered=[...list.filter(s=>s!=='core'),...list.filter(s=>s==='core').slice(0,1)],min=a.duration<=30?2:3,fitsTime=x=>minutesFor([...lifts,x,...extras])<=a.duration+3;
  for(const slot of ordered){if(lifts.length>=MAX_LIFTS[a.level])break;const e=pick(slot,a,taken,(use[slot]??-1)+1);if(!e)continue;const x={id:e.id,...dose(e,a,lifts.length,'lift'),weight:null};
   if(lifts.length>=min&&!fitsTime(x)){if(slot==='core'||!enjoy.has('core'))break;continue}
   turn(slot);taken.add(e.id);lifts.push(x)}
  if(enjoy.has('core')&&!lifts.some(x=>R.byId(x.id).muscle==='Core')){const e=pick('core',a,taken,turn('core'));if(e){taken.add(e.id);const x={id:e.id,...dose(e,a,9,'lift'),weight:null};if(!fitsTime(x)&&lifts.length>min)lifts.pop();lifts.push(x)}}
  // Still too long? Trim gently: extra stretches, then cardio length, then accessory sets, then extra lifts.
  const limit=a.duration+5,over=()=>minutesFor([...lifts,...extras])>limit,isStretch=x=>R.byId(x.id).muscle==='Mobility',cardioX=extras.find(x=>x.unit==='minutes');
  while(over()&&extras.filter(isStretch).length>1)extras.splice(extras.findLastIndex(isStretch),1);
  while(over()&&cardioX&&cardioX.reps>5){cardioX.reps-=5;cardioX.reps_max=cardioX.reps}
  for(let i=lifts.length-1;i>=2&&over();i--)if(lifts[i].sets>2)lifts[i].sets=2;
  while(over()&&lifts.length>min){const k=lifts.findLastIndex(x=>R.byId(x.id).muscle!=='Core');lifts.splice(k>=min?k:lifts.length-1,1)}
  return {name,area,exercises:[...lifts,...extras]}}
 // No weights chosen: cardio, core and/or mobility sessions.
 function conditioning(a,use){
  const enjoy=new Set(a.enjoy),taken=new Set(),out=[],add=(slot,kind,unit)=>{const e=pick(slot,a,taken,use[slot]=(use[slot]??-1)+1,unit);if(e){taken.add(e.id);out.push({id:e.id,...dose(e,a,out.length,kind),weight:null})}};
  if(enjoy.has('cardio'))add('cardio','cardio-main','minutes');
  if(enjoy.has('core'))for(let i=0;i<(a.duration>=45?3:2);i++)add('core','core');
  if(enjoy.has('mobility'))for(let i=0;i<(enjoy.size===1?Math.min(7,Math.max(4,Math.round(a.duration/6))):2);i++)add('mobility','stretch');
  const name=enjoy.has('cardio')&&enjoy.has('core')?'Cardio & Core':enjoy.has('cardio')?'Cardio':enjoy.has('core')?'Core':'Mobility & Recovery';
  return {name,area:enjoy.has('mobility')&&enjoy.size===1?'Flexibility & recovery':'Heart, lungs & core',exercises:out}}
 function build(a){
  const days=[...new Set(a.days)].sort((x,y)=>x-y);if(!days.length||days.length>6)throw Error('Choose 1–6 training days.');
  const weights=a.enjoy.includes('strength'),split=SPLITS[days.length].map(k=>k);
  if(weights&&days.length===3&&a.level!=='beginner')split.splice(0,3,'push','pull','legs');
  if(weights&&days.length===5&&a.level==='beginner')split.splice(0,5,'upperA','lowerA','fullC','upperB','lowerB');
  const seen={},use={};
  const sessions=days.map((weekday,i)=>{const key=split[i],turn=seen[key]=(seen[key]??-1)+1,s=weights?session(key,a,use):conditioning(a,use);
   if(weights&&split.filter(k=>k===key).length>1)s.name+=' '+(turn?'(B)':'(A)');if(!weights&&days.length>1)s.name+=' '+'ABCDEF'[i];
   return {weekday,day:DAY_NAMES[weekday],...s,minutes:minutesFor(s.exercises),warmup:a.location==='home'?'5 min: march on the spot, arm circles, 10 slow bodyweight squats':'5 min easy cardio, then 1 light warm-up set of your first exercise',cooldown:a.enjoy.includes('mobility')?'Finish with the stretches at the end of the list':'3–5 min easy walking and gentle stretching'}});
  return {sessions,days}}
 // Short, plain-language reasons shown with the plan.
 function why(a){const n=a.days.length,w=a.enjoy.includes('strength');return [
  w?(n<=3?`${n} day${n>1?'s':''} a week, so every workout trains your whole body${n===3&&a.level!=='beginner'?' across a push / pull / legs split':''}.`:n===4?'4 days a week: upper body and lower body take turns, so each muscle rests 2–3 days.':'Each muscle group is trained twice a week with rest in between.'):'Workouts focus on what you enjoy: '+a.enjoy.map(x=>labels.enjoy[x].toLowerCase()).join(', ')+'.',
  {strength:'Heavier weights for fewer reps (5–8) build strength. Rest a full 2–3 minutes on the first two exercises.',muscle:'8–12 reps per set builds muscle best. Finish each set with 1–2 reps left in the tank.',loss:'Higher reps with short rests keep your heart rate up. Food matters most for fat loss, see Nutrition.',fitness:'A balanced mix of reps and cardio for everyday fitness and energy.'}[a.goal],
  a.level==='beginner'?'Start light. Learn each movement with the picture and tips before adding weight.':'Add a little weight or a rep when you hit the top of the rep range on every set.'].filter(Boolean)}
 g.GymPlanner={build,why,labels,DAYS,DAY_NAMES,fits,minutesFor,SLOTS};
})(typeof window==='undefined'?globalThis:window);
