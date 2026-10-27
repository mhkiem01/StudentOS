/* Local rule engine. Templates are general guidance, never a prescription.
   Extension seam: a future AI can propose this same workout shape for review. */
(function(g){
 'use strict';
 // Row: id, name, muscle, secondary, equipment (suggestion eligibility), difficulty, gear, cue, type, target, unit, search aliases.
 // type 'machine' = the load comes from a machine, cable or Smith bar on a fixed path; 'free' ("Own weight") = your body or free weights.
 // Existing ids stay first and unchanged: logged sets reference them and suggestion pools pick in this order.
 const raw=[
 ['bench','Bench Press','Chest',['Triceps','Shoulders'],'gym',1,'Barbell + bench','Lie with feet planted and shoulder blades supported. Lower the bar under control, then press. Use safeties or a spotter.','free','Mid chest',null,'barbell flat bench'],
 ['dbpress','Dumbbell Floor Press','Chest',['Triceps'],'dumbbells',0,'Dumbbells','Lie on the floor with bent knees. Lower elbows gently to the floor, then press up with control.','free','Chest'],
 ['pushup','Push-Up','Chest',['Triceps','Core'],'bodyweight',0,'Floor','Keep your body in a straight line. Bend elbows to lower, then press up. Use knees down to make it easier.','free','Chest',null,'press up'],
 ['squat','Barbell Squat','Legs',['Core'],'gym',1,'Barbell + rack','Set safeties. Brace your trunk, sit down between the hips within a comfortable range, and stand with control.','free','Quads & glutes',null,'back squat'],
 ['goblet','Goblet Squat','Legs',['Core'],'dumbbells',0,'Dumbbell','Hold a dumbbell at chest height. Sit between the hips with heels grounded, then stand.','free','Quads & glutes',null,'kettlebell'],
 ['airsquat','Bodyweight Squat','Legs',['Core'],'bodyweight',0,'None','Keep feet planted. Bend hips and knees within a comfortable range, then stand.','free','Quads & glutes',null,'air squat'],
 ['deadlift','Deadlift','Back',['Legs','Core'],'gym',2,'Barbell','Brace, hinge at your hips, keep the bar close and stand tall. Lower with control. Learn technique with qualified supervision.','free','Posterior chain',null,'conventional barbell'],
 ['rdl','Dumbbell Romanian Deadlift','Legs',['Back'],'dumbbells',1,'Dumbbells','With soft knees, move hips backwards while weights stay close. Return to standing without rounding the back.','free','Hamstrings & glutes',null,'rdl'],
 ['bridge','Glute Bridge','Legs',['Core'],'bodyweight',0,'Floor','Lie with knees bent and feet flat. Lift hips by squeezing glutes; avoid arching the lower back.','free','Glutes'],
 ['pulldown','Lat Pulldown','Back',['Biceps'],'gym',0,'Cable machine','Sit supported and pull the handle towards the upper chest without swinging. Return slowly.','machine','Lats',null,'lat pull down wide grip'],
 ['row','Dumbbell Row','Back',['Biceps'],'dumbbells',0,'Dumbbell','Hinge with a braced trunk and support one hand on your thigh. Pull towards the hip, then lower slowly.','free','Mid back & lats',null,'one arm single arm'],
 ['prone','Prone W Raise','Back',['Shoulders'],'bodyweight',0,'Floor','Lie face down, bend arms into a W and gently lift hands while drawing shoulder blades together. Keep the neck relaxed.','free','Upper back'],
 ['ohp','Dumbbell Shoulder Press','Shoulders',['Triceps'],'dumbbells',1,'Dumbbells','Brace your trunk. Press weights overhead through a comfortable range without arching your back.','free','Front delts',null,'overhead press'],
 ['pike','Pike Push-Up','Shoulders',['Triceps'],'bodyweight',2,'Floor','With hips raised, bend elbows to lower the head between the hands, then press. Stop if the position is uncomfortable.','free','Front delts'],
 ['lateral','Lateral Raise','Shoulders',[],'dumbbells',0,'Dumbbells','Lift light weights out to the sides to a comfortable height with slightly bent elbows. Lower slowly.','free','Side delts',null,'side raise'],
 ['scap','Wall Slide','Shoulders',['Back'],'bodyweight',0,'Wall','Stand against a wall and slide arms overhead within a comfortable range. Avoid shrugging or forcing the motion.','free','Shoulder mobility'],
 ['curl','Dumbbell Curl','Biceps',[],'dumbbells',0,'Dumbbells','Keep elbows close to the torso. Curl without swinging, then lower with control.','free','Biceps'],
 ['pushdown','Triceps Pushdown','Triceps',[],'gym',0,'Cable machine','Keep elbows at your sides and extend arms down. Return slowly without moving the shoulders.','machine','Triceps',null,'cable pressdown bar'],
 ['extension','Dumbbell Triceps Extension','Triceps',[],'dumbbells',1,'Dumbbell','Support a light weight overhead. Bend elbows through a comfortable range, then extend without flaring the ribs.','free','Triceps (long head)',null,'overhead'],
 ['closepush','Close-Grip Knee Push-Up','Triceps',['Chest'],'bodyweight',0,'Floor','Use knees down and hands slightly narrower than shoulders. Lower with control, then press up.','free','Triceps'],
 ['lunge','Reverse Lunge','Legs',['Core'],'bodyweight',1,'None','Step backwards and bend both knees through a comfortable range. Push through the front foot to return.','free','Quads & glutes'],
 ['legpress','Leg Press','Legs',[],'gym',0,'Leg press machine','Keep the back supported, lower through a comfortable range, and press without locking the knees.','machine','Quads & glutes',null,'sled 45'],
 ['calf','Standing Calf Raise','Legs',[],'bodyweight',0,'Wall for balance','Use support for balance, lift heels, pause and lower slowly.','free','Calves'],
 ['deadbug','Dead Bug','Core',[],'bodyweight',0,'Floor','Lie on your back. Brace gently and extend opposite arm and leg without lifting the lower back. Alternate sides.','free','Deep core'],
 ['crunch','Controlled Crunch','Core',[],'bodyweight',0,'Floor','Lie with knees bent. Lift shoulder blades slightly without pulling on the neck, then lower.','free','Abs'],
 // Chest
 ['chestpress','Machine Chest Press','Chest',['Triceps','Shoulders'],'gym',0,'Chest press machine','Set the seat so the handles line up with mid-chest. Press forward without slamming the elbows straight, then return slowly.','machine','Mid chest',null,'seated plate loaded hammer strength'],
 ['inclinemachine','Incline Machine Press','Chest',['Shoulders','Triceps'],'gym',0,'Incline press machine','Keep your back against the pad and press up along the machine path. Lower under control.','machine','Upper chest'],
 ['pecdeck','Pec Deck Fly','Chest',['Shoulders'],'gym',0,'Pec deck / fly machine','Set the handles so your arms start just behind the body line. Bring them together with soft elbows, then open slowly.','machine','Inner chest',null,'butterfly chest fly machine'],
 ['cablefly','Cable Crossover','Chest',['Shoulders'],'gym',1,'Cable station','Step forward from the cables with a slight lean. Sweep the hands together in an arc with soft elbows, then return slowly.','machine','Chest',null,'cable fly'],
 ['lowcablefly','Low-to-High Cable Fly','Chest',['Shoulders'],'gym',1,'Cable station (low pulleys)','Start with the handles low at your sides and sweep up to chest height in an arc. Lower slowly without shrugging.','machine','Upper chest'],
 ['smithbench','Smith Machine Bench Press','Chest',['Triceps','Shoulders'],'gym',0,'Smith machine + bench','Position the bench so the bar lowers to mid-chest. Set the safety stops, unhook, lower with control and press.','machine','Mid chest'],
 ['smithincline','Smith Machine Incline Press','Chest',['Shoulders','Triceps'],'gym',0,'Smith machine + incline bench','Set the bench at about 30°. Lower the bar to the upper chest with control and press. Use the safety stops.','machine','Upper chest'],
 ['dbbench','Dumbbell Bench Press','Chest',['Triceps','Shoulders'],'gym',0,'Dumbbells + flat bench','Lie on the bench with feet planted. Lower the dumbbells beside the chest, then press up and slightly together.','free','Mid chest',null,'flat'],
 ['dbincline','Incline Dumbbell Press','Chest',['Shoulders','Triceps'],'gym',0,'Dumbbells + incline bench','Set the bench at 30–45°. Lower the dumbbells to upper-chest level and press up without arching.','free','Upper chest'],
 ['inclinebench','Incline Barbell Bench Press','Chest',['Shoulders','Triceps'],'gym',1,'Barbell + incline bench','Lower the bar to the upper chest with control, then press. Use safeties or a spotter.','free','Upper chest'],
 ['declinebench','Decline Bench Press','Chest',['Triceps'],'gym',1,'Barbell + decline bench','Secure your legs, lower the bar to the lower chest and press. Use a spotter.','free','Lower chest'],
 ['dbfly','Dumbbell Fly','Chest',['Shoulders'],'gym',1,'Dumbbells + flat bench','With a slight bend in the elbows, open the arms in a wide arc to a comfortable stretch, then bring the weights back together.','free','Chest'],
 ['inclinepush','Incline Push-Up','Chest',['Triceps','Shoulders'],'bodyweight',0,'Bench or sturdy surface','Hands on a raised surface, body straight. Lower the chest towards it, then press away. A higher surface is easier.','free','Lower chest'],
 ['declinepush','Decline Push-Up','Chest',['Shoulders','Triceps'],'bodyweight',1,'Bench or step for your feet','Feet raised, body straight. Lower under control and press up without letting the hips sag.','free','Upper chest'],
 ['pullover','Dumbbell Pullover','Chest',['Back','Triceps'],'gym',1,'Dumbbell + bench','Hold one dumbbell over the chest with both hands. Lower it behind the head in a comfortable arc, then bring it back.','free','Chest & lats'],
 // Back
 ['closepulldown','Close-Grip Pulldown','Back',['Biceps'],'gym',0,'Cable pulldown + V-handle','Sit tall, pull the handle to the upper chest with the elbows close, then let it rise slowly.','machine','Lats',null,'v bar neutral grip'],
 ['cablerow','Seated Cable Row','Back',['Biceps'],'gym',0,'Cable row station','Sit tall with soft knees. Pull the handle to your stomach, squeezing the shoulder blades together, then return slowly without rounding.','machine','Mid back',null,'low row'],
 ['machinerow','Seated Machine Row','Back',['Biceps'],'gym',0,'Chest-supported row machine','Chest against the pad. Pull the handles back while squeezing the shoulder blades, then return with control.','machine','Mid back',null,'chest supported hammer strength'],
 ['tbarrow','T-Bar Row','Back',['Biceps'],'gym',1,'T-bar row machine','Brace your trunk and keep your chest on the pad if there is one. Pull the handles to your torso, then lower slowly.','machine','Mid back & lats',null,'landmine'],
 ['assistpull','Assisted Pull-Up','Back',['Biceps'],'gym',0,'Assisted pull-up machine','Kneel or stand on the pad; more counterweight makes it easier. Pull your chin over the bar, then lower slowly.','machine','Lats',null,'gravitron chin up'],
 ['straightpull','Straight-Arm Pulldown','Back',['Core'],'gym',0,'Cable station + bar or rope','With the arms nearly straight, sweep the bar down to the thighs using your back. Return slowly.','machine','Lats',null,'cable pullover'],
 ['backextmachine','Back Extension Machine','Back',['Legs'],'gym',0,'Seated back extension machine','Set a light load. Extend backwards from the hips through a comfortable range, then return slowly.','machine','Lower back',null,'lumbar'],
 ['bbrow','Barbell Bent-Over Row','Back',['Biceps','Core'],'gym',1,'Barbell','Hinge forward with a flat back and braced trunk. Pull the bar to your lower ribs, then lower with control.','free','Mid back & lats',null,'pendlay'],
 ['pullup','Pull-Up','Back',['Biceps','Core'],'gym',2,'Pull-up bar','Hang with an overhand grip. Pull until your chin passes the bar, then lower fully under control.','free','Lats',null,'chin bar'],
 ['chinup','Chin-Up','Back',['Biceps'],'gym',2,'Pull-up bar','Use an underhand grip about shoulder-width apart. Pull your chin over the bar and lower slowly.','free','Lats & biceps'],
 ['invrow','Inverted Row','Back',['Biceps','Core'],'gym',0,'Bar in a rack or Smith machine','Hang under a fixed bar with a straight body. Pull your chest to the bar, then lower. Walk your feet forward to make it easier.','free','Mid back',null,'australian pull up body row'],
 ['shrug','Dumbbell Shrug','Back',[],'dumbbells',0,'Dumbbells or barbell','Stand tall holding the weights. Lift the shoulders straight up towards the ears, pause, then lower.','free','Traps',null,'barbell trap'],
 ['hyperext','Back Extension','Back',['Legs'],'gym',0,'Hyperextension bench','Set the pad just below your hips. Lower the torso with a neutral spine, then rise to a straight line without over-arching.','free','Lower back',null,'hyperextension roman chair 45'],
 // Shoulders
 ['shouldermachine','Machine Shoulder Press','Shoulders',['Triceps'],'gym',0,'Shoulder press machine','Set the seat so the handles start at shoulder height. Press up without slamming the elbows straight, then lower slowly.','machine','Front delts',null,'overhead press'],
 ['smithohp','Smith Machine Shoulder Press','Shoulders',['Triceps'],'gym',1,'Smith machine + upright bench','Sit so the bar travels just in front of your face. Lower to chin level and press. Set the safety stops.','machine','Front delts',null,'overhead press'],
 ['cablelateral','Cable Lateral Raise','Shoulders',[],'gym',0,'Cable station (low pulley)','Stand side-on to the pulley. Raise the handle out to the side to shoulder height, then lower slowly.','machine','Side delts',null,'side raise'],
 ['lateralmachine','Lateral Raise Machine','Shoulders',[],'gym',0,'Lateral raise machine','Rest the pads on your outer arms. Raise to shoulder height without shrugging, then lower slowly.','machine','Side delts',null,'side raise'],
 ['reversepec','Reverse Pec Deck','Shoulders',['Back'],'gym',0,'Pec deck / fly machine','Face the pad with your arms forward. Open the arms back to shoulder line, squeezing the upper back, then return.','machine','Rear delts',null,'rear delt fly machine'],
 ['facepull','Face Pull','Shoulders',['Back'],'gym',0,'Cable station + rope','Set the pulley at upper-chest height. Pull the rope towards your face with hands apart and elbows high. Return slowly.','machine','Rear delts',null,'rope'],
 ['bbohp','Barbell Overhead Press','Shoulders',['Triceps','Core'],'gym',1,'Barbell + rack','Stand braced with the bar on the front of the shoulders. Press overhead, moving your head back slightly, and lower with control.','free','Front delts',null,'military press ohp standing'],
 ['arnold','Arnold Press','Shoulders',['Triceps'],'dumbbells',1,'Dumbbells','Start with palms facing you at shoulder height. Rotate the palms forward as you press up, and reverse on the way down.','free','Front & side delts'],
 ['frontraise','Front Raise','Shoulders',[],'dumbbells',0,'Dumbbells or plate','Raise the weight forward to shoulder height with soft elbows. Lower slowly without leaning back.','free','Front delts'],
 ['reardelt','Bent-Over Rear Delt Fly','Shoulders',['Back'],'dumbbells',0,'Dumbbells','Hinge forward with a flat back. Raise light weights out to the sides, leading with the elbows, then lower.','free','Rear delts',null,'reverse fly'],
 ['uprightrow','Upright Row','Shoulders',['Back'],'dumbbells',1,'Dumbbells or barbell','Lift the weights along the body to lower-chest height, elbows leading. Keep the range comfortable for your shoulders.','free','Side delts & traps'],
 // Biceps and forearms
 ['preachermachine','Machine Preacher Curl','Biceps',[],'gym',0,'Preacher curl machine','Upper arms flat on the pad. Curl the handles up, then lower slowly to nearly straight arms.','machine','Biceps'],
 ['cablecurl','Cable Curl','Biceps',[],'gym',0,'Cable station + straight bar','Stand close to the low pulley with elbows at your sides. Curl up, then lower slowly.','machine','Biceps'],
 ['cablehammer','Rope Hammer Curl','Biceps',[],'gym',0,'Cable station + rope','Hold the rope with palms facing each other and curl without moving the elbows. Lower slowly.','machine','Brachialis & forearms',null,'cable'],
 ['bbcurl','Barbell Curl','Biceps',[],'gym',0,'Barbell or EZ-bar','Stand tall with elbows by your sides. Curl the bar without swinging, then lower with control.','free','Biceps',null,'ez bar straight'],
 ['hammer','Hammer Curl','Biceps',[],'dumbbells',0,'Dumbbells','Palms face each other. Curl up keeping the elbows still, then lower slowly.','free','Brachialis & forearms'],
 ['inclinecurl','Incline Dumbbell Curl','Biceps',[],'gym',1,'Dumbbells + incline bench','Sit back on an incline bench with arms hanging. Curl without moving the upper arms, then lower fully.','free','Biceps (long head)'],
 ['concentration','Concentration Curl','Biceps',[],'dumbbells',0,'Dumbbell','Seated, brace the elbow against the inner thigh. Curl up slowly and lower all the way.','free','Biceps'],
 ['preacher','Preacher Curl','Biceps',[],'gym',0,'EZ-bar or dumbbell + preacher bench','Arms on the preacher pad. Curl up, then lower slowly without bouncing at the bottom.','free','Biceps (short head)',null,'ez bar'],
 ['wristcurl','Wrist Curl','Biceps',[],'dumbbells',0,'Dumbbells or barbell','Forearms resting on your thighs, palms up. Curl the wrists up, then lower slowly.','free','Forearms',null,'grip'],
 ['reversecurl','Reverse Curl','Biceps',[],'dumbbells',0,'Dumbbells or EZ-bar','Overhand grip with elbows at your sides. Curl up and lower slowly.','free','Forearms & brachialis',null,'grip'],
 // Triceps
 ['ropepushdown','Rope Pushdown','Triceps',[],'gym',0,'Cable station + rope','Elbows tucked at your sides. Push the rope down and slightly apart, then return slowly.','machine','Triceps (lateral head)',null,'cable pressdown'],
 ['overheadcable','Overhead Cable Extension','Triceps',[],'gym',1,'Cable station + rope','Face away from the pulley with the rope behind your head. Extend the arms forward and up, then bend slowly.','machine','Triceps (long head)'],
 ['tricepmachine','Triceps Dip Machine','Triceps',['Chest'],'gym',0,'Seated dip / triceps machine','Sit upright and press the handles down to straight arms. Return slowly without shrugging.','machine','Triceps',null,'seated dip extension'],
 ['assistdip','Assisted Dip','Triceps',['Chest','Shoulders'],'gym',0,'Assisted dip / pull-up machine','Kneel on the pad. Lower until your upper arms are about parallel or a comfortable depth, then press up.','machine','Triceps & lower chest',null,'gravitron'],
 ['skull','Skull Crusher','Triceps',[],'gym',1,'EZ-bar or dumbbells + bench','Lying down, lower the weight towards your forehead by bending only the elbows. Extend back up with control.','free','Triceps',null,'lying triceps extension'],
 ['cgbench','Close-Grip Bench Press','Triceps',['Chest','Shoulders'],'gym',1,'Barbell + bench','Grip about shoulder-width apart. Lower the bar to the lower chest with elbows close to the body, then press. Use safeties.','free','Triceps'],
 ['kickback','Dumbbell Kickback','Triceps',[],'dumbbells',0,'Dumbbell','Hinge forward with the upper arm by your side. Straighten the elbow behind you, pause, then lower.','free','Triceps'],
 ['dip','Bar Dip','Triceps',['Chest','Shoulders'],'gym',2,'Dip station','Support yourself on the bars. Lower to a comfortable depth with control, then press up. Try the assisted dip machine first if needed.','free','Triceps & lower chest',null,'parallel bars chest dips'],
 ['benchdip','Bench Dip','Triceps',['Shoulders'],'bodyweight',1,'Bench or sturdy chair','Hands on the edge behind you. Lower a short, comfortable distance, then press up. Bend the knees to make it easier.','free','Triceps'],
 // Legs and glutes
 ['hacksquat','Hack Squat','Legs',[],'gym',1,'Hack squat machine','Shoulders under the pads, feet mid-platform. Lower to a comfortable depth, then press up without locking the knees.','machine','Quads'],
 ['smithsquat','Smith Machine Squat','Legs',['Core'],'gym',0,'Smith machine','Set the safety stops. Place your feet slightly in front of the bar, sit down to a comfortable depth and stand up.','machine','Quads & glutes'],
 ['legext','Leg Extension','Legs',[],'gym',0,'Leg extension machine','Line your knee up with the machine pivot. Straighten your legs, pause, then lower slowly.','machine','Quads'],
 ['lyingcurl','Lying Leg Curl','Legs',[],'gym',0,'Lying leg curl machine','Pad just above your heels, hips down on the bench. Curl your heels towards you, then lower slowly.','machine','Hamstrings',null,'hamstring'],
 ['seatedcurl','Seated Leg Curl','Legs',[],'gym',0,'Seated leg curl machine','Knees in line with the pivot and the thigh pad snug. Curl down and back, then return slowly.','machine','Hamstrings',null,'hamstring'],
 ['abductor','Hip Abduction Machine','Legs',[],'gym',0,'Hip abduction machine','Sit upright and push the pads outwards with your knees. Return slowly without letting the weights crash.','machine','Outer glutes',null,'abductor outer thigh'],
 ['adductor','Hip Adduction Machine','Legs',[],'gym',0,'Hip adduction machine','Start at a comfortable stretch and squeeze the pads together. Open slowly.','machine','Inner thighs',null,'adductor'],
 ['hipthrustmachine','Hip Thrust Machine','Legs',[],'gym',0,'Hip thrust / glute drive machine','Belt or pad across the hips. Drive the hips up by squeezing your glutes, pause, then lower.','machine','Glutes',null,'glute drive'],
 ['glutekick','Cable Glute Kickback','Legs',[],'gym',0,'Cable station + ankle strap','Hold the frame and kick one leg back without arching the lower back. Return slowly, then switch legs.','machine','Glutes',null,'kick back'],
 ['pullthrough','Cable Pull-Through','Legs',['Back'],'gym',0,'Cable station + rope (low)','Face away from the pulley with the rope between your legs. Hinge back at the hips, then stand by squeezing the glutes.','machine','Glutes & hamstrings'],
 ['seatedcalf','Seated Calf Raise','Legs',[],'gym',0,'Seated calf raise machine','Pad on the lower thighs, balls of the feet on the step. Lower the heels, then rise high and pause.','machine','Calves (soleus)'],
 ['calfmachine','Standing Calf Raise Machine','Legs',[],'gym',0,'Standing calf machine','Shoulders under the pads. Lower the heels for a stretch, then rise onto your toes and pause.','machine','Calves'],
 ['smithsplit','Smith Machine Split Squat','Legs',['Core'],'gym',1,'Smith machine','Staggered stance under the bar. Lower the back knee towards the floor, then push up through the front foot.','machine','Quads & glutes',null,'lunge'],
 ['frontsquat','Front Squat','Legs',['Core','Back'],'gym',2,'Barbell + rack','Rest the bar on the front of the shoulders with elbows high. Squat to a comfortable depth with an upright chest. Set safeties.','free','Quads'],
 ['bbrdl','Romanian Deadlift','Legs',['Back'],'gym',1,'Barbell','Soft knees, push the hips back and slide the bar down the thighs until you feel the hamstrings. Stand tall with a flat back.','free','Hamstrings & glutes',null,'rdl stiff leg'],
 ['sumo','Sumo Deadlift','Legs',['Back','Core'],'gym',2,'Barbell','Wide stance, hands inside the knees. Push the floor away and keep the bar close as you stand. Learn with supervision.','free','Glutes & inner thighs'],
 ['trapbar','Trap Bar Deadlift','Legs',['Back','Core'],'gym',1,'Trap / hex bar','Stand inside the bar, hinge and grip the handles. Brace, stand up tall and lower with control.','free','Quads & glutes',null,'hex bar'],
 ['hipthrust','Barbell Hip Thrust','Legs',['Core'],'gym',1,'Barbell + bench + pad','Upper back on the bench, bar padded across the hips. Drive the hips up until level, pause, then lower.','free','Glutes'],
 ['walklunge','Walking Lunge','Legs',['Core'],'dumbbells',1,'Dumbbells (optional)','Step forward and lower both knees to a comfortable depth. Push through the front foot into the next step.','free','Quads & glutes'],
 ['bulgarian','Bulgarian Split Squat','Legs',['Core'],'dumbbells',1,'Bench or step (+ dumbbells optional)','Rear foot on a bench behind you. Lower the back knee towards the floor, then push up through the front foot.','free','Quads & glutes',null,'rear foot elevated'],
 ['stepup','Step-Up','Legs',['Core'],'bodyweight',0,'Box or sturdy step (+ dumbbells optional)','Place your whole foot on the step and stand up through that leg. Step down slowly, then switch legs.','free','Quads & glutes',null,'box step'],
 ['kbswing','Kettlebell Swing','Legs',['Back','Core'],'gym',1,'Kettlebell','Hinge (do not squat) to swing the bell back between your legs, then snap the hips forward so it floats to chest height.','free','Glutes & hamstrings'],
 ['goodmorning','Good Morning','Legs',['Back'],'gym',2,'Barbell + rack','Bar on the upper back, soft knees. Push the hips back with a flat back until you feel the hamstrings, then stand.','free','Hamstrings'],
 ['jumpsquat','Jump Squat','Legs',['Core'],'bodyweight',1,'None','Squat a little, then jump. Land softly through the whole foot and go straight into the next rep.','free','Quads & glutes',null,'plyometric'],
 ['boxjump','Box Jump','Legs',[],'gym',1,'Plyo box','Swing the arms and jump onto the box, landing softly in a squat. Step down rather than jumping down.','free','Power',null,'plyometric'],
 ['wallsit','Wall Sit','Legs',[],'bodyweight',0,'Wall','Back flat against a wall, slide down until the knees are at a comfortable bend. Hold and breathe steadily.','free','Quads','seconds'],
 // Core
 ['abmachine','Ab Crunch Machine','Core',[],'gym',0,'Ab crunch machine','Set a light load. Curl your ribs towards your hips, pause, then return slowly.','machine','Abs'],
 ['cablecrunch','Cable Crunch','Core',[],'gym',1,'Cable station + rope (high)','Kneel facing the pulley with the rope beside your head. Curl your ribs towards your hips without pulling with the arms.','machine','Abs',null,'kneeling'],
 ['woodchop','Cable Woodchop','Core',['Shoulders'],'gym',0,'Cable station','Rotate through the trunk to pull the handle diagonally across your body, then return with control.','machine','Obliques',null,'wood chop rotation'],
 ['pallof','Pallof Press','Core',[],'gym',0,'Cable station or band','Stand side-on to the cable. Press the handle straight out and hold without letting it twist you, then bring it back.','machine','Anti-rotation'],
 ['rotary','Rotary Torso Machine','Core',[],'gym',0,'Rotary torso machine','Set a light load and rotate slowly through a comfortable range. Train both sides.','machine','Obliques',null,'twist'],
 ['plank','Plank','Core',[],'bodyweight',0,'Floor','Forearms under the shoulders, body in a straight line from head to heels. Brace and breathe steadily.','free','Deep core','seconds'],
 ['sideplank','Side Plank','Core',[],'bodyweight',0,'Floor','Elbow under the shoulder, hips lifted in line with your body. Hold, then switch sides. Knees down to make it easier.','free','Obliques','seconds'],
 ['hollow','Hollow Body Hold','Core',[],'bodyweight',1,'Floor','Press the lower back to the floor and lift the shoulders and legs slightly. Bend the knees to make it easier.','free','Abs','seconds'],
 ['hangleg','Hanging Leg Raise','Core',[],'gym',2,'Pull-up bar','Hang with your shoulders engaged. Raise the legs or knees without swinging, then lower slowly.','free','Lower abs'],
 ['captain',"Captain's Chair Knee Raise",'Core',[],'gym',0,"Captain's chair / knee-raise station",'Back against the pad, forearms supported. Raise the knees towards the chest, then lower slowly.','free','Lower abs',null,'vkr vertical knee raise roman chair'],
 ['legraise','Lying Leg Raise','Core',[],'bodyweight',1,'Floor','Lie flat with hands under your hips. Raise straight or bent legs, then lower slowly without arching your back.','free','Lower abs'],
 ['situp','Sit-Up','Core',[],'bodyweight',0,'Floor or decline bench','Knees bent, feet anchored. Curl up to sitting without yanking the neck, then lower slowly.','free','Abs',null,'decline'],
 ['bicycle','Bicycle Crunch','Core',[],'bodyweight',0,'Floor','Bring each elbow towards the opposite knee while extending the other leg. Move slowly and keep breathing.','free','Obliques'],
 ['russian','Russian Twist','Core',[],'bodyweight',0,'Floor (+ plate optional)','Sit leaning back with a straight spine and rotate the shoulders side to side. Keep the feet down to make it easier.','free','Obliques'],
 ['mountain','Mountain Climber','Core',['Shoulders'],'bodyweight',0,'Floor','From a high plank, drive the knees towards the chest one at a time, keeping the hips level.','free','Abs'],
 ['abwheel','Ab Wheel Rollout','Core',['Shoulders'],'gym',2,'Ab wheel','Kneel and roll forward only as far as you can without your lower back sagging. Pull back with your abs.','free','Abs',null,'roller'],
 ['farmer',"Farmer's Carry",'Core',['Back'],'dumbbells',0,'Heavy dumbbells or kettlebells','Stand tall with a weight in each hand. Walk with short steps, shoulders down, without leaning.','free','Grip & core','seconds','farmers walk'],
 // Cardio
 ['treadmill','Treadmill','Cardio',['Legs'],'gym',0,'Treadmill','Start slowly and build up. Clip on the safety key, stay near the front and hold the rails only for balance.','machine','Walk, jog, run or incline walk','minutes','running jogging walking incline'],
 ['bike','Exercise Bike','Cardio',['Legs'],'gym',0,'Upright, recumbent or spin bike','Set the seat so your knee stays slightly bent at the bottom. Pedal smoothly and adjust resistance to your effort.','machine','Cycling','minutes','stationary spin cycling recumbent'],
 ['elliptical','Elliptical','Cardio',['Legs'],'gym',0,'Elliptical / cross trainer','Stand tall and push and pull the handles while striding smoothly. Adjust resistance for effort.','machine','Low-impact cardio','minutes','cross trainer'],
 ['rower','Rowing Machine','Cardio',['Back','Legs'],'gym',0,'Rowing machine (erg)','Push with the legs first, then lean back slightly and pull the handle to your lower ribs. Reverse the order to return.','machine','Full-body cardio','minutes','erg concept2'],
 ['stairs','Stair Climber','Cardio',['Legs'],'gym',0,'Stair climber / stepmill','Stand upright and step with the whole foot. Hold the rails lightly for balance only.','machine','Legs & cardio','minutes','stairmaster stepmill'],
 ['airbike','Air Bike','Cardio',['Legs','Shoulders'],'gym',0,'Air / fan bike','Push and pull the handles while pedalling. Resistance rises with your effort.','machine','Intervals','minutes','assault echo fan bike'],
 ['skierg','Ski Erg','Cardio',['Back','Core'],'gym',1,'Ski erg','Pull the handles down while hinging slightly at the hips, then let the arms rise as you stand tall.','machine','Full-body cardio','minutes'],
 ['jumprope','Jump Rope','Cardio',['Legs'],'bodyweight',0,'Skipping rope','Make small, quick jumps on the balls of the feet, turning the rope with your wrists.','free','Cardio','minutes','skipping'],
 ['burpee','Burpee','Cardio',['Legs','Chest'],'bodyweight',1,'None','Squat, place your hands down, step or jump back to a plank, return, then stand or jump. Step instead of jumping to make it easier.','free','Full body'],
 ['jumpingjack','Jumping Jacks','Cardio',[],'bodyweight',0,'None','Jump the feet out while raising the arms, then back in. Land softly.','free','Warm-up cardio'],
 ['battlerope','Battle Ropes','Cardio',['Shoulders','Core'],'gym',1,'Battle ropes','Soft knees and a braced trunk. Make waves by moving the arms quickly, resting between bursts.','free','Conditioning','seconds'],
 // Mobility: gentle stretches for warm-ups and cool-downs. Hold without bouncing; a stretch should never hurt.
 ['hipflexor','Hip Flexor Stretch','Mobility',['Legs'],'bodyweight',0,'Floor or mat','Kneel on one knee with the other foot in front. Tuck your hips under and shift forward gently until you feel a stretch at the front of the back hip. Switch sides.','free','Hip flexors','seconds','kneeling lunge stretch'],
 ['hamstring','Seated Hamstring Stretch','Mobility',['Legs'],'bodyweight',0,'Floor or mat','Sit with your legs straight. Keep your back long and hinge forward from the hips towards your toes until you feel a gentle stretch. Breathe slowly.','free','Hamstrings','seconds','forward fold toe touch'],
 ['catcow','Cat-Cow','Mobility',['Back','Core'],'bodyweight',0,'Floor or mat','On hands and knees, slowly round your back up (cat), then let it dip gently while lifting your chest (cow). Move with your breath.','free','Spine mobility','seconds','cat cow'],
 ['childpose',"Child's Pose",'Mobility',['Back','Shoulders'],'bodyweight',0,'Floor or mat','Kneel, sit back towards your heels and reach your arms forward along the floor. Relax your shoulders and breathe into your back.','free','Back & shoulders','seconds','childs pose yoga'],
 ['quadstretch','Standing Quad Stretch','Mobility',['Legs'],'bodyweight',0,'Wall for balance','Stand tall holding a wall. Bend one knee and hold the ankle behind you, knees together and hips slightly forward. Switch sides.','free','Quads','seconds','quad stretch'],
 ['worldsgreatest',"World's Greatest Stretch",'Mobility',['Legs','Back'],'bodyweight',0,'Floor','From a long lunge, place both hands inside the front foot, then rotate and reach one arm to the ceiling. Return and switch sides.','free','Hips & upper back','seconds','lunge rotation'],
 ['chestopener','Doorway Chest Stretch','Mobility',['Chest','Shoulders'],'bodyweight',0,'Door frame or wall','Rest your forearm on a door frame at shoulder height and gently turn your body away until you feel a stretch across the chest. Switch sides.','free','Chest & front shoulders','seconds','pec stretch']
 ];
 const types={machine:'Machine',free:'Own weight'};
 const units={reps:{short:'reps',label:'Reps',long:'reps'},seconds:{short:'sec',label:'Seconds',long:'seconds'},minutes:{short:'min',label:'Minutes',long:'minutes'}};
 const unitOf=u=>units[u]||units.reps;
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const exercises=raw.map(([id,name,muscle,secondary,equipment,difficulty,gear,instructions,type,target,unit,aliases])=>({id,name,muscle,secondary,equipment,difficulty,gear,instructions,type,target,unit:unit||'reps',search:' '+norm([name,muscle,target,gear,types[type],secondary.join(' '),aliases].join(' '))}));
 const byId=id=>exercises.find(e=>e.id===id);
 const groups=['Chest','Back','Shoulders','Biceps','Triceps','Legs','Core','Cardio','Mobility'];
 // Common spellings people type for the same thing.
 const synonyms={squad:'squat',squads:'squat',dumbell:'dumbbell',dumbells:'dumbbell',db:'dumbbell',bb:'barbell',kb:'kettlebell',abs:'core',ab:'core',pecs:'chest',hammies:'hamstring',delt:'delts'};
 // Every word must appear somewhere. Name matches rank first, then primary muscle/target matches, then muscle group and name.
 function search(query='',{type='all',muscle='all'}={}){const words=norm(query).split(' ').filter(Boolean).map(w=>synonyms[w]||w),all=s=>words.every(w=>norm(s).includes(w)),score=e=>all(e.name)?2:all(e.name+' '+e.muscle+' '+e.target)?1:0;
   return exercises.filter(e=>(type==='all'||e.type===type)&&(muscle==='all'||e.muscle===muscle)&&words.every(w=>e.search.includes(w))).sort((a,b)=>score(b)-score(a)||groups.indexOf(a.muscle)-groups.indexOf(b.muscle)||a.name.localeCompare(b.name))}
 const eligible=(e,p)=>p.equipment==='gym'||e.equipment==='bodyweight'||p.equipment===e.equipment;
 const plans={beginner:[['Full Body A','Legs','Chest','Back','Core','Shoulders'],['Full Body B','Back','Legs','Chest','Core','Triceps']],intermediate:[['Push Day','Chest','Shoulders','Triceps','Chest','Core','Shoulders'],['Pull Day','Back','Biceps','Back','Core','Shoulders'],['Leg Day','Legs','Legs','Core','Legs','Back']],advanced:[['Upper Emphasis','Chest','Back','Shoulders','Triceps','Biceps','Chest','Core'],['Lower Emphasis','Legs','Legs','Back','Core','Legs','Legs'],['Push Variation','Shoulders','Chest','Triceps','Chest','Shoulders','Core']]};
 function suggest(p,variant=0){const level=p.level||'beginner',plan=plans[level][variant%plans[level].length],max=level==='beginner'?0:level==='intermediate'?1:2;
   const count=Math.min(plan.length-1,Math.max(3,Math.floor(p.duration/15)+1)+(level==='advanced'?1:0)-(level==='beginner'?1:0)),chosen=[];
   for(const muscle of plan.slice(1)){const pool=exercises.filter(e=>e.muscle===muscle&&e.difficulty<=max&&eligible(e,p)&&!chosen.some(r=>r.id===e.id));if(!pool.length)continue;const e=pool[variant%pool.length];chosen.push({id:e.id,sets:level==='beginner'?2:level==='intermediate'?3:4,reps:e.unit==='seconds'?30:p.goal==='strength'?5:p.goal==='fitness'||p.goal==='loss'?12:8,unit:e.unit,weight:null});if(chosen.length>=count)break}
   return {name:plan[0],level,duration:p.duration,exercises:chosen};
 }
 const swaps=(id,p)=>exercises.filter(e=>e.id!==id&&e.muscle===byId(id)?.muscle&&eligible(e,p));
 const day=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 function streak(sessions,today=new Date()){const dates=new Set(sessions.filter(s=>s.status==='completed').map(s=>s.date));const d=new Date(today.getFullYear(),today.getMonth(),today.getDate());if(!dates.has(day(d)))d.setDate(d.getDate()-1);let count=0;while(dates.has(day(d))){count++;d.setDate(d.getDate()-1)}return count}
 // Epley: weight*(1+reps/30). Show only <=10 reps; never a max-attempt instruction.
 const estimated1RM=s=>s.weight>0&&s.reps<=10?Math.round(s.weight*(1+s.reps/30)*10)/10:null;
 function records(sets,sessions){const done=new Set(sessions.filter(s=>s.status==='completed').map(s=>s.id)),best={};for(const s of sets.filter(x=>done.has(x.session_id)&&(sessions.find(w=>w.id===x.session_id)?.data?.exercises?.find(e=>e.id===x.exercise_id)?.unit||'reps')==='reps')){const b=best[s.exercise_id];if(!b||s.weight>b.weight||s.weight===b.weight&&s.reps>b.reps)best[s.exercise_id]=s}return Object.values(best)}
 // Weekly review. Weeks run Monday–Sunday; only completed sessions count.
 const muscles=['Chest','Back','Shoulders','Biceps','Triceps','Legs','Core'];
 // Personal routines are free text, so their muscle is a keyword guess (first match wins); unmatched names stay unclassified.
 const keywords=[['Mobility',/stretch|yoga|mobility|cat-?cow|child'?s pose|foam roll/],['Cardio',/treadmill|elliptical|cross ?trainer|stair ?(climber|master)|stepmill|\bbike\b|cycling|\bspin\b|\bjog|\brun(ning)?\b|cardio|skipping|jump ?rope|rowing machine|\berg\b/],['Core',/plank|crunch|sit-?up|dead ?bug|hollow|leg raise|russian twist|\babs?\b|abdominal|\bcore\b|mountain climber/],['Triceps',/tricep|pushdown|skull|close-?grip|\bdips?\b/],['Shoulders',/shoulder|overhead|\bohp\b|military|arnold|lateral|front raise|rear delt|face pull|upright row|pike|delt/],['Legs',/squat|lunge|\blegs?\b|calf|calves|glute|hip thrust|bridge|hamstring|quad|\brdl\b|romanian|step-?up|split/],['Chest',/bench|chest|push-?up|press-?up|\bfly|flye|\bpec|incline|decline/],['Back',/\brows?\b|rowing|pull|\blats?\b|deadlift|chin-?up|\bback\b|shrug/],['Biceps',/bicep|curl|hammer/]];
 function muscleOf(id,name){const known=byId(id)||exercises.find(e=>e.name.toLowerCase()===String(name||'').trim().toLowerCase());if(known)return {muscle:known.muscle,secondary:known.secondary};const text=String(name||'').toLowerCase(),hit=keywords.find(([,re])=>re.test(text));return hit?{muscle:hit[0],secondary:[],guessed:true}:null}
 const parse=s=>{const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
 function weekStart(when=new Date()){const d=typeof when==='string'?parse(when):new Date(when.getFullYear(),when.getMonth(),when.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);return day(d)}
 function addDays(s,n){const d=parse(s);d.setDate(d.getDate()+n);return day(d)}
 function weekSummary(sessions,sets,start){const end=addDays(start,6),done=sessions.filter(s=>s.status==='completed'&&s.date>=start&&s.date<=end),ids=new Map(done.map(s=>[s.id,s]));
   const w={start,end,workouts:done.length,sets:0,reps:0,seconds:0,minutes:0,volume:0,primary:{},secondary:{},unclassified:0};
   for(const s of sets){const session=ids.get(s.session_id);if(!session)continue;const x=session.data?.exercises?.find(e=>e.id===s.exercise_id);w.sets++;
     if(x?.unit==='seconds')w.seconds+=s.reps;else if(x?.unit==='minutes')w.minutes+=s.reps;else{w.reps+=s.reps;w.volume+=s.weight*s.reps}
     const m=muscleOf(s.exercise_id,x?.name);if(!m){w.unclassified++;continue}w.primary[m.muscle]=(w.primary[m.muscle]||0)+1;for(const k of m.secondary)w.secondary[k]=(w.secondary[k]||0)+1}
   w.volume=Math.round(w.volume*10)/10;
   w.covered=muscles.filter(m=>w.primary[m]);w.partial=muscles.filter(m=>!w.primary[m]&&w.secondary[m]);w.missed=muscles.filter(m=>!w.primary[m]&&!w.secondary[m]);return w}
 // "More than last week" means more sets or more volume (kg × reps): either is progressive overload.
 function weekCompare(sessions,sets,today=new Date(),offset=0){const start=addDays(weekStart(today),offset*7),current=weekSummary(sessions,sets,start),previous=weekSummary(sessions,sets,addDays(start,-7));
   const metrics=['workouts','sets','reps','volume','seconds','minutes'].filter(k=>k==='workouts'||k==='sets'||current[k]||previous[k]).map(key=>({key,current:current[key],previous:previous[key],beaten:current[key]>previous[key]}));
   const beaten=current.sets>previous.sets||current.volume>previous.volume;
   return {current,previous,metrics,beaten,firstWeek:!previous.workouts,setsToBeat:beaten?0:previous.sets-current.sets+1}}
 function plates(total,bar,units='kg'){if(!Number.isFinite(total)||!Number.isFinite(bar)||total<bar||bar<0)throw Error('Target must be at least the bar weight.');let remainder=(total-bar)/2;const result=[];for(const size of units==='lb'?[45,35,25,10,5,2.5]:[25,20,15,10,5,2.5,1.25]){const count=Math.floor((remainder+1e-8)/size);if(count){result.push({size,count});remainder-=size*count}}return {plates:result,remainder:Math.round(remainder*200)/100}}
 g.GymRules={exercises,byId,types,unitOf,groups,search,eligible,suggest,swaps,day,streak,estimated1RM,records,plates,muscles,muscleOf,weekStart,weekSummary,weekCompare};
})(typeof window==='undefined'?globalThis:window);
