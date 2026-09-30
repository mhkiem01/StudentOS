const assert=require('node:assert/strict');require('../../frontend/gym/gym-rules.js');const r=global.GymRules;
for(const equipment of ['gym','dumbbells','bodyweight'])for(const level of ['beginner','intermediate','advanced'])for(const goal of ['muscle','strength','fitness','loss'])for(const duration of [30,45,60,75,90])for(let v=0;v<3;v++){
 const p={equipment,level,goal,duration},w=r.suggest(p,v);assert(w.exercises.length>=2);assert(w.exercises.every(x=>r.eligible(r.byId(x.id),p)));assert(w.exercises.every(x=>x.weight===null));assert.equal(new Set(w.exercises.map(x=>x.id)).size,w.exercises.length);
 for(const x of w.exercises)assert(r.swaps(x.id,p).every(e=>r.eligible(e,p)&&e.muscle===r.byId(x.id).muscle));
}
assert.equal(r.streak([{date:'2026-09-20',status:'completed'},{date:'2026-09-19',status:'completed'},{date:'2026-09-18',status:'active'}],new Date(2026,8,20)),2);
assert.equal(r.estimated1RM({weight:60,reps:5}),70);assert.equal(r.estimated1RM({weight:60,reps:20}),null);
assert.deepEqual(r.plates(100,20).plates,[{size:25,count:1},{size:15,count:1}]);assert.equal(r.plates(101,20).remainder,1);assert.throws(()=>r.plates(10,20));
assert.equal(r.records([{session_id:'s',exercise_id:'bench',weight:20,reps:8}],[{id:'s',status:'active'}]).length,0);
// Weekly review: muscle matching, Monday weeks, beating last week and coverage.
assert.equal(r.muscleOf('bench').muscle,'Chest');assert.deepEqual(r.muscleOf('x','goblet squat').muscle,'Legs');
for(const [name,muscle] of [['Leg curl','Legs'],['Hammer curl','Biceps'],['Incline DB press','Chest'],['Hanging leg raise','Core'],['Face pull','Shoulders'],['Seated cable row','Back'],['Skull crushers','Triceps'],['Squat or leg press','Legs']])assert.equal(r.muscleOf('own-1',name)?.muscle,muscle,name);
assert.equal(r.muscleOf('own-2','Zumba'),null);
assert.equal(r.weekStart('2026-09-27'),'2026-09-21');assert.equal(r.weekStart('2026-09-21'),'2026-09-21');assert.equal(r.weekStart(new Date(2026,8,24)),'2026-09-21');
const ex=[{id:'bench',unit:'reps'},{id:'own-legs',name:'Leg press',unit:'reps'},{id:'own-z',name:'Zumba',unit:'reps'},{id:'own-plank',name:'Plank',unit:'seconds'}];
const S=(id,date,status='completed')=>({id,date,status,data:{exercises:ex}}),T=(session_id,exercise_id,weight,reps)=>({session_id,exercise_id,weight,reps});
const sessions=[S('last','2026-09-15'),S('now1','2026-09-22'),S('now2','2026-09-24'),S('gone','2026-09-23','cancelled'),S('open','2026-09-24','active')];
const sets=[T('last','bench',50,8),T('last','bench',50,8),T('last','bench',50,8),T('now1','bench',50,8),T('now1','bench',50,8),T('now2','own-legs',100,10),T('now2','own-legs',100,10),T('now2','own-z',0,20),T('now2','own-plank',0,45),T('gone','bench',200,10),T('open','bench',200,10)];
let c=r.weekCompare(sessions,sets,new Date(2026,8,24));
assert.equal(c.current.start,'2026-09-21');assert.equal(c.current.end,'2026-09-27');assert.equal(c.previous.start,'2026-09-14');
assert.deepEqual([c.current.workouts,c.current.sets,c.current.volume,c.current.seconds],[2,6,2800,45]);assert.deepEqual([c.previous.sets,c.previous.volume],[3,1200]);
assert(c.beaten);assert(!c.firstWeek);assert.equal(c.setsToBeat,0);assert(c.metrics.find(m=>m.key==='seconds'));
assert.deepEqual(c.current.covered,['Chest','Legs','Core']);assert.deepEqual(c.current.partial,['Shoulders','Triceps']);assert.deepEqual(c.current.missed,['Back','Biceps']);assert.equal(c.current.unclassified,1);
c=r.weekCompare(sessions,sets.filter(s=>s.session_id!=='now2').slice(0,4),new Date(2026,8,24));
assert(!c.beaten);assert.equal(c.setsToBeat,3);
c=r.weekCompare(sessions,sets,new Date(2026,8,24),-1);assert.equal(c.current.start,'2026-09-14');assert(c.firstWeek);
console.log('PASS Gym rules: 540 preference combinations, equipment-safe swaps, streak, records, estimated 1RM, plates, muscle matching and weekly progress/coverage');
