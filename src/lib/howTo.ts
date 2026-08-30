import type { ID } from '../types'

/**
 * How to actually do each movement.
 *
 * Written from published coaching material rather than from memory, so a
 * person who has never seen the programme can follow it without watching a
 * video first. Four things only: how to set up, how the rep goes, the mistake
 * that costs you, and why the exercise is in the programme at all.
 *
 * Keyed by catalog slug, so it is reference data rather than something stored
 * on your device. An exercise you invent yourself simply has none.
 */
export interface HowTo {
  setup: string
  execution: string
  mistake: string
  why: string
}

const HOW_TO: Record<ID, HowTo> = {
  'barbell-bench-press': {
    setup: 'Lie flat with your eyes under the bar, feet planted, shoulder blades pulled back and down into the bench, and take a grip a little wider than your shoulders with the thumbs wrapped',
    execution: 'Lower the bar over about 2 sec to the lower chest with the elbows tucked to roughly 45 degrees from the torso, touch without bouncing, then press up and slightly back toward the shoulders',
    mistake: 'Flaring the elbows straight out and touching high near the collarbone, which forces the shoulder into a position it does not like under load',
    why: 'It loads the whole chest, front delt and triceps under heavy weight, which is why it opens the day',
  },
  'incline-barbell-bench-press': {
    setup: 'Set the bench to about 30 degrees, plant your feet, pull the shoulder blades back and down, and grip slightly wider than your shoulders',
    execution: 'Lower the bar over 2 to 3 sec to just below the collarbone with the elbows at roughly 45 degrees, pause on the chest, then press back up and slightly toward your face',
    mistake: 'Setting the bench steeper than 45 degrees, which hands most of the work to the front delt instead of the upper chest',
    why: 'The raised angle biases the upper chest, which flat pressing trains less',
  },
  'barbell-larsen-press': {
    setup: 'Set up as you would for a bench press, then straighten your legs and hold your feet off the floor or rest them on a low box',
    execution: 'Lower the bar under control to the mid chest, pause about 1 sec, then press back to lockout with no leg drive at all',
    mistake: 'Chasing a big arch and squirming to stay balanced, which turns the set into a balancing act and forces the weight down',
    why: 'Taking the legs away strips the lift back to pure upper body pressing',
  },
  'standing-arnold-press': {
    setup: 'Stand with your feet about shoulder width, ribs down and core braced, holding the dumbbells at shoulder height with the palms facing you',
    execution: 'Press up while rotating the palms outward in one smooth motion so they face forward at the top, then reverse the rotation on the way down over about 2 sec',
    mistake: 'Splitting the rep into a rotation and then a press, which loses the arc that makes it an Arnold press',
    why: 'The rotation carries the delt through a longer path and works the front and side heads in one movement',
  },
  'machine-shoulder-press': {
    setup: 'Set the seat so the handles sit level with your shoulders and your elbows start just below shoulder height, back flat on the pad',
    execution: 'Press the handles up to near lockout without snapping the elbows straight, then lower over about 2 sec until the plates almost touch the stack',
    mistake: 'Setting the seat too low so the handles start above the shoulders, which cuts what you can press and moves the work to the traps',
    why: 'The fixed path lets you push close to failure with no balance demand, so it adds hard delt volume after free weight pressing',
  },
  'machine-lateral-raise': {
    setup: 'Adjust the seat so the pads sit just above your elbows with the upper arms hanging at your sides, chest against the pad',
    execution: 'Drive the elbows out and up until the upper arms reach about parallel to the floor, hold a beat, then lower over about 3 sec into a full stretch',
    mistake: 'Shrugging to finish the rep, which hands the work to the traps and leaves the side delt short',
    why: 'It isolates the side delt with steady resistance and almost no room to cheat, and the side delt is what adds width',
  },
  'plate-front-raise': {
    setup: 'Stand with your feet hip width and hold a plate at the 3 and 9 o\'clock positions with both hands, arms straight and the plate resting on your thighs',
    execution: 'Raise the plate in front of you with a slight elbow bend until it reaches eye level, pause a beat, then lower over about 2 to 3 sec',
    mistake: 'Leaning back and swinging the plate up, which loads the lower back and takes tension off the front delt',
    why: 'It trains the front delt through pure shoulder flexion, which pressing alone leaves incomplete',
  },
  'cross-body-cable-y-raise': {
    setup: 'Set a single pulley to about knee height, stand side on with the working arm furthest from the machine, and reach across your body to take the handle',
    execution: 'Sweep the arm up and out along a diagonal until the hand passes head height, then lower slowly back across the body into the stretch',
    mistake: 'Standing too close so the cable goes slack at the bottom, which loses the stretch that makes this version worth doing',
    why: 'Starting from across the body loads the side delt while it is long and through a longer arc than a plain lateral raise',
  },
  'reverse-pec-deck': {
    setup: 'Set the seat so the handles line up with your shoulders, sit facing the pad with your chest against it and a soft bend in the elbows',
    execution: 'Drive the elbows back and out in a wide arc until the upper arms reach the line of your torso, hold about 1 sec, then return slowly',
    mistake: 'Rocking the chest off the pad to move more weight, which swaps rear delt tension for momentum',
    why: 'It isolates the rear delt, which pressing and lateral raises barely reach',
  },
  'bent-over-cable-fly': {
    setup: 'Set two pulleys low, stand between them and cross the cables so each hand holds the opposite handle, then hinge to a torso angle near 45 degrees with a flat back',
    execution: 'Keep the elbows softly bent and fixed, open the arms out and back until the hands reach shoulder line, squeeze a beat, then let them cross back under control',
    mistake: 'Bending and pulling with the elbows, which turns the fly into a row and moves the load to the lats',
    why: 'Crossed cables hold tension on the rear delt through the whole arc, where a dumbbell version loses it',
  },
  'press-around': {
    setup: 'Set a single pulley to about chest height, take the handle in the hand nearest the machine, and turn away so your torso sits at roughly 45 degrees to the cable',
    execution: 'Press forward and across your body in one arc so the arm finishes past the midline, hold the squeeze about 1 sec, then return slowly into the stretch',
    mistake: 'Stopping the press at the midline, which cuts off the end of the arc where the chest is working hardest',
    why: 'It blends a press with a fly so the chest is loaded from a deep stretch into full contraction, a range barbell pressing never reaches',
  },
  'pec-stretch': {
    setup: 'Take the bottom of a fly with a light weight, or set your forearm flat on a door frame with the elbow at shoulder height and bent to 90 degrees',
    execution: 'Let the arm settle back until the stretch is strong but tolerable, then hold still and breathe for the prescribed time without shrugging or arching your back',
    mistake: 'Pushing into sharp pain at the front of the shoulder, which stresses the joint rather than lengthening the muscle',
    why: 'Long loaded stretches add a growth stimulus of their own and give back the range heavy pressing takes away',
  },
  'diamond-push-up': {
    setup: 'Put your hands together under your chest so the thumbs and index fingers form a triangle, body in a straight line from head to heels',
    execution: 'Lower your chest to your hands over about 2 sec with the elbows tracking close to your ribs, touch lightly, then press back to straight arms',
    mistake: 'Letting the hips sag or the elbows flare wide, which strains the lower back and moves the work off the triceps',
    why: 'The narrow hands force a deep elbow bend and a heavy triceps demand',
  },
  'squeeze-only-triceps-pressdown': {
    setup: 'Stand at a high pulley with your elbows pinned to your ribs and a small forward lean, starting with the forearms about parallel to the floor',
    execution: 'Press from there to full extension, squeeze about 1 sec, then come back up only to a right angle at the elbow before the next rep',
    mistake: 'Letting the elbows drift forward to help at the bottom, which takes the load off the triceps',
    why: 'Working only the contracted half keeps constant tension on the triceps and adds cheap volume after heavier pressing',
  },
  'stretch-only-overhead-triceps-extension': {
    setup: 'Set a low pulley with a rope behind you or hold one dumbbell in both hands, then press the arms overhead with the upper arms vertical and close to your head',
    execution: 'Lower your hands behind your head into a deep stretch over about 3 sec, then extend only about halfway back up before reversing',
    mistake: 'Letting the elbows flare and the upper arms drop forward, which loses the stretch the whole set is built on',
    why: 'Overhead lengthens the long head of the triceps, and training that stretched half drives more arm growth than pressdowns',
  },
  'lat-pulldown': {
    setup: 'Sit with your thighs locked under the pads and take an overhand grip a little wider than your shoulders, then set your torso upright with a lean back of 10 to 15 degrees',
    execution: 'Start the pull by driving your shoulder blades down before the elbows bend, pull your elbows toward your hip pockets until the bar reaches your upper chest, then take about 2 sec to let it rise back to a full stretch',
    mistake: 'Leaning far back and heaving with the torso, which turns the pulldown into a row and shifts load off the lats',
    why: 'It loads the lats through a long overhead range from a stable base, which is why it opens the day',
  },
  'half-kneeling-single-arm-lat-pulldown': {
    setup: 'Set a high pulley with a single handle and kneel side on close to the stack with the working side knee down, gripping the handle with that arm straight overhead',
    execution: 'Let the shoulder blade travel up at the top, then drive the elbow down toward your hip until the handle reaches your shoulder, hold 1 sec and return over about 2 sec',
    mistake: 'Twisting the torso or leaning away from the stack to move more weight, which hides a short range and turns the set into a trunk exercise',
    why: 'The kneeling base blocks cheating while one arm at a time gives each lat a longer stretch and a fuller contraction',
  },
  'omni-grip-chest-supported-row': {
    setup: 'Set the seat so the handles sit level with your mid chest and the pad supports you from sternum to stomach, then choose this set\'s grip working from wide overhand, to close neutral, to underhand',
    execution: 'Drive your elbows back and slightly down until the handles reach your waist and your shoulder blades meet, hold 1 sec, then lower over about 3 sec until the arms are straight',
    mistake: 'Pulling with the hands instead of the elbows, which lets the biceps take the set and leaves the mid back barely loaded',
    why: 'Chest support means more of your drive reaches the back itself, and changing grip across sets moves the emphasis around it',
  },
  'kroc-row': {
    setup: 'Brace your free hand on a bench with feet staggered and hips hinged so your torso sits near parallel to the floor, then take the heaviest dumbbell you can hold and use straps if your grip fails before your back does',
    execution: 'Row the dumbbell to your hip with the elbow tight to your side, keeping the first 10 to 15 reps strict and adding body drive only once fatigue forces it, and let the shoulder blade sag into a stretch at the bottom',
    mistake: 'Rounding the lower back or twisting hard through the spine, which loads the discs rather than the back',
    why: 'It piles heavy load and long sets onto the lats, traps and grip at once',
  },
  'pull-up': {
    setup: 'Take an overhand grip a little wider than your shoulders and hang with straight arms, then pull the ribs down, brace the abs and squeeze the glutes so the body hangs rigid',
    execution: 'Pull the shoulder blades down first, then drive the elbows down and back until your chin clears the bar, and take about 2 sec to lower into a full hang',
    mistake: 'Kipping with the legs and stopping short of a full hang, which cuts out the stretched part of the range where most of the growth is',
    why: 'It trains the lats through a full overhead range against your own weight',
  },
  'bottom-half-dumbbell-pullover': {
    setup: 'Lie along a flat bench holding one dumbbell by the inside of the top plate with both hands, pressed over your chest with the elbows softly bent and the ribs pulled down',
    execution: 'Lower the dumbbell behind your head over about 3 sec until you feel a hard lat stretch, then pull it up only until it enters your field of vision and go straight back down',
    mistake: 'Flaring the ribs and arching the lower back to reach further, which moves the stretch into the spine and off the lats',
    why: 'It loads the lats in a deep stretch that rows and pulldowns never reach, and the bottom half is where that stretch lives',
  },
  'lat-stretch': {
    setup: 'Hang from a pull-up bar with straight arms and a relaxed shoulder, or kneel facing a high pulley holding a bar with the arms straight overhead and the hips sitting back',
    execution: 'Let the load pull the shoulder blade up, keep the abs braced so the lower back stays flat, and hold that stretched position for the prescribed time while breathing steadily',
    mistake: 'Arching the lower back to chase more range, which swaps lat lengthening for lower back extension',
    why: 'Holding the lat long under load adds a stretch stimulus and overhead range for almost no extra fatigue',
  },
  'omni-directional-cable-face-pull': {
    setup: 'Attach a rope at face height for the first set, step back until the cable is under tension, and hold the ends with your thumbs pointing back and arms straight in front',
    execution: 'Pull the rope toward your forehead with the elbows at or above shoulder height while rotating your hands outward, hold 1 sec, return slowly, then run the later sets from a low pulley and a high pulley',
    mistake: 'Going too heavy so the elbows drop below shoulder height, which turns the movement into a row',
    why: 'It trains rear delts, mid traps and the rotator cuff across several angles, which balances all the pressing',
  },
  'cable-shrug-in': {
    setup: 'Stand between two low pulleys with a handle in each hand and let your arms hang long so the shoulders sink toward the floor under the load',
    execution: 'Shrug the shoulders up and back at once so the blades travel in toward your spine, hold the squeeze 1 sec, then let the weight draw the shoulders all the way back down',
    mistake: 'Shrugging straight up with the shoulders rolled forward, which keeps everything in the upper traps',
    why: 'It loads the blades moving up and in together under constant tension, which heavy rows tend to skip',
  },
  'ez-bar-biceps-curl': {
    setup: 'Stand with feet hip width and grip the angled part of the bar at about shoulder width, tucking your elbows lightly against your ribs',
    execution: 'Curl the bar up by bending the elbows only while the upper arms stay still, squeeze at the top, then lower over 2 to 3 sec until the arms are almost straight',
    mistake: 'Swinging the hips and letting the elbows drift forward, which turns the curl into a partial front raise',
    why: 'The angled bar lets you load both arms heavily with far less wrist and elbow strain than a straight bar',
  },
  'bottom-half-dumbbell-preacher-curl': {
    setup: 'Set the preacher pad so its top edge sits under your armpit and lay the back of your upper arm flat along it, holding a dumbbell with the arm hanging nearly straight',
    execution: 'Curl up only about halfway, then lower over 3 sec back into the deep stretch and go straight into the next rep without resting at the top',
    mistake: 'Lifting the elbow off the pad to finish the rep, which removes the stretched position the whole variation exists for',
    why: 'Training only the lengthened half grows the lower biceps at least as well as full range work, for less fatigue',
  },
  'overhead-cable-biceps-curl': {
    setup: 'Set a pulley at or just above shoulder height with a single handle, stand side on and step out until the cable is tight, then hold the handle with the arm straight out to the side, palm up',
    execution: 'Curl the handle toward your ear by bending the elbow alone, hold the squeeze 1 sec, then let the arm straighten over about 3 sec',
    mistake: 'Dropping the upper arm or turning toward the stack, which lets the shoulder pull the weight',
    why: 'The cable keeps tension on the biceps right through the top, where a dumbbell goes weightless',
  },
  'cross-body-triceps-extension': {
    setup: 'Set a pulley at head height with a single handle, stand side on to the stack and take the handle in the far hand so the cable crosses your chest',
    execution: 'Straighten the arm down and across your body toward the opposite hip, squeeze 1 sec at lockout, then bend the elbow back over about 2 sec with the upper arm pinned',
    mistake: 'Letting the elbow drift and swing, which turns the movement into a press and hands the load to the shoulder',
    why: 'The diagonal pull stays hard at lockout, filling out the outer sweep of the arm',
  },
  'floor-reset-skullcrusher': {
    setup: 'Lie flat on the floor with knees bent, holding an EZ bar at about shoulder width pressed over your face, loaded with small plates so the bar can reach the floor',
    execution: 'Bend the elbows to lower the bar over about 2 sec past your forehead until the plates rest on the floor, let it sit still for a beat, then press it back over your face',
    mistake: 'Bouncing the bar off the floor to launch the next rep, which feeds in a rebound and cancels the point of the reset',
    why: 'Pausing on the floor forces a strict extension out of the deepest stretch, which is where triceps grow most',
  },
  'squat': {
    setup: 'Set the safety pins just below your bottom position, wedge the bar across your upper back rather than your neck, then unrack, step back two or three paces and set your feet about shoulder width with the toes turned out slightly',
    execution: 'Take a big breath into your belly and brace as if about to take a punch, sit down and back with the knees tracking over the toes, go until the hip crease passes the knee, then drive up with the bar over your midfoot',
    mistake: 'Letting the lower back round and the pelvis tuck at the bottom, which shifts load off the legs and onto the spine',
    why: 'It loads the quads and glutes heavily through a long range under a deep stretch, which is why it anchors the day',
  },
  'paused-squat': {
    setup: 'Set up exactly as for a back squat, with the same bar position, stance, brace and safety pins, and take roughly 10 to 20% off your normal working weight',
    execution: 'Lower under control to your usual depth, hold dead still for 2 sec with the brace tight, then drive up without bouncing or letting your chest fall forward',
    mistake: 'Sinking and rebounding straight out of the hole, which restores the bounce and removes the entire point of the pause',
    why: 'The hold kills momentum and piles time under tension onto the hardest part of the rep',
  },
  'deadlift': {
    setup: 'Stand with your feet about hip width so the bar sits over your midfoot, grip just outside your legs, then drop your hips until your shins touch the bar with the chest lifted and the back flat',
    execution: 'Pull the slack out of the bar and brace hard before anything moves, then push the floor away and extend the hips and knees together so the bar rides up your legs in a straight line',
    mistake: 'Letting the lower back round to reach the bar, which moves the load off the hips and legs and onto the spine',
    why: 'It loads the glutes, hamstrings and whole back more heavily than any other lift',
  },
  'romanian-deadlift': {
    setup: 'Start standing tall with the bar at your hips in an overhand grip just outside the thighs, feet about hip width and the knees softly bent',
    execution: 'Push your hips straight back and let the bar slide down your thighs with the knee bend fixed, stop at a strong hamstring stretch around mid shin, then drive the hips forward to stand',
    mistake: 'Squatting the weight down or rounding the back to chase depth, which takes tension off the hamstrings and dumps it on the lower back',
    why: 'It trains the hamstrings and glutes through a long loaded stretch at the hip',
  },
  'stiff-leg-deadlift': {
    setup: 'Set up over a bar on the floor as for a deadlift but with the hips higher and the legs almost straight, gripping just outside the knees',
    execution: 'Keep the knees nearly locked, hinge at the hips to lower the bar to the floor on every rep, then push the floor away and squeeze your glutes to stand',
    mistake: 'Loading it like a conventional deadlift, since the straighter legs and longer range mean far less weight before the back rounds',
    why: 'The straighter legs put the hamstrings under the deepest stretch of any hinge',
  },
  'leg-press': {
    setup: 'Sit with your back and hips flat against the pad and place your feet about shoulder width in the middle of the platform, toes turned out a little',
    execution: 'Lower the sled slowly to about a right angle at the knee, or as deep as you can with your hips still on the pad, then press back without snapping the knees straight',
    mistake: 'Going so deep that the pelvis tucks and the lower back peels off the pad, which loads the spine under the whole sled',
    why: 'It hammers the quads and glutes with your torso supported, so you add leg volume without the lower back fatigue squats bring',
  },
  'leg-press-toe-press': {
    setup: 'Sit in the leg press with the safety catches engaged, then place only the balls of your feet on the bottom edge of the platform about hip width apart',
    execution: 'Keep a soft bend in the knees, push the platform away with your toes as far as the ankles will travel, hold a beat, then let the heels sink below the platform over about 2 sec',
    mistake: 'Short bouncy reps at the top, which lets the tendons move the sled and leaves the calves barely loaded',
    why: 'It loads the calves through a deep stretch with heavy weight and no balance demand',
  },
  'walking-lunge': {
    setup: 'Stand tall holding dumbbells at your sides, feet under your hips and core braced, with clear floor ahead of you',
    execution: 'Step forward far enough that both knees bend to about a right angle with the rear knee stopping just short of the floor, drive through the front heel to stand, then step straight into the next rep',
    mistake: 'Letting the front knee cave inward as you drive up, which strains the knee and takes tension off the glutes',
    why: 'It trains one leg at a time through a long range and exposes any side to side strength gap',
  },
  'seated-leg-curl': {
    setup: 'Sit with your back flat against the pad, line your knees up with the machine pivot, clamp the thigh pad down and set the roller just above your heels',
    execution: 'Curl your heels down and back as far as they go, squeeze a beat at the bottom, then let the legs straighten slowly over about 3 sec against the stack',
    mistake: 'Letting the hips lift off the seat to heave the weight, which cuts the range and pulls the stretch off the hamstrings',
    why: 'The bent hip keeps the hamstrings long throughout, and loading them long grows them more than the lying version',
  },
  'slow-eccentric-leg-extension': {
    setup: 'Sit with your hips pushed all the way back into the seat, align your knee with the machine pivot and set the pad just above your ankles',
    execution: 'Extend to full lockout and hold the squeeze a beat, then lower slowly over 3 to 4 sec without letting the stack touch down between reps',
    mistake: 'Letting the weight drop fast on the way down, which throws away the eccentric the whole variation exists for',
    why: 'It isolates the quads with no help from the hips, and the slow lowering adds the tension that drives growth',
  },
  'glute-ham-raise': {
    setup: 'Set the foot plate so your knees sit just behind the edge of the thigh pad, lock your ankles under the rollers and start upright',
    execution: 'Keep your hips straight so torso and thighs stay in one line, lower forward as slowly as you can until near parallel to the floor, then pull back up by driving your heels into the rollers',
    mistake: 'Folding at the hips on the way down, which turns it into a back extension and lets the hamstrings off',
    why: 'It loads the hamstrings at both the knee and the hip with a hard eccentric, which builds size and resilience',
  },
  'seated-calf-raise': {
    setup: 'Sit with your knees bent to about a right angle, set the pad snug across your lower thighs and place the balls of your feet on the platform with the heels free',
    execution: 'Release the catch and let the heels sink into a full stretch, hold about 1 sec at the bottom, then press up onto the toes and squeeze hard at the top',
    mistake: 'A short bouncy range that never reaches a real stretch, which turns the set into tendon rebound rather than muscle work',
    why: 'The bent knee takes the calf\'s larger head out of play so the soleus does the work, and it only grows from direct sets',
  },
  'decline-plate-crunch': {
    setup: 'Set a decline bench to a moderate angle, hook your feet under the pads and hold a plate across your chest',
    execution: 'Curl your ribs toward your hips to peel the shoulder blades off the bench, squeeze at the top, then lower over about 2 sec with your lower back staying down',
    mistake: 'Sitting all the way up, which hands the work to the hip flexors and arches the lower back off the bench',
    why: 'It adds load to spinal flexion, so the abs get overloaded the same way every other muscle does',
  },
  'roman-chair-leg-raise': {
    setup: 'Set your forearms on the pads and your back flat against the rest, grip the handles and hang with your legs straight and shoulders pressed down',
    execution: 'Tilt your pelvis backward first, then lift your legs together to at least parallel while curling the hips off the pad, and lower slowly without swinging',
    mistake: 'Swinging the legs up with the pelvis left neutral, which makes it a hip flexor exercise and leaves the abs barely working',
    why: 'Curling the pelvis loads the abs through real spinal flexion against the weight of your legs',
  },
}

export const howToFor = (exerciseId: ID): HowTo | null => HOW_TO[exerciseId] ?? null

/** Test seam: every movement the app can explain. */
export const explainedExercises = (): ID[] => Object.keys(HOW_TO)
