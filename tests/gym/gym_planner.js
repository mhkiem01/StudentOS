// Plan builder and exercise pictures: node tests/gym/gym_planner.js
const assert=require('node:assert/strict');require('../../frontend/gym/gym-rules.js');require('../../frontend/gym/gym-planner.js');require('../../frontend/gym/gym-art.js');
const R=global.GymRules,P=global.GymPlanner,A=global.GymArt;
const styles={gym:['machines','free','bodyweight','mix'],home:['bodyweight','dumbbells']};
const enjoys=[['strength'],['strength','cardio'],['strength','core','mobility'],['cardio'],['cardio','core'],['mobility'],['strength','cardio','core','mobility']];
const dayChoices=[[0],[1,4],[0,2,4],[0,1,3,4],[0,1,2,3,4],[0,1,2,3,4,5]];
let plans=0;
for(const location of ['gym','home'])for(const style of styles[location])for(const level of ['beginner','intermediate','advanced'])for(const goal of ['muscle','strength','loss','fitness'])for(const enjoy of enjoys)for(const days of dayChoices)for(const duration of [20,30,45,60,90]){
 const a={location,style,level,goal,enjoy,days,duration,focus:['Arms','Legs']},p=P.build(a);plans++;
 assert.deepEqual(p.sessions.map(s=>s.weekday),days,'one workout per chosen day');
 for(const s of p.sessions){
  const ids=s.exercises.map(x=>x.id);assert(ids.length>=1&&ids.length<=20);assert.equal(new Set(ids).size,ids.length,'no repeats in a workout');
  assert(s.name&&s.warmup&&s.cooldown&&s.minutes>=5);assert(s.minutes<=duration+9,`${s.name} fits ${duration} min (${s.minutes})`);
  for(const x of s.exercises){const e=R.byId(x.id);assert(e,x.id);assert.equal(x.unit,e.unit);assert(x.sets>=1&&x.sets<=10&&x.reps>=1&&x.reps_max>=x.reps&&x.reps_max<=100&&x.rest>=0&&x.rest<=600);assert.equal(x.weight,null);
   if(location==='home')assert.notEqual(e.equipment,'gym',`${e.id} needs gym equipment`);
   if(level==='beginner')assert(e.difficulty<=1,`${e.id} too hard for a beginner`)}
  const muscles=s.exercises.map(x=>R.byId(x.id).muscle);
  if(enjoy.includes('cardio'))assert(muscles.includes('Cardio'),'cardio included when enjoyed');
  if(enjoy.includes('mobility')&&duration>20)assert(muscles.includes('Mobility'),'stretches included when enjoyed');
  if(!enjoy.includes('strength'))assert(muscles.every(m=>['Cardio','Core','Mobility'].includes(m)),'no weights unless strength is chosen');
  if(enjoy.includes('strength')&&!enjoy.includes('core'))assert(!muscles.includes('Core')||muscles.filter(m=>m==='Core').length<=1)}}
assert.throws(()=>P.build({location:'gym',style:'mix',level:'beginner',goal:'muscle',enjoy:['strength'],days:[0,1,2,3,4,5,6],duration:45,focus:[]}),/1–6 training days/);
// Splits follow the number of days and experience; repeated days rotate exercises.
const base={location:'gym',style:'mix',goal:'muscle',enjoy:['strength'],duration:60,focus:[]};
assert.deepEqual(P.build({...base,level:'beginner',days:[0,2,4]}).sessions.map(s=>s.name),['Full Body A','Full Body B','Full Body C']);
assert.deepEqual(P.build({...base,level:'intermediate',days:[0,2,4]}).sessions.map(s=>s.name),['Push Day','Pull Day','Leg Day']);
assert.deepEqual(P.build({...base,level:'intermediate',days:[0,1,3,4]}).sessions.map(s=>s.name),['Upper Body A','Lower Body A','Upper Body B','Lower Body B']);
const six=P.build({...base,level:'advanced',days:[0,1,2,3,4,5]}).sessions;assert.equal(six[0].name,'Push Day (A)');assert.notDeepEqual(six[0].exercises.map(x=>x.id),six[3].exercises.map(x=>x.id));
// Machines for a beginner start with guided machines; main lifts get more rest when getting stronger.
const machine=P.build({...base,style:'machines',level:'beginner',days:[0]}).sessions[0].exercises;assert.equal(R.byId(machine[0].id).type,'machine');
const strong=P.build({...base,goal:'strength',level:'intermediate',days:[0]}).sessions[0].exercises;assert.deepEqual([strong[0].reps,strong[0].reps_max,strong[0].rest],[5,8,150]);
assert(P.build({...base,focus:['Arms'],level:'intermediate',days:[0]}).sessions[0].exercises.slice(0,4).some(x=>R.byId(x.id).muscle==='Biceps'),'focus areas are added early');
assert(P.why({...base,level:'beginner',days:[0,2,4]}).length>=2);
// Every library exercise has its own picture; own exercises get one by name or muscle.
for(const e of R.exercises){assert(A.mapped(e.id),'picture for '+e.id);const svg=A.svg(e.id),anim=A.svg(e.id,{anim:true});
 for(const s of [svg,anim]){assert(s.startsWith('<svg class="ga"')&&s.endsWith('</svg>'));assert(!/NaN|undefined|Infinity/.test(s),e.id)}
 assert(A.icon(e.id).includes(`--ga:${A.colors[e.muscle]}`),e.id)}
assert(R.exercises.filter(e=>A.svg(e.id,{anim:true}).includes('<animate')).length>=R.exercises.length-6,'almost every picture moves (holds stay still)');
for(const [name,pattern] of [['Treadmill incline walk','run'],['Weighted plank','plank'],['Hammer curls','curl'],['Zumba','stand']])assert.equal(A.pattern('own-x',name),pattern,name);
assert(A.demo('squat').includes('ga-demo'));
console.log(`PASS Gym planner: ${plans} answer combinations (one workout per day, equipment/home/beginner safety, time limits, cardio/stretch/core choices, splits, rotation, focus) and ${R.exercises.length} exercise pictures`);
