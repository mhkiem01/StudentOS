/* Local rule engine. Templates are general guidance, never a prescription.
   Extension seam: a future AI can propose this same workout shape for review. */
(function(g){
 'use strict';
 const raw=[
 ['bench','Bench Press','Chest',['Triceps','Shoulders'],'gym',1,'Barbell + bench','Lie with feet planted and shoulder blades supported. Lower the bar under control, then press. Use safeties or a spotter.'],
 ['dbpress','Dumbbell Floor Press','Chest',['Triceps'],'dumbbells',0,'Dumbbells','Lie on the floor with bent knees. Lower elbows gently to the floor, then press up with control.'],
 ['pushup','Push-Up','Chest',['Triceps','Core'],'bodyweight',0,'Floor','Keep your body in a straight line. Bend elbows to lower, then press up. Use knees down to make it easier.'],
 ['squat','Barbell Squat','Legs',['Core'],'gym',1,'Barbell + rack','Set safeties. Brace your trunk, sit down between the hips within a comfortable range, and stand with control.'],
 ['goblet','Goblet Squat','Legs',['Core'],'dumbbells',0,'Dumbbell','Hold a dumbbell at chest height. Sit between the hips with heels grounded, then stand.'],
 ['airsquat','Bodyweight Squat','Legs',['Core'],'bodyweight',0,'None','Keep feet planted. Bend hips and knees within a comfortable range, then stand.'],
 ['deadlift','Deadlift','Back',['Legs','Core'],'gym',2,'Barbell','Brace, hinge at your hips, keep the bar close and stand tall. Lower with control. Learn technique with qualified supervision.'],
 ['rdl','Dumbbell Romanian Deadlift','Legs',['Back'],'dumbbells',1,'Dumbbells','With soft knees, move hips backwards while weights stay close. Return to standing without rounding the back.'],
 ['bridge','Glute Bridge','Legs',['Core'],'bodyweight',0,'Floor','Lie with knees bent and feet flat. Lift hips by squeezing glutes; avoid arching the lower back.'],
 ['pulldown','Lat Pulldown','Back',['Biceps'],'gym',0,'Cable machine','Sit supported and pull the handle towards the upper chest without swinging. Return slowly.'],
 ['row','Dumbbell Row','Back',['Biceps'],'dumbbells',0,'Dumbbell','Hinge with a braced trunk and support one hand on your thigh. Pull towards the hip, then lower slowly.'],
 ['prone','Prone W Raise','Back',['Shoulders'],'bodyweight',0,'Floor','Lie face down, bend arms into a W and gently lift hands while drawing shoulder blades together. Keep the neck relaxed.'],
 ['ohp','Dumbbell Shoulder Press','Shoulders',['Triceps'],'dumbbells',1,'Dumbbells','Brace your trunk. Press weights overhead through a comfortable range without arching your back.'],
 ['pike','Pike Push-Up','Shoulders',['Triceps'],'bodyweight',2,'Floor','With hips raised, bend elbows to lower the head between the hands, then press. Stop if the position is uncomfortable.'],
 ['lateral','Lateral Raise','Shoulders',[],'dumbbells',0,'Dumbbells','Lift light weights out to the sides to a comfortable height with slightly bent elbows. Lower slowly.'],
 ['scap','Wall Slide','Shoulders',['Back'],'bodyweight',0,'Wall','Stand against a wall and slide arms overhead within a comfortable range. Avoid shrugging or forcing the motion.'],
 ['curl','Dumbbell Curl','Biceps',[],'dumbbells',0,'Dumbbells','Keep elbows close to the torso. Curl without swinging, then lower with control.'],
 ['pushdown','Triceps Pushdown','Triceps',[],'gym',0,'Cable machine','Keep elbows at your sides and extend arms down. Return slowly without moving the shoulders.'],
 ['extension','Dumbbell Triceps Extension','Triceps',[],'dumbbells',1,'Dumbbell','Support a light weight overhead. Bend elbows through a comfortable range, then extend without flaring the ribs.'],
 ['closepush','Close-Grip Knee Push-Up','Triceps',['Chest'],'bodyweight',0,'Floor','Use knees down and hands slightly narrower than shoulders. Lower with control, then press up.'],
 ['lunge','Reverse Lunge','Legs',['Core'],'bodyweight',1,'None','Step backwards and bend both knees through a comfortable range. Push through the front foot to return.'],
 ['legpress','Leg Press','Legs',[],'gym',0,'Leg press machine','Keep the back supported, lower through a comfortable range, and press without locking the knees.'],
 ['calf','Standing Calf Raise','Legs',[],'bodyweight',0,'Wall for balance','Use support for balance, lift heels, pause and lower slowly.'],
 ['deadbug','Dead Bug','Core',[],'bodyweight',0,'Floor','Lie on your back. Brace gently and extend opposite arm and leg without lifting the lower back. Alternate sides.'],
 ['crunch','Controlled Crunch','Core',[],'bodyweight',0,'Floor','Lie with knees bent. Lift shoulder blades slightly without pulling on the neck, then lower.']
 ];
 const exercises=raw.map(([id,name,muscle,secondary,equipment,difficulty,gear,instructions])=>({id,name,muscle,secondary,equipment,difficulty,gear,instructions}));
 const byId=id=>exercises.find(e=>e.id===id);
 const eligible=(e,p)=>p.equipment==='gym'||e.equipment==='bodyweight'||p.equipment===e.equipment;
 const plans={beginner:[['Full Body A','Legs','Chest','Back','Core','Shoulders'],['Full Body B','Back','Legs','Chest','Core','Triceps']],intermediate:[['Push Day','Chest','Shoulders','Triceps','Chest','Core','Shoulders'],['Pull Day','Back','Biceps','Back','Core','Shoulders'],['Leg Day','Legs','Legs','Core','Legs','Back']],advanced:[['Upper Emphasis','Chest','Back','Shoulders','Triceps','Biceps','Chest','Core'],['Lower Emphasis','Legs','Legs','Back','Core','Legs','Legs'],['Push Variation','Shoulders','Chest','Triceps','Chest','Shoulders','Core']]};
 function suggest(p,variant=0){const level=p.level||'beginner',plan=plans[level][variant%plans[level].length],max=level==='beginner'?0:level==='intermediate'?1:2;
   const count=Math.min(plan.length-1,Math.max(3,Math.floor(p.duration/15)+1)+(level==='advanced'?1:0)-(level==='beginner'?1:0)),chosen=[];
   for(const muscle of plan.slice(1)){const pool=exercises.filter(e=>e.muscle===muscle&&e.difficulty<=max&&eligible(e,p)&&!chosen.some(r=>r.id===e.id));if(!pool.length)continue;const e=pool[variant%pool.length];chosen.push({id:e.id,sets:level==='beginner'?2:level==='intermediate'?3:4,reps:p.goal==='strength'?5:p.goal==='fitness'||p.goal==='loss'?12:8,weight:null});if(chosen.length>=count)break}
   return {name:plan[0],level,duration:p.duration,exercises:chosen};
 }
 const swaps=(id,p)=>exercises.filter(e=>e.id!==id&&e.muscle===byId(id)?.muscle&&eligible(e,p));
 const day=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 function streak(sessions,today=new Date()){const dates=new Set(sessions.filter(s=>s.status==='completed').map(s=>s.date));const d=new Date(today.getFullYear(),today.getMonth(),today.getDate());if(!dates.has(day(d)))d.setDate(d.getDate()-1);let count=0;while(dates.has(day(d))){count++;d.setDate(d.getDate()-1)}return count}
 // Epley: weight*(1+reps/30). Show only <=10 reps; never a max-attempt instruction.
 const estimated1RM=s=>s.weight>0&&s.reps<=10?Math.round(s.weight*(1+s.reps/30)*10)/10:null;
 function records(sets,sessions){const done=new Set(sessions.filter(s=>s.status==='completed').map(s=>s.id)),best={};for(const s of sets.filter(x=>done.has(x.session_id)&&sessions.find(w=>w.id===x.session_id)?.data?.exercises?.find(e=>e.id===x.exercise_id)?.unit!=='seconds')){const b=best[s.exercise_id];if(!b||s.weight>b.weight||s.weight===b.weight&&s.reps>b.reps)best[s.exercise_id]=s}return Object.values(best)}
 // Weekly review. Weeks run Monday–Sunday; only completed sessions count.
 const muscles=['Chest','Back','Shoulders','Biceps','Triceps','Legs','Core'];
 // Personal routines are free text, so their muscle is a keyword guess (first match wins); unmatched names stay unclassified.
 const keywords=[['Core',/plank|crunch|sit-?up|dead ?bug|hollow|leg raise|russian twist|\babs?\b|abdominal|\bcore\b|mountain climber/],['Triceps',/tricep|pushdown|skull|close-?grip|\bdips?\b/],['Shoulders',/shoulder|overhead|\bohp\b|military|arnold|lateral|front raise|rear delt|face pull|upright row|pike|delt/],['Legs',/squat|lunge|\blegs?\b|calf|calves|glute|hip thrust|bridge|hamstring|quad|\brdl\b|romanian|step-?up|split/],['Chest',/bench|chest|push-?up|press-?up|\bfly|flye|\bpec|incline|decline/],['Back',/\brows?\b|rowing|pull|\blats?\b|deadlift|chin-?up|\bback\b|shrug/],['Biceps',/bicep|curl|hammer/]];
 function muscleOf(id,name){const known=byId(id)||exercises.find(e=>e.name.toLowerCase()===String(name||'').trim().toLowerCase());if(known)return {muscle:known.muscle,secondary:known.secondary};const text=String(name||'').toLowerCase(),hit=keywords.find(([,re])=>re.test(text));return hit?{muscle:hit[0],secondary:[],guessed:true}:null}
 const parse=s=>{const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
 function weekStart(when=new Date()){const d=typeof when==='string'?parse(when):new Date(when.getFullYear(),when.getMonth(),when.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);return day(d)}
 function addDays(s,n){const d=parse(s);d.setDate(d.getDate()+n);return day(d)}
 function weekSummary(sessions,sets,start){const end=addDays(start,6),done=sessions.filter(s=>s.status==='completed'&&s.date>=start&&s.date<=end),ids=new Map(done.map(s=>[s.id,s]));
   const w={start,end,workouts:done.length,sets:0,reps:0,seconds:0,volume:0,primary:{},secondary:{},unclassified:0};
   for(const s of sets){const session=ids.get(s.session_id);if(!session)continue;const x=session.data?.exercises?.find(e=>e.id===s.exercise_id);w.sets++;
     if(x?.unit==='seconds')w.seconds+=s.reps;else{w.reps+=s.reps;w.volume+=s.weight*s.reps}
     const m=muscleOf(s.exercise_id,x?.name);if(!m){w.unclassified++;continue}w.primary[m.muscle]=(w.primary[m.muscle]||0)+1;for(const k of m.secondary)w.secondary[k]=(w.secondary[k]||0)+1}
   w.volume=Math.round(w.volume*10)/10;
   w.covered=muscles.filter(m=>w.primary[m]);w.partial=muscles.filter(m=>!w.primary[m]&&w.secondary[m]);w.missed=muscles.filter(m=>!w.primary[m]&&!w.secondary[m]);return w}
 // "More than last week" means more sets or more volume (kg × reps): either is progressive overload.
 function weekCompare(sessions,sets,today=new Date(),offset=0){const start=addDays(weekStart(today),offset*7),current=weekSummary(sessions,sets,start),previous=weekSummary(sessions,sets,addDays(start,-7));
   const metrics=['workouts','sets','reps','volume','seconds'].filter(k=>k==='workouts'||k==='sets'||current[k]||previous[k]).map(key=>({key,current:current[key],previous:previous[key],beaten:current[key]>previous[key]}));
   const beaten=current.sets>previous.sets||current.volume>previous.volume;
   return {current,previous,metrics,beaten,firstWeek:!previous.workouts,setsToBeat:beaten?0:previous.sets-current.sets+1}}
 function plates(total,bar,units='kg'){if(!Number.isFinite(total)||!Number.isFinite(bar)||total<bar||bar<0)throw Error('Target must be at least the bar weight.');let remainder=(total-bar)/2;const result=[];for(const size of units==='lb'?[45,35,25,10,5,2.5]:[25,20,15,10,5,2.5,1.25]){const count=Math.floor((remainder+1e-8)/size);if(count){result.push({size,count});remainder-=size*count}}return {plates:result,remainder:Math.round(remainder*200)/100}}
 g.GymRules={exercises,byId,eligible,suggest,swaps,day,streak,estimated1RM,records,plates,muscles,muscleOf,weekStart,weekSummary,weekCompare};
})(typeof window==='undefined'?globalThis:window);
