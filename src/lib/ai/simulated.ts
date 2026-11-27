import {
  datesMentioned,
  definitions,
  extractiveSummary,
  formulas,
  keywords,
  seededRandom,
  sentences,
  stem,
  terms,
} from "./text";
import type { AiProvider, GeneratedQuestion, HomeworkHelp, StudyPlan, Summary } from "./types";

/**
 * Simulated provider used when no AI credentials are configured.
 *
 * It is NOT a language model. It uses transparent, deterministic text
 * techniques (extractive summarisation, definition patterns, cloze
 * questions) over the real uploaded material, so demo mode stays
 * functional without pretending to be AI. Every output is labelled
 * "Simulated" in the UI and stored with origin = 'simulated'.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Pick the sentences from `text` that best overlap the query terms. */
function bestSentences(text: string, query: string, n: number): string[] {
  const q = new Set(terms(query));
  return sentences(text)
    .map((s, i) => ({ s, i, score: terms(s).filter((t) => q.has(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, n)
    .map((x) => x.s);
}

function cloze(sentence: string, keyword: string): string | null {
  const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*`, "i");
  if (!re.test(sentence)) return null;
  return sentence.replace(re, "_____");
}

export const simulatedProvider: AiProvider = {
  id: "simulated",
  label: "Simulated (rule-based, no AI model)",
  simulated: true,

  async *tutor(input) {
    const parts: string[] = [];
    if (input.grounded && input.sources.length) {
      const joined = input.sources.map((s) => s.content).join(" ");
      const picked = bestSentences(joined, input.question, input.level === "advanced" ? 5 : 3);
      parts.push(`Here is what your lesson materials say about this:`);
      picked.forEach((s) => {
        const idx = input.sources.findIndex((src) => src.content.includes(s.slice(0, 40)));
        parts.push(`- ${s} [S${idx >= 0 ? idx + 1 : 1}]`);
      });
      if (input.level === "simpler") {
        parts.push(`\nIn short: focus on the key words above and try to explain them back in your own words.`);
      }
      parts.push(`\nTry this: close your notes and write one sentence that answers “${input.question.slice(0, 80)}”. Then compare it with the passages above.`);
    } else {
      parts.push(
        `I couldn't find this topic in the lesson materials you have access to, so I won't pretend it's in your lessons.`,
        ``,
        `Simulation mode can only quote uploaded materials — it can't answer from general knowledge. Try asking about a topic from your class documents, or ask your teacher to upload the lesson. Load the free on-device AI (button at the top of the page, needs Chrome or Edge with WebGPU) and the tutor can also chat normally and explain topics beyond your materials (clearly marked).`,
      );
    }
    const text = parts.join("\n");
    // Stream in small pieces so the UI behaves like a live response.
    for (const piece of text.match(/.{1,24}(\s|$)/gs) ?? [text]) {
      await sleep(12);
      yield piece;
    }
  },

  async summarize(text, title, opts): Promise<Summary> {
    const n = opts.length === "concise" ? 5 : 10;
    const points = extractiveSummary(text, n + 2);
    const defs = definitions(text).slice(0, opts.length === "concise" ? 4 : 8);
    const kw = keywords(text, 8);
    return {
      title,
      overview: points.slice(0, opts.length === "concise" ? 2 : 3).join(" "),
      keyPoints: points.slice(opts.length === "concise" ? 2 : 3, 2 + n),
      keyConcepts: kw.slice(0, 6).map((k) => ({
        term: k.charAt(0).toUpperCase() + k.slice(1),
        explanation: bestSentences(text, k, 1)[0] ?? "Appears frequently in the material.",
      })),
      definitions: defs.map((d) => ({ term: d.term, definition: d.definition })),
      formulas: formulas(text).slice(0, 8),
      importantDates: datesMentioned(text),
    };
  },

  async flashcards(text, title, count) {
    const cards: { front: string; back: string }[] = [];
    const seen = new Set<string>();
    for (const d of definitions(text)) {
      const key = stem(d.term.toLowerCase());
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push({ front: `What is ${d.term.toLowerCase().startsWith("the ") ? d.term : d.term}?`, back: d.sentence });
      if (cards.length >= count) return cards;
    }
    for (const f of formulas(text)) {
      cards.push({ front: `Complete the formula from “${title}”: ${f.split("=")[0]!.trim()} = ?`, back: f });
      if (cards.length >= count) return cards;
    }
    for (const k of keywords(text, count * 2)) {
      const s = bestSentences(text, k, 1)[0];
      const front = s && cloze(s, k);
      if (!s || !front || seen.has(stem(k))) continue;
      seen.add(stem(k));
      cards.push({ front: `Fill the gap: ${front}`, back: `${k} — ${s}` });
      if (cards.length >= count) break;
    }
    return cards;
  },

  async quiz(text, title, opts) {
    const rand = seededRandom(title + opts.difficulty + opts.count);
    const kws = keywords(text, 30);
    const sents = sentences(text);
    const questions: GeneratedQuestion[] = [];
    const used = new Set<string>();
    const types = opts.types.length ? opts.types : (["mcq"] as const);
    let t = 0;
    for (const s of shuffle(sents, rand)) {
      if (questions.length >= opts.count) break;
      const type = types[t % types.length]!;
      const kw = kws.find((k) => !used.has(k) && new RegExp(`\\b${k}`, "i").test(s));
      if (!kw) continue;
      const blanked = cloze(s, kw);
      if (!blanked) continue;
      used.add(kw);
      t++;
      const topic = kw.charAt(0).toUpperCase() + kw.slice(1);
      if (type === "mcq") {
        const distractors = shuffle(kws.filter((k) => k !== kw && stem(k) !== stem(kw)), rand).slice(0, 3);
        if (distractors.length < 3) continue;
        const options = shuffle([kw, ...distractors], rand);
        questions.push({ type, prompt: `Which word completes the sentence? “${blanked}”`, options, answer: kw, explanation: `From the material: “${s}”`, topic });
      } else if (type === "true_false") {
        const makeFalse = rand() < 0.5;
        const swap = kws.find((k) => k !== kw && stem(k) !== stem(kw));
        const statement = makeFalse && swap ? s.replace(new RegExp(`\\b${kw}\\w*`, "i"), swap) : s;
        questions.push({
          type,
          prompt: `True or false: “${statement}”`,
          options: ["True", "False"],
          answer: makeFalse && swap ? "False" : "True",
          explanation: makeFalse && swap ? `The material says: “${s}”` : `This is stated in the material.`,
          topic,
        });
      } else {
        questions.push({ type, prompt: `Fill in the missing word: “${blanked}”`, options: [], answer: kw, explanation: `From the material: “${s}”`, topic });
      }
    }
    return questions;
  },

  async studyPlan(input): Promise<StudyPlan> {
    const ranked = [...input.subjects].sort((a, b) => (a.average ?? 10) + (a.trend ?? 0) - ((b.average ?? 10) + (b.trend ?? 0)));
    const focus = ranked.slice(0, Math.max(2, Math.min(3, ranked.length)));
    const days = Array.from({ length: input.days }, (_, i) => {
      const s = focus[i % focus.length]!;
      const material = input.materials.find((m) => m.subject === s.name);
      const half = Math.max(10, Math.round(input.minutesPerDay / 2));
      return {
        day: `Day ${i + 1}`,
        focus: s.name,
        tasks: [
          { activity: material ? `Read summary: ${material.title}` : `Re-read your ${s.name} notes`, minutes: half, why: s.upcoming.length ? `Prepares for: ${s.upcoming[0]}` : "Refreshes recent material" },
          { activity: material ? `Practice quiz: ${material.title}` : `Review ${s.name} flashcards`, minutes: input.minutesPerDay - half, why: "Active recall helps you remember for longer" },
        ],
      };
    });
    return {
      intro: `A ${input.days}-day plan with about ${input.minutesPerDay} minutes a day, built from your recent grades, upcoming assessments and available class materials.`,
      days,
      note: "This plan is a suggestion, not an assessment of your abilities. Adjust it to fit your week, and take breaks.",
    };
  },

  async homework(question, context, level): Promise<HomeworkHelp> {
    const joined = context.map((c) => c.content).join(" ");
    const related = joined ? bestSentences(joined, question, 3) : [];
    const kw = keywords(question + " " + related.join(" "), 4);
    const isMath = /[0-9]\s*[-+*/=^]|equation|solve|calculate|x\s*=|\bx\b/i.test(question);
    const steps = isMath
      ? [
          { title: "Write down what you know", guidance: "List the given values and what you are asked to find. Name the unknown (e.g. x).", check: "Can you say in one sentence what the answer should represent?" },
          { title: "Choose the method", guidance: related[0] ? `Your lesson says: “${related[0]}”` : "Find the rule or formula from your lesson that links the known values to the unknown.", check: "Does the formula use exactly the quantities you listed?" },
          { title: "Apply it step by step", guidance: "Do one operation per line and keep both sides of an equation balanced.", check: "Did you do the same operation to both sides?" },
          { title: "Check your answer", guidance: "Substitute your result back into the original problem.", check: "Does the check give a true statement?" },
        ]
      : [
          { title: "Understand the question", guidance: "Underline the command word (explain, compare, describe…) and the topic.", check: "What exactly is being asked?" },
          { title: "Gather evidence", guidance: related.length ? related.map((r) => `• ${r}`).join(" ") : "Look for the relevant section in your notes or lesson materials.", check: "Which facts support your answer?" },
          { title: "Plan your answer", guidance: "Write a one-line answer, then add 2–3 supporting points with evidence.", check: "Does each point link back to the question?" },
        ];
    return {
      understanding: `This question asks you to work with: ${kw.join(", ") || "the topic in the question"}. ${level === "simpler" ? "Take it one small step at a time." : ""}`.trim(),
      concepts: kw,
      steps,
      finalHint: "Try the last step yourself, then compare with a classmate or ask your teacher to check your reasoning.",
      selfCheck: "Could you explain your method to someone else without looking at your notes?",
    };
  },

  /** Template letter built only from the provided facts; the teacher edits it before signing. */
  async recommendation(r) {
    const purpose = { university: "their university application", scholarship: "this scholarship", volunteering: "your volunteering programme", course: "accreditation of their course work" }[r.purpose];
    const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
    const paras = [
      `Dear ${r.recipient || "Admissions Committee"},`,
      `I am pleased to recommend [Student] for ${purpose}. As their ${r.teacherRole}, I have known [Student] for about ${r.monthsKnown} months and have followed their progress closely.`,
    ];
    if (r.totalHours > 0) {
      paras.push(
        `[Student] has completed ${r.totalHours} hours of volunteering verified by our teachers, including ${list(r.volunteering.slice(0, 3).map((v) => v.title))}. These activities show a reliable commitment to their school and community.`,
      );
    }
    if (r.courses.length || r.projects.length) {
      const bits = [
        r.courses.length ? `completed the ${list(r.courses)} course${r.courses.length > 1 ? "s" : ""}` : "",
        r.projects.length ? `worked on ${list(r.projects.slice(0, 3).map((p) => `“${p.title}”`))}` : "",
      ].filter(Boolean);
      paras.push(`Beyond the classroom, [Student] has ${bits.join(" and ")}, showing curiosity and the initiative to build new skills.`);
    }
    if (r.course) {
      paras.push(
        `I reviewed and approved the course “${r.course.title}” before [Student] began it. [Student] worked through all ${r.course.lessons.length} lessons${r.course.score != null ? ` and passed the final assessment with ${r.course.score}%` : ""}, building skills in ${list(r.course.skills)}.`,
      );
    }
    if (r.badges.length) paras.push(`Within our school's learning platform, [Student] earned recognition such as ${list(r.badges.slice(0, 4))}.`);
    const strong = [r.average != null && r.average >= 8 ? `an overall average of ${r.average} out of 10` : "", r.attendancePct != null && r.attendancePct >= 95 ? `attendance of ${r.attendancePct}%` : ""].filter(Boolean);
    if (strong.length) paras.push(`Academically, [Student] maintains ${list(strong)}.`);
    paras.push(`I recommend [Student] without reservation and would be glad to answer any questions.`, "Sincerely,");
    return paras.join("\n\n");
  },

  /** Rule-based Irbis for demo mode: picks a reply by intent and fills it from the student context. */
  async *companion({ message, context: c }) {
    const m = message.toLowerCase();
    const next = c.homework.find((h) => h.overdue) ?? c.homework[0];
    let text: string;
    if (/stress|anxious|nervous|scared|worried|overwhelm|panic|sad|tired|can'?t cope/.test(m)) {
      text = `That sounds heavy, ${c.firstName}. Let's take one ledge at a time: breathe in for 4, out for 6, three times. Then pick just one small thing for the next 15 minutes${next ? `, maybe the first step of “${next.title}”` : ""}. If it keeps feeling this hard, talk to someone you trust, like your homeroom teacher or the school counsellor.`;
    } else if (/plan|evening|tonight|today|what should|next|start/.test(m)) {
      const steps = [
        next ? `25 min: start “${next.title}” (${next.subject}), ${next.overdue ? "it's overdue, so it goes first" : `due ${next.due}`}.` : "25 min: review today's lessons with Flashcards.",
        "5 min break: stretch, water, no phone.",
        c.course ? `20 min: next lesson of “${c.course.title}” (${c.course.lessonsDone}/${c.course.lessons} done).` : "20 min: a short quiz in Quizzes to check what stuck.",
        c.nextClass ? `5 min: glance at your notes for ${c.nextClass.subject} (${c.nextClass.when}).` : "5 min: write down one thing you learned today.",
      ];
      text = `Here's a calm plan, ${c.firstName}:\n- ${steps.join("\n- ")}`;
    } else if (/motivat|lazy|bored|give up|don'?t want|procrastinat/.test(m)) {
      text = c.streakDays > 0
        ? `You're on a ${c.streakDays}-day streak, ${c.firstName}. Snow leopards don't climb the whole mountain at once, just the next ledge. Set a 10-minute timer and start; you can stop after that if you want (you probably won't). 🐾`
        : `Every streak starts with day one, ${c.firstName}. Set a 10-minute timer and do the smallest piece you can think of. That's today's ledge. 🐾`;
    } else if (/homework|due|deadline/.test(m)) {
      text = c.homework.length
        ? `You have ${c.homework.length} thing${c.homework.length > 1 ? "s" : ""} on your list. ${next ? `I'd start with “${next.title}” (${next.subject}).` : ""} Open Homework to see the details, and ask the AI Study tutor if a step is unclear.`
        : `Nothing due right now, ${c.firstName}. A good moment to get ahead with a quick Flashcards round. 🐾`;
    } else if (/^(hi|hey|hello|salut|buna|bună)\b/.test(m)) {
      text = `*paw wave* Hi ${c.firstName}! ${c.activeToday ? "Nice, you've already studied today." : "Want to plan a short study session?"}`;
    } else {
      text = `I'm Irbis, your study companion. I can plan your study time, help you get started when it's hard, or point you to the right tool. For full explanations of a topic, the AI Study tutor is best. Demo mode runs without an AI model, so my answers here are simple.`;
    }
    for (const piece of text.match(/.{1,24}(\s|$)/gs) ?? [text]) {
      await sleep(14);
      yield piece;
    }
  },

  /** Generic study-skills template (demo mode without a cloud key); the teacher reviews it like any other. */
  async course(topic) {
    const t = topic.trim().replace(/^./, (c) => c.toUpperCase());
    return {
      title: `Introduction to ${t}`,
      summary: `A short starter course on ${t.toLowerCase()}: the key ideas, how to practise, and how to keep improving.`,
      skills: [t.slice(0, 40), "Self-directed learning", "Reflection"],
      lessons: [
        { title: "What it is and why it matters", body: `This course introduces **${t}**. Start by writing one sentence about what you want to be able to do by the end.\n\n- Find two reliable sources (a textbook, a teacher, an official organisation).\n- Note the five words or ideas that appear in both.\n- Ask your reviewing teacher which ones matter most.` },
        { title: "Practise in small steps", body: `Skills grow through short, regular practice rather than one long session.\n\n- Practise for 15 minutes, three times this week.\n- After each session, write down one thing that went well and one thing to improve.\n- If you can, practise with a classmate and give each other feedback.` },
        { title: "Show what you learned", body: `Finish by producing something you can show: a short presentation, a demonstration or a one-page summary.\n\n- Explain the topic to someone who doesn't know it.\n- Compare your result with your goal from lesson 1.\n- Plan your next step to keep improving.` },
      ],
      quiz: [
        { prompt: "What should you write at the start of the course?", options: ["A goal for what you want to be able to do", "A list of excuses", "Nothing", "Your exam timetable"], answer: "A goal for what you want to be able to do" },
        { prompt: "How do skills grow best?", options: ["Short, regular practice", "One very long session", "Only reading", "Waiting"], answer: "Short, regular practice" },
        { prompt: "How many reliable sources does lesson 1 suggest finding?", options: ["Two", "None", "Ten", "One random website"], answer: "Two" },
        { prompt: "What helps after each practice session?", options: ["Noting what went well and what to improve", "Deleting your notes", "Skipping feedback", "Practising less"], answer: "Noting what went well and what to improve" },
        { prompt: "What is a good way to show what you learned?", options: ["Explain the topic to someone else", "Keep it secret", "Copy a classmate", "Forget the goal"], answer: "Explain the topic to someone else" },
      ],
    };
  },
};
