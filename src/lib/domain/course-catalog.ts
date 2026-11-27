/**
 * Mini-course catalogue. Content lives in code (versioned with the app);
 * the database only stores who unlocked what and their progress.
 * Lesson bodies use the same light Markdown as AI answers (paragraphs, "- " lists, **bold**).
 */

export type CourseQuestion = { prompt: string; options: string[]; answer: string };
export type Course = {
  id: string;
  title: string;
  summary: string;
  icon: "video" | "code" | "mic" | "heart-pulse" | "camera" | "piggy-bank";
  creditCost: number;
  minutes: number;
  skills: string[];
  lessons: { title: string; body: string }[];
  quiz: CourseQuestion[];
  note?: string;
};

export const COURSE_PASS_PCT = 70;
export const COURSE_COMPLETION_XP = 40;

export const COURSES: Course[] = [
  {
    id: "video-editing",
    title: "Video Editing Basics",
    summary: "Plan, cut and export a short video that keeps people watching.",
    icon: "video",
    creditCost: 30,
    minutes: 45,
    skills: ["Storytelling", "Editing", "Audio"],
    lessons: [
      {
        title: "Plan before you film",
        body: `Good edits start before recording. Write a one-sentence goal ("Show how our class cleaned the park in 60 seconds") and a short shot list.

- **Wide shot**: shows where you are.
- **Medium shot**: shows people and what they do.
- **Close-up**: shows detail and emotion.

Film each moment from at least two angles and hold every shot for 5–10 seconds, so you have material to choose from.`,
      },
      {
        title: "Cutting the story",
        body: `Import your clips and build a **rough cut** first: put the best take of each moment in order, ignoring polish.

- Cut on action (when someone moves) so changes feel natural.
- Remove anything that doesn't serve your one-sentence goal.
- Keep most shots between 2 and 6 seconds for short social videos.

Then refine: trim the start and end of each clip and check the rhythm by watching without stopping.`,
      },
      {
        title: "Sound, text and export",
        body: `Viewers forgive shaky images sooner than bad sound.

- Keep voices clearly louder than music; lower music under speech.
- Add captions: many people watch without sound.
- Use music you have the rights to (royalty-free libraries or your own).

Export in the format your platform expects. A common safe choice is **1080p, H.264 (MP4)**. Watch the exported file once before sharing.`,
      },
    ],
    quiz: [
      { prompt: "Which shot best shows the location of a scene?", options: ["Close-up", "Wide shot", "Over-exposed shot", "Freeze frame"], answer: "Wide shot" },
      { prompt: "What is a rough cut?", options: ["The final export", "A first assembly of the best takes in order", "A blurry clip", "The audio track only"], answer: "A first assembly of the best takes in order" },
      { prompt: "When should music be lowered?", options: ["Never", "Under speech", "Only at the end", "Only in close-ups"], answer: "Under speech" },
      { prompt: "Why add captions?", options: ["They increase file size", "Many people watch without sound", "They replace editing", "They are required for MP4"], answer: "Many people watch without sound" },
      { prompt: "A widely compatible export choice is…", options: ["1080p H.264 MP4", "RAW photos", "A ZIP of clips", "8K uncompressed"], answer: "1080p H.264 MP4" },
    ],
  },
  {
    id: "programming-basics",
    title: "Programming Basics",
    summary: "Variables, decisions, loops and functions, explained with tiny examples.",
    icon: "code",
    creditCost: 35,
    minutes: 60,
    skills: ["Logic", "Problem solving", "Python basics"],
    lessons: [
      {
        title: "Variables and data",
        body: `A program is a list of instructions. **Variables** are named boxes that hold values.

- \`age = 16\` stores a number.
- \`name = "Alex"\` stores text (a *string*).
- \`is_member = True\` stores a yes/no value (a *boolean*).

You can change a variable later: \`age = age + 1\` makes it 17. Choose clear names so your code explains itself.`,
      },
      {
        title: "Decisions and loops",
        body: `Programs make choices with **if** statements:

- \`if score >= 50: print("Passed") else: print("Try again")\`

They repeat work with **loops**:

- \`for i in range(3): print(i)\` prints 0, 1, 2.
- A \`while\` loop repeats as long as a condition stays true, so make sure it eventually becomes false, or it never stops.

Most bugs come from a condition that is slightly wrong (for example \`>\` instead of \`>=\`). Test the edge cases.`,
      },
      {
        title: "Functions and debugging",
        body: `A **function** packages steps you can reuse:

- \`def area(w, h): return w * h\`, then \`area(3, 4)\` gives 12.

When something breaks, debug calmly:

- Read the error message: it usually names the line.
- Print values to see what the program really holds.
- Change one thing at a time and re-run.

Small, tested steps beat writing everything at once.`,
      },
    ],
    quiz: [
      { prompt: "What does `name = \"Alex\"` store?", options: ["A number", "A string (text)", "A loop", "A function"], answer: "A string (text)" },
      { prompt: "What does `for i in range(3): print(i)` print?", options: ["1, 2, 3", "0, 1, 2", "3 only", "Nothing"], answer: "0, 1, 2" },
      { prompt: "What risk does a `while` loop have?", options: ["It can't use variables", "It may never stop if the condition stays true", "It only runs once", "It deletes data"], answer: "It may never stop if the condition stays true" },
      { prompt: "What does `area(3, 4)` return if `def area(w, h): return w * h`?", options: ["7", "12", "34", "An error"], answer: "12" },
      { prompt: "A good first step when debugging is…", options: ["Rewrite everything", "Read the error message", "Delete the function", "Ignore it"], answer: "Read the error message" },
    ],
  },
  {
    id: "public-speaking",
    title: "Public Speaking",
    summary: "Structure a talk, handle nerves and speak so people remember you.",
    icon: "mic",
    creditCost: 25,
    minutes: 40,
    skills: ["Communication", "Confidence", "Structure"],
    lessons: [
      {
        title: "Structure that sticks",
        body: `Audiences remember structure, not every word. A simple frame:

- **Hook**: a question, a surprising fact or a short story.
- **Three key points**: each with one example.
- **Close**: repeat the main message and say what you want people to do.

Write your main message in one sentence before anything else. If you can't, the talk isn't ready yet.`,
      },
      {
        title: "Nerves are normal",
        body: `Even experienced speakers feel nervous; the goal is to use that energy, not remove it.

- Rehearse out loud at least three times, once in front of someone.
- Slow breathing (in for 4, out for 6) calms your body before you start.
- Know your first 30 seconds by heart; the rest gets easier once you begin.

If you lose your place, pause, look at your notes and continue. Pauses feel longer to you than to the audience.`,
      },
      {
        title: "Delivery",
        body: `How you speak matters as much as what you say.

- Look at different people around the room, a few seconds each.
- Speak slightly slower than in conversation and vary your tone.
- Use gestures that match your words; keep your hands visible.
- Slides should support you: few words, large images, one idea per slide.

Finish on time. Respecting the audience's time builds trust.`,
      },
    ],
    quiz: [
      { prompt: "What should you be able to write before preparing the talk?", options: ["The slide colours", "Your main message in one sentence", "The audience's names", "A list of jokes"], answer: "Your main message in one sentence" },
      { prompt: "A strong opening is called a…", options: ["Hook", "Footer", "Loop", "Caption"], answer: "Hook" },
      { prompt: "What helps calm nerves before speaking?", options: ["Skipping rehearsal", "Slow breathing", "Speaking faster", "Reading every word"], answer: "Slow breathing" },
      { prompt: "If you lose your place, you should…", options: ["Apologise repeatedly", "Pause, check your notes and continue", "End the talk", "Start over"], answer: "Pause, check your notes and continue" },
      { prompt: "Good slides have…", options: ["Long paragraphs", "Few words and one idea each", "Tiny fonts", "Every detail of the talk"], answer: "Few words and one idea each" },
    ],
  },
  {
    id: "first-aid",
    title: "First Aid Essentials",
    summary: "Stay safe, call for help and give basic first aid until professionals arrive.",
    icon: "heart-pulse",
    creditCost: 30,
    minutes: 50,
    skills: ["Emergency response", "Calm under pressure", "Care"],
    note: "An introduction only. It does not replace a certified, hands-on first-aid course, which we strongly recommend.",
    lessons: [
      {
        title: "Danger, response, help",
        body: `In any emergency, follow the order that keeps everyone safe:

- **Danger**: check the scene. Don't become a second casualty (traffic, fire, electricity).
- **Response**: speak loudly and tap the shoulders: "Can you hear me?"
- **Help**: call the emergency number (**112** in Europe) or ask a specific person to call: "You, in the red jacket, call 112."

Put the phone on speaker; the dispatcher will guide you step by step.`,
      },
      {
        title: "Not breathing normally: CPR",
        body: `If the person is unresponsive and **not breathing normally**, start CPR and ask someone to bring an AED (defibrillator).

- Place the heel of your hand in the centre of the chest, other hand on top.
- Push hard and fast: about **5–6 cm deep**, **100–120 compressions per minute**.
- If trained, give **30 compressions then 2 rescue breaths**; if not, keep doing compressions only.
- Switch on the AED as soon as it arrives and follow its spoken instructions.

Keep going until help takes over or the person starts breathing normally.`,
      },
      {
        title: "Bleeding, burns and the recovery position",
        body: `- **Severe bleeding**: press firmly on the wound with a clean cloth and keep pressing. Add more cloth on top rather than removing soaked layers.
- **Burns**: cool under cool running water for **20 minutes**. Remove jewellery near the burn, don't use ice or butter, and cover loosely with cling film.
- **Unresponsive but breathing normally**: place them in the **recovery position** (on their side, top leg bent, head tilted back) so the airway stays open, and keep checking their breathing.

Always tell the professionals what happened and what you did.`,
      },
    ],
    quiz: [
      { prompt: "What is the first thing to check in an emergency?", options: ["Danger to you and others", "Their phone", "Their name", "The time"], answer: "Danger to you and others" },
      { prompt: "What is the emergency number across Europe?", options: ["911", "112", "999 only", "0800"], answer: "112" },
      { prompt: "Chest compressions should be about…", options: ["20 per minute", "100–120 per minute", "200 per minute", "As slow as possible"], answer: "100–120 per minute" },
      { prompt: "How long should a burn be cooled under running water?", options: ["10 seconds", "20 minutes", "Until it's numb with ice", "It shouldn't be cooled"], answer: "20 minutes" },
      { prompt: "Someone is unresponsive but breathing normally. You should…", options: ["Start CPR", "Put them in the recovery position and keep checking breathing", "Give them water", "Leave to find help without calling"], answer: "Put them in the recovery position and keep checking breathing" },
    ],
  },
  {
    id: "photography",
    title: "Photography Fundamentals",
    summary: "Light, composition and exposure for better photos on any camera or phone.",
    icon: "camera",
    creditCost: 25,
    minutes: 40,
    skills: ["Composition", "Light", "Visual storytelling"],
    lessons: [
      {
        title: "Composition",
        body: `Where you place things in the frame changes the whole photo.

- **Rule of thirds**: imagine a 3×3 grid; put important subjects on the lines or where they cross.
- **Leading lines**: roads, fences or rivers guide the eye to your subject.
- **Fill the frame**: step closer; most photos improve when you remove empty space.
- Check the edges and background for distractions before you shoot.`,
      },
      {
        title: "Light",
        body: `Photography is about light.

- **Golden hour** (just after sunrise and before sunset) gives soft, warm light.
- Midday sun creates harsh shadows; look for open shade.
- Side light shows texture; light behind the subject can create a silhouette.
- Indoors, turn the subject towards a window rather than using the flash.`,
      },
      {
        title: "Exposure",
        body: `Three settings control brightness, the **exposure triangle**:

- **Aperture** (f-number): a smaller f-number (like f/2) lets in more light and blurs the background.
- **Shutter speed**: fast speeds (1/1000 s) freeze motion; slow speeds blur it.
- **ISO**: higher ISO brightens the image but adds grain (noise).

On a phone, tap your subject to focus, then slide to adjust brightness. Take several shots and keep the best.`,
      },
    ],
    quiz: [
      { prompt: "The rule of thirds places subjects…", options: ["Always in the exact centre", "On the lines or intersections of a 3×3 grid", "At the very edge", "Upside down"], answer: "On the lines or intersections of a 3×3 grid" },
      { prompt: "When is golden hour?", options: ["Midday", "Just after sunrise and before sunset", "Midnight", "Any cloudy hour"], answer: "Just after sunrise and before sunset" },
      { prompt: "Which setting freezes fast motion?", options: ["A slow shutter speed", "A fast shutter speed", "Low battery", "A small image size"], answer: "A fast shutter speed" },
      { prompt: "A smaller f-number (e.g. f/2) gives…", options: ["Less light, sharper background", "More light and a blurrier background", "No change", "Black-and-white images"], answer: "More light and a blurrier background" },
      { prompt: "What is a side effect of high ISO?", options: ["Grain (noise)", "Sharper colours", "Longer battery life", "Less light"], answer: "Grain (noise)" },
    ],
  },
  {
    id: "financial-education",
    title: "Financial Education",
    summary: "Budgeting, saving, interest and avoiding scams with your first money.",
    icon: "piggy-bank",
    creditCost: 30,
    minutes: 45,
    skills: ["Budgeting", "Saving", "Online safety"],
    lessons: [
      {
        title: "Budgeting",
        body: `A budget is a plan for your money before you spend it.

- List your **income** (allowance, part-time job) and **expenses**.
- Separate **needs** (transport, food) from **wants** (games, eating out).
- A simple rule many people use: **50/30/20**, meaning 50% needs, 30% wants, 20% savings.

Track spending for one month; most people are surprised where their money goes.`,
      },
      {
        title: "Saving and interest",
        body: `Saving early gives your money time to grow.

- Build an **emergency fund** first, money for unexpected costs.
- **Interest** is what a bank pays you for saving, or what you pay when you borrow.
- **Compound interest** means you earn interest on previous interest. For example, 100 at 5% a year becomes 105 after one year and about 110.25 after two.

When borrowing, compare the total cost (the annual percentage rate), not only the monthly payment.`,
      },
      {
        title: "Spotting scams",
        body: `Scammers create urgency and offer what sounds too good to be true.

- Never share passwords, card details or one-time codes, not even with someone claiming to be your bank.
- Be suspicious of messages that say "act now", unusual links or prizes you didn't enter for.
- Check the sender and web address carefully; contact the company through its official app or number.

If something feels wrong, stop and ask a trusted adult before clicking or paying.`,
      },
    ],
    quiz: [
      { prompt: "In the 50/30/20 rule, what is the 20%?", options: ["Wants", "Needs", "Savings", "Taxes only"], answer: "Savings" },
      { prompt: "Which is a need rather than a want?", options: ["A new game", "Transport to school", "Eating out", "Concert tickets"], answer: "Transport to school" },
      { prompt: "100 saved at 5% compound interest is worth about how much after 2 years?", options: ["105", "110", "110.25", "200"], answer: "110.25" },
      { prompt: "What should you never share?", options: ["Your favourite colour", "One-time security codes", "Your school's name", "A public link"], answer: "One-time security codes" },
      { prompt: "A common sign of a scam is…", options: ["Pressure to act immediately", "A receipt you asked for", "A message from a friend you called", "A price tag in a shop"], answer: "Pressure to act immediately" },
    ],
  },
];

export const courseById = (id: string) => COURSES.find((c) => c.id === id);

/** Score a course quiz. Pure, so the server grades it and tests can check it. */
export function gradeCourseQuiz(course: Course, answers: string[]) {
  const correct = course.quiz.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  const pct = Math.round((correct / course.quiz.length) * 100);
  return { correct, total: course.quiz.length, pct, passed: pct >= COURSE_PASS_PCT };
}
