import { chunkText } from "../../documents/chunk";
import { DEFAULT_SETTINGS } from "../../domain/admin";
import { ACHIEVEMENT_RULES } from "../../domain/gamification";
import { COURSE_COMPLETION_XP, courseById } from "../../domain/course-catalog";
import { issueCredential } from "../../domain/credentials";
import { addProject, verifyProject } from "../../domain/passport";
import { runDetection } from "../../domain/support";
import { addDays, isoDate, isoWeekKey, startOfWeek, weekday } from "../../utils/dates";
import type { Db } from "../client";
import { migrate } from "../client";
import { FLASHCARD_SETS, LESSONS, QUIZZES } from "./content";

/**
 * Demo-mode seed. Everything created here belongs to a fictional demo
 * school, uses `*.example` email addresses and is flagged `is_demo = 1`.
 * Volunteering organisers and schools are fictional samples.
 * Dates are generated relative to "now" so the demo always looks current.
 */

export const DEMO_SCHOOL_ID = "sch_demo";

// ── Deterministic randomness ────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stamp = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);

// ── Reference data ──────────────────────────────────────────────────────────
const SUBJECTS = [
  { id: "sub_mat", name: "Mathematics", short: "MAT", color: "#FFD34D", icon: "sigma", weekly: 5, room: "Room 12", teacher: "novak" },
  { id: "sub_eng", name: "English Literature", short: "ENG", color: "#8CC8FF", icon: "book-open", weekly: 4, room: "Room 4", teacher: "weber" },
  { id: "sub_phy", name: "Physics", short: "PHY", color: "#9B8CFF", icon: "atom", weekly: 4, room: "Lab 1", teacher: "okafor" },
  { id: "sub_bio", name: "Biology", short: "BIO", color: "#7FE0B5", icon: "leaf", weekly: 4, room: "Lab 2", teacher: "raman" },
  { id: "sub_che", name: "Chemistry", short: "CHE", color: "#FF8A3D", icon: "flask-conical", weekly: 4, room: "Lab 3", teacher: "haddad" },
  { id: "sub_his", name: "History", short: "HIS", color: "#FFB347", icon: "landmark", weekly: 3, room: "Room 7", teacher: "herrera" },
  { id: "sub_geo", name: "Geography", short: "GEO", color: "#FF8F8F", icon: "globe", weekly: 3, room: "Room 8", teacher: "herrera" },
  { id: "sub_cs", name: "Computer Science", short: "CS", color: "#C9C1FF", icon: "cpu", weekly: 3, room: "IT Suite", teacher: "sato" },
] as const;

const subjectByShort = (short: string) => SUBJECTS.find((s) => s.short === short)!;

const TEACHERS = [
  { key: "novak", name: "Elena Novak", title: "Mathematics teacher", hue: 45 },
  { key: "okafor", name: "David Okafor", title: "Physics teacher", hue: 250 },
  { key: "raman", name: "Priya Raman", title: "Biology teacher", hue: 150 },
  { key: "haddad", name: "Amira Haddad", title: "Chemistry teacher", hue: 18 },
  { key: "herrera", name: "Tomás Herrera", title: "History & Geography teacher", hue: 32 },
  { key: "weber", name: "Hannah Weber", title: "English teacher", hue: 205 },
  { key: "sato", name: "Kenji Sato", title: "Computer Science teacher", hue: 280 },
];

const CLASSES = [
  { key: "10A", id: "cls_10a", grade: 10, homeroom: "novak" },
  { key: "10B", id: "cls_10b", grade: 10, homeroom: "weber" },
  { key: "11A", id: "cls_11a", grade: 11, homeroom: "okafor" },
] as const;

type Profile = "alex" | "decline" | "attendance" | "disengaged" | "normal";

const STUDENTS: { key: string; name: string; cls: "10A" | "10B" | "11A"; profile?: Profile }[] = [
  { key: "alex", name: "Alex Rivera", cls: "10A", profile: "alex" },
  { key: "maya", name: "Maya Chen", cls: "10A" },
  { key: "jordan", name: "Jordan Miles", cls: "10A", profile: "decline" },
  { key: "sofia", name: "Sofia Moreau", cls: "10A" },
  { key: "ethan", name: "Ethan Brooks", cls: "10A" },
  { key: "amara", name: "Amara Okoye", cls: "10A" },
  { key: "lucas", name: "Lucas Ferreira", cls: "10A" },
  { key: "hana", name: "Hana Kim", cls: "10A" },
  { key: "noah", name: "Noah Bennett", cls: "10A", profile: "disengaged" },
  { key: "zara", name: "Zara Ahmed", cls: "10A" },
  { key: "lina", name: "Lina Petrova", cls: "10B", profile: "attendance" },
  { key: "oliver", name: "Oliver Grant", cls: "10B" },
  { key: "aisha", name: "Aisha Bello", cls: "10B" },
  { key: "mateo", name: "Mateo Rossi", cls: "10B" },
  { key: "chloe", name: "Chloe Martin", cls: "10B" },
  { key: "ravi", name: "Ravi Patel", cls: "10B" },
  { key: "emma", name: "Emma Lindqvist", cls: "10B" },
  { key: "samuel", name: "Samuel Osei", cls: "10B" },
  { key: "isla", name: "Isla Murphy", cls: "10B" },
  { key: "leo", name: "Leo Fischer", cls: "11A" },
  { key: "nora", name: "Nora Jensen", cls: "11A" },
  { key: "kai", name: "Kai Nakamura", cls: "11A" },
  { key: "fatima", name: "Fatima Zahra", cls: "11A" },
  { key: "daniel", name: "Daniel Costa", cls: "11A" },
  { key: "ines", name: "Inês Silva", cls: "11A" },
  { key: "tom", name: "Tom Walker", cls: "11A" },
  { key: "yasmin", name: "Yasmin Farouk", cls: "11A" },
];

const PERIODS = [
  ["08:00", "08:50"],
  ["09:00", "09:50"],
  ["10:00", "10:50"],
  ["11:10", "12:00"],
  ["12:10", "13:00"],
  ["13:30", "14:20"],
] as const;

const TOPICS: Record<string, string[]> = {
  MAT: ["Linear equations", "Inequalities", "Straight-line graphs", "Simultaneous equations", "Percentages", "Pythagoras' theorem"],
  PHY: ["Forces", "Newton's laws", "Momentum", "Energy stores", "Waves", "Electric circuits"],
  BIO: ["Photosynthesis", "Cell structure", "Enzymes", "Respiration", "Transport in plants", "Ecosystems"],
  CHE: ["Chemical bonding", "Atomic structure", "The periodic table", "Moles", "Acids and alkalis", "Rates of reaction"],
  HIS: ["French Revolution", "Industrial Revolution", "Source analysis", "Causes of WWI", "Napoleon", "The Enlightenment"],
  GEO: ["Plate tectonics", "Rivers", "Urbanisation", "Weather and climate", "Map skills", "Population"],
  ENG: ["Poetry analysis", "Persuasive writing", "Romeo and Juliet", "Narrative writing", "Reading comprehension", "Grammar"],
  CS: ["Algorithms", "Python loops", "Binary", "Networks", "Data representation", "Debugging"],
};

const ASSIGNMENTS: Record<string, { titles: [string, string, string]; brief: string }> = {
  MAT: { titles: ["Worksheet: equations with brackets", "Problem set: forming equations", "Straight-line graphs practice"], brief: "Show every step of your working. Check each answer by substitution." },
  PHY: { titles: ["Free-body diagrams worksheet", "Newton's second law calculations", "Momentum problems"], brief: "Include units in every answer and draw a labelled diagram where helpful." },
  BIO: { titles: ["Leaf structure diagram", "Limiting factors graph analysis", "Photosynthesis revision poster"], brief: "Use the key vocabulary from the lesson and label diagrams clearly." },
  CHE: { titles: ["Dot and cross diagrams", "Bonding comparison table", "Properties of metals questions"], brief: "Explain properties using the structure and bonding of each substance." },
  HIS: { titles: ["Source analysis: the Third Estate", "Timeline of 1789", "Essay plan: causes of the Revolution"], brief: "Support each point with evidence and explain its significance." },
  GEO: { titles: ["Plate boundaries map", "River landforms write-up", "Urbanisation case study"], brief: "Use named examples and include at least one annotated diagram or map." },
  ENG: { titles: ["Poem annotation", "Persuasive letter draft", "Character analysis paragraph"], brief: "Quote the text and explain the effect of the writer's choices." },
  CS: { titles: ["Python loops exercises", "Binary conversion worksheet", "Algorithm flowchart"], brief: "Test your solution with at least two inputs and describe what you checked." },
};

const FEEDBACK = [
  "Clear working throughout — well done. Next time, double-check your final units.",
  "Good effort. Review the second question again; the method is right but there is a small slip.",
  "Excellent explanations. Try to add one more example to support your argument.",
  "Nice progress since last time. Make sure you answer every part of the question.",
];

const LEVEL_TITLES = [
  "Curious Starter", "Note Taker", "Fact Finder", "Quiz Challenger", "Idea Builder",
  "Knowledge Seeker", "Problem Solver", "Deep Thinker", "Study Strategist", "Scholar",
  "Master Learner", "Insight Hunter", "Concept Architect", "Mentor in Making", "Polymath",
  "Luminary", "Visionary", "Sage", "Legend", "EduQuest Grandmaster",
];

const ACHIEVEMENTS = [
  { code: "first_quiz", title: "First Quiz", description: "Complete your first quiz.", icon: "sparkles", tier: "bronze", xp: 20 },
  { code: "perfect_score", title: "Perfect Score", description: "Answer every question in a quiz correctly.", icon: "target", tier: "silver", xp: 30 },
  { code: "streak_7", title: "Seven-Day Streak", description: "Learn something on seven days in a row.", icon: "flame", tier: "silver", xp: 50 },
  { code: "science_explorer", title: "Science Explorer", description: "Complete quizzes in three different science topics.", icon: "flask-conical", tier: "silver", xp: 40 },
  { code: "bookworm", title: "Bookworm", description: "Review 100 flashcards.", icon: "book-open", tier: "gold", xp: 60 },
  { code: "helpful_student", title: "Helpful Student", description: "Complete a verified volunteering activity.", icon: "hand-heart", tier: "bronze", xp: 25 },
  { code: "community_contributor", title: "Community Contributor", description: "Complete three verified volunteering activities.", icon: "users", tier: "gold", xp: 60 },
  { code: "math_master", title: "Master of Mathematics", description: "Score 80% or more on three mathematics quizzes.", icon: "sigma", tier: "gold", xp: 60 },
  { code: "homework_hero", title: "Homework Hero", description: "Submit five homework assignments.", icon: "notebook-pen", tier: "bronze", xp: 25 },
] as const;

const QUESTS = [
  { id: "qst_daily_quiz", cadence: "daily", metric: "quiz_completed", title: "Complete a quiz", description: "Any quiz or practice test counts.", target: 1, xp: 30, difficulty: "easy" },
  { id: "qst_daily_cards", cadence: "daily", metric: "flashcards_reviewed", title: "Review 20 flashcards", description: "Spaced repetition builds long-term memory.", target: 20, xp: 25, difficulty: "easy" },
  { id: "qst_daily_study", cadence: "daily", metric: "study_minutes", title: "Study for 30 minutes", description: "Log a focused session. Take a break afterwards!", target: 30, xp: 30, difficulty: "medium" },
  { id: "qst_daily_homework", cadence: "daily", metric: "assignment_submitted", title: "Hand in an assignment", description: "Submit any homework through EduQuest.", target: 1, xp: 35, difficulty: "medium" },
  { id: "qst_week_quizzes", cadence: "weekly", metric: "quiz_completed", title: "Finish 5 quizzes this week", description: "Mix subjects to strengthen weaker areas.", target: 5, xp: 120, difficulty: "hard" },
  { id: "qst_week_volunteer", cadence: "weekly", metric: "volunteering_verified", title: "Help out in your community", description: "Complete a verified volunteering activity.", target: 1, xp: 100, difficulty: "medium" },
  { id: "qst_week_tutor", cadence: "weekly", metric: "ai_session", title: "Study with the AI tutor 3 times", description: "Ask questions about your lessons.", target: 3, xp: 60, difficulty: "easy" },
] as const;

const REVISION_GUIDE = `Effective Revision Techniques

Why revision methods matter

Re-reading notes feels productive but usually leads to weak long-term memory. Research on learning shows that active strategies, where you have to retrieve or reorganise information, are much more effective.

Retrieval practice

Retrieval practice means testing yourself instead of re-reading. Flashcards, practice quizzes and writing everything you remember on a blank page are all forms of retrieval practice. Getting an answer wrong and then checking it is still useful, because the correction strengthens memory.

Spaced repetition

Spaced repetition means reviewing material over increasing intervals, for example after one day, three days and one week. Cards you know well are reviewed less often, and cards you find difficult come back sooner. EduQuest flashcards use a Leitner box system to schedule reviews.

Interleaving

Interleaving means mixing different topics or types of problem in one study session rather than practising one type at a time. It helps you learn to choose the right method.

Breaks and sleep

Short breaks improve concentration. A common approach is 25 minutes of focused study followed by a 5-minute break. Sleep is when the brain consolidates memories, so late-night cramming is less effective than steady revision over several days.

Asking for help

If you are stuck on a topic for a long time, ask a teacher or a classmate. Explaining a topic to someone else is also one of the best ways to check your own understanding.`;

// ── Timetable generation (no teacher double-booking) ─────────────────────────
function buildTimetables(rand: () => number): Record<string, string[][]> {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const busy = new Set<string>();
    const result: Record<string, string[][]> = {};
    let ok = true;
    for (const cls of CLASSES) {
      const remaining = new Map<string, number>(SUBJECTS.map((s) => [s.id, s.weekly]));
      const grid: string[][] = [];
      for (let d = 1; d <= 5 && ok; d++) {
        const row: string[] = [];
        const perDay = new Map<string, number>();
        for (let p = 0; p < PERIODS.length; p++) {
          const candidates = SUBJECTS.filter(
            (s) => remaining.get(s.id)! > 0 && (perDay.get(s.id) ?? 0) < 2 && !busy.has(`${s.teacher}:${d}:${p}`),
          ).map((s) => ({ s, score: remaining.get(s.id)! + rand() * 2.5 }));
          if (!candidates.length) {
            ok = false;
            break;
          }
          candidates.sort((a, b) => b.score - a.score);
          const pick = candidates[0]!.s;
          row.push(pick.id);
          remaining.set(pick.id, remaining.get(pick.id)! - 1);
          perDay.set(pick.id, (perDay.get(pick.id) ?? 0) + 1);
          busy.add(`${pick.teacher}:${d}:${p}`);
        }
        grid.push(row);
      }
      if (!ok) break;
      result[cls.key] = grid;
    }
    if (ok) return result;
  }
  throw new Error("Could not build a conflict-free demo timetable");
}

// ── Seed ─────────────────────────────────────────────────────────────────────
export function seedDemo(db: Db, now = new Date()) {
  const rand = mulberry32(20261119);
  const today = isoDate(now);
  /** Local date `daysAgo` days before now, at the given local time, as a UTC timestamp string. */
  const at = (daysAgo: number, hour = 12, minute = 0) => {
    const d = addDays(now, -daysAgo);
    d.setHours(hour, minute, 0, 0);
    return stamp(d);
  };
  const dayIso = (daysAgo: number) => isoDate(addDays(now, -daysAgo));
  const year = now.getMonth() >= 8 ? `${now.getFullYear()}/${now.getFullYear() + 1}` : `${now.getFullYear() - 1}/${now.getFullYear()}`;

  db.tx(() => {
    db.run(
      `INSERT INTO schools (id, name, city, is_demo, settings) VALUES (?, ?, ?, 1, ?)`,
      DEMO_SCHOOL_ID,
      "Northbrook Demo High School",
      "Demo City",
      JSON.stringify({ ...DEFAULT_SETTINGS, leaderboardEnabled: true, grantBudget: 5000 }),
    );

    LEVEL_TITLES.forEach((title, i) => db.run(`INSERT INTO levels (level, xp_required, title) VALUES (?, ?, ?)`, i + 1, 50 * i * (i + 1), title));

    for (const s of SUBJECTS) {
      db.run(`INSERT INTO subjects (id, school_id, name, short, color, icon) VALUES (?, ?, ?, ?, ?, ?)`, s.id, DEMO_SCHOOL_ID, s.name, s.short, s.color, s.icon);
    }

    // People ------------------------------------------------------------------
    const email = (name: string) =>
      name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z ]/g, "")
        .trim()
        .replace(/\s+/g, ".") + "@demo.eduquest.example";
    const addUser = (id: string, role: string, name: string, hue: number, title: string | null, grade: number | null) =>
      db.run(
        `INSERT INTO users (id, school_id, role, display_name, email, avatar_hue, title, grade_level, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        id,
        DEMO_SCHOOL_ID,
        role,
        name,
        email(name),
        hue,
        title,
        grade,
      );
    for (const t of TEACHERS) addUser(`usr_${t.key}`, "teacher", t.name, t.hue, t.title, null);
    addUser("usr_ionescu", "admin", "Mara Ionescu", 330, "Principal", null);
    addUser("usr_adeyemi", "support", "Sam Adeyemi", 170, "School counsellor", null);

    for (const c of CLASSES) {
      db.run(
        `INSERT INTO classes (id, school_id, name, grade_level, homeroom_teacher_id, academic_year) VALUES (?, ?, ?, ?, ?, ?)`,
        c.id,
        DEMO_SCHOOL_ID,
        `Class ${c.key}`,
        c.grade,
        `usr_${c.homeroom}`,
        year,
      );
      for (const s of SUBJECTS) {
        db.run(`INSERT INTO teaching_assignments (teacher_id, class_id, subject_id) VALUES (?, ?, ?)`, `usr_${s.teacher}`, c.id, s.id);
      }
    }

    const classOf = (key: string) => CLASSES.find((c) => c.key === key)!;
    const students = STUDENTS.map((s, i) => {
      const profile: Profile = s.profile ?? "normal";
      const base = profile === "alex" ? 8.2 : profile === "decline" ? 7.6 : 5.8 + rand() * 3.4;
      const offsets = Object.fromEntries(SUBJECTS.map((x) => [x.short, (rand() - 0.5) * 1.6])) as Record<string, number>;
      if (profile === "alex") Object.assign(offsets, { MAT: 0.7, PHY: 0.3, CHE: -0.8, ENG: 0.4, HIS: 0, BIO: 0.2, GEO: -0.2, CS: 0.5 });
      const id = `usr_${s.key}`;
      addUser(id, "student", s.name, Math.round((i * 47 + 20) % 360), null, classOf(s.cls).grade);
      db.run(`INSERT INTO class_memberships (class_id, user_id) VALUES (?, ?)`, classOf(s.cls).id, id);
      const optIn = profile === "alex" || rand() < 0.55;
      db.run(
        `INSERT INTO user_settings (user_id, settings) VALUES (?, ?)`,
        id,
        JSON.stringify({ notifications: {}, showOnLeaderboard: optIn, dailyStudyGoalMinutes: 30 }),
      );
      return { ...s, id, profile, base, offsets, classId: classOf(s.cls).id };
    });
    const alex = students.find((s) => s.profile === "alex")!;
    // Days (ago) on which Alex was active. Gaps at 7, 8, 12… keep the best streak at 6,
    // so completing any activity today unlocks the Seven-Day Streak achievement live.
    const ALEX_DAYS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 13, 14, 16, 17, 18, 20, 21, 24, 25, 27, 28];
    const alexDays = new Set<number>(ALEX_DAYS);

    // Timetable ---------------------------------------------------------------
    const timetable = buildTimetables(rand);
    for (const c of CLASSES) {
      timetable[c.key]!.forEach((row, di) =>
        row.forEach((subjectId, p) => {
          const s = SUBJECTS.find((x) => x.id === subjectId)!;
          db.run(
            `INSERT INTO schedule_slots (id, class_id, subject_id, teacher_id, weekday, starts_at, ends_at, room) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            `slot_${c.key}_${di + 1}_${p}`,
            c.id,
            subjectId,
            `usr_${s.teacher}`,
            di + 1,
            PERIODS[p]![0],
            PERIODS[p]![1],
            s.room,
          );
        }),
      );
    }

    // Grades (10 weeks) -----------------------------------------------------------
    const kinds = ["test", "quiz", "quiz", "oral", "homework", "project", "test", "quiz"] as const;
    for (const st of students) {
      for (const subj of SUBJECTS) {
        const topics = TOPICS[subj.short]!;
        for (let w = 0; w < 10; w++) {
          const p = st.profile === "alex" ? 0.75 : st.profile === "decline" ? 0.9 : 0.55;
          if (rand() > p) continue;
          const date = addDays(startOfWeek(now), -7 * w + Math.floor(rand() * 5));
          const iso = isoDate(date);
          if (iso >= today) continue;
          // Low per-grade noise keeps detection signals meaningful (no random "declines").
          let v = st.base + (st.offsets[subj.short] ?? 0) + (rand() - 0.5) * 1.0;
          const daysAgo = Math.round((now.getTime() - date.getTime()) / 86400000);
          if (st.profile === "decline" && daysAgo <= 27 && ["MAT", "PHY", "CHE", "BIO"].includes(subj.short)) v -= 2.8;
          const value = Math.max(3, Math.min(10, Math.round(v)));
          const kind = kinds[Math.floor(rand() * kinds.length)]!;
          db.run(
            `INSERT INTO grades (id, student_id, class_id, subject_id, teacher_id, value, weight, kind, title, graded_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            `grd_${st.key}_${subj.short}_${w}`,
            st.id,
            st.classId,
            subj.id,
            `usr_${subj.teacher}`,
            value,
            kind === "test" ? 2 : 1,
            kind,
            topics[(w + subj.short.length) % topics.length]!,
            iso,
            stamp(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 15)),
          );
        }
      }
    }

    // Attendance (8 weeks of school days, by subject) ------------------------------------
    for (let back = 1; back <= 56; back++) {
      const date = addDays(now, -back);
      const wd = weekday(date);
      if (wd > 5) continue;
      const iso = isoDate(date);
      for (const st of students) {
        const subjectsToday = [...new Set(timetable[st.cls]![wd - 1]!)];
        for (const subjectId of subjectsToday) {
          const subj = SUBJECTS.find((x) => x.id === subjectId)!;
          let absent = 0.02;
          let late = 0.03;
          if (st.profile === "decline" && back <= 27) absent = 0.14;
          if (st.profile === "attendance") {
            if (back >= 22 && back <= 35) {
              absent = 0.32;
              late = 0.1;
            } else if (back < 22) absent = 0.05;
          }
          const r = rand();
          const status = r < absent ? (rand() < 0.25 ? "excused" : "absent") : r < absent + late ? "late" : "present";
          db.run(
            `INSERT INTO attendance (id, student_id, class_id, subject_id, recorded_by, date, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            `att_${st.key}_${subj.short}_${iso}`,
            st.id,
            st.classId,
            subjectId,
            `usr_${subj.teacher}`,
            iso,
            status,
          );
        }
      }
    }

    // XP helper (keys match the live domain formats so idempotency holds) -----------------
    const xp = (userId: string, amount: number, reason: string, sourceType: string, sourceId: string | null, key: string, createdAt: string) =>
      db.run(
        `INSERT OR IGNORE INTO xp_transactions (id, user_id, amount, reason, source_type, source_id, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        `xp_${key}`,
        userId,
        amount,
        reason,
        sourceType,
        sourceId,
        key,
        createdAt,
      );

    // Assignments & submissions ----------------------------------------------------------
    for (const c of CLASSES) {
      SUBJECTS.forEach((subj, si) => {
        const a = ASSIGNMENTS[subj.short]!;
        const dues = [-(14 + (si % 4)), -(3 + (si % 3)), 1 + (si % 7)];
        a.titles.forEach((title, ti) => {
          const id = `asg_${c.key}_${subj.short}_${ti}`;
          const due = addDays(now, dues[ti]!);
          due.setHours(23, 59, 0, 0);
          db.run(
            `INSERT INTO assignments (id, class_id, subject_id, teacher_id, title, description, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
            id,
            c.id,
            subj.id,
            `usr_${subj.teacher}`,
            title,
            `${title}. ${a.brief}`,
            due.toISOString(),
            stamp(addDays(due, -7)),
          );
          for (const st of students.filter((s) => s.cls === c.key)) {
            const isPast = dues[ti]! < 0;
            let prob = isPast ? 0.95 : 0.15;
            if (st.profile === "alex") prob = isPast ? 1 : ti === 2 && subj.short === "CS" ? 1 : 0;
            if (st.profile === "decline" && isPast) prob = ti === 1 ? 0.25 : 0.45;
            if (rand() > prob) continue;
            let subDaysAgo = -dues[ti]! + Math.floor(rand() * 3);
            if (st.profile === "disengaged" && isPast) subDaysAgo = ti === 1 ? 5 : 18;
            if (st.profile === "alex" && isPast) subDaysAgo = ALEX_DAYS.filter((d) => d >= -dues[ti]!).sort((a, b) => a - b)[0]!;
            if (!isPast) subDaysAgo = 1;
            const submittedAt = at(subDaysAgo, 18, Math.floor(rand() * 59));
            const returned = ti === 0 && rand() < 0.7;
            const subId = `subm_${st.key}_${c.key}_${subj.short}_${ti}`;
            db.run(
              `INSERT INTO submissions (id, assignment_id, student_id, body, submitted_at, status, feedback) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              subId,
              id,
              st.id,
              "Submitted via EduQuest (demo).",
              submittedAt,
              returned ? "returned" : "submitted",
              returned ? FEEDBACK[Math.floor(rand() * FEEDBACK.length)]! : null,
            );
            xp(st.id, 20, `Homework submitted: ${title}`, "assignment", id, `submit:${id}:${st.id}`, submittedAt);
          }
        });
      });
    }

    // Lesson documents --------------------------------------------------------------------
    const docs = [
      ...LESSONS.map((l, i) => ({ ...l, owner: `usr_${l.teacher}`, classId: "cls_10a", visibility: "class" as const, daysAgo: 21 - i * 3 })),
      { key: "revision", subject: null, owner: "usr_ionescu", classId: null, visibility: "school" as const, title: "Effective Revision Techniques", fileName: "revision-techniques.md", text: REVISION_GUIDE, daysAgo: 30 },
    ];
    for (const d of docs) {
      const id = `doc_${d.key}`;
      const chunks = chunkText(d.text);
      db.run(
        `INSERT INTO documents (id, school_id, owner_id, class_id, subject_id, title, file_name, mime_type, size_bytes, visibility, status, status_detail, char_count, chunk_count, embeddings, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'text/markdown', ?, ?, 'indexed', 'Seeded demo lesson (text)', ?, ?, 'lexical', ?)`,
        id,
        DEMO_SCHOOL_ID,
        d.owner,
        d.classId,
        d.subject ? subjectByShort(d.subject).id : null,
        d.title,
        d.fileName,
        Buffer.byteLength(d.text),
        d.visibility,
        d.text.length,
        chunks.length,
        at(d.daysAgo, 16),
      );
      for (const c of chunks) {
        db.run(
          `INSERT INTO document_chunks (id, document_id, position, heading, content, token_count) VALUES (?, ?, ?, ?, ?, ?)`,
          `${id}_${c.position}`,
          id,
          c.position,
          c.heading,
          c.content,
          c.tokenCount,
        );
      }
    }

    // Flashcards ------------------------------------------------------------------------------
    for (const set of FLASHCARD_SETS) {
      const id = `set_${set.key.replace("fs-", "")}`;
      db.run(
        `INSERT INTO flashcard_sets (id, owner_id, class_id, subject_id, document_id, title, description, status, origin, created_at) VALUES (?, ?, 'cls_10a', ?, ?, ?, ?, 'published', 'manual', ?)`,
        id,
        `usr_${set.teacher}`,
        subjectByShort(set.subject).id,
        `doc_${set.lesson}`,
        set.title,
        set.description,
        at(14, 17),
      );
      set.cards.forEach(([front, back], i) =>
        db.run(`INSERT INTO flashcards (id, set_id, front, back, position) VALUES (?, ?, ?, ?, ?)`, `${id}_c${i}`, id, front, back, i),
      );
    }

    // Quizzes -------------------------------------------------------------------------------------
    for (const q of QUIZZES) {
      const id = `quiz_${q.key.replace(/^(qz|pt)-/, "")}`;
      db.run(
        `INSERT INTO quizzes (id, owner_id, class_id, subject_id, document_id, title, topic, difficulty, kind, time_limit_s, status, origin, created_at)
         VALUES (?, ?, 'cls_10a', ?, ?, ?, ?, ?, ?, ?, 'published', 'manual', ?)`,
        id,
        `usr_${q.teacher}`,
        subjectByShort(q.subject).id,
        q.lesson ? `doc_${q.lesson}` : null,
        q.title,
        q.topic,
        q.difficulty,
        q.kind ?? "quiz",
        q.timeLimitS ?? null,
        at(12, 17),
      );
      q.questions.forEach((x, i) =>
        db.run(
          `INSERT INTO quiz_questions (id, quiz_id, position, type, prompt, options, answer, explanation, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          `${id}_q${i}`,
          id,
          i,
          x.type,
          x.prompt,
          JSON.stringify(x.type === "true_false" ? ["True", "False"] : (x.options ?? [])),
          x.answer,
          x.explanation,
          x.topic,
        ),
      );
    }
    // A teacher draft awaiting review in the AI studio.
    db.run(
      `INSERT INTO quizzes (id, owner_id, class_id, subject_id, document_id, title, topic, difficulty, kind, status, origin, created_at)
       VALUES ('quiz_draft_gradients', 'usr_novak', NULL, 'sub_mat', 'doc_linear', 'Gradients and intercepts (draft)', 'Straight-line graphs', 'medium', 'quiz', 'draft', 'manual', ?)`,
      at(1, 19),
    );
    [
      { type: "mcq", prompt: "What is the gradient of y = 3x − 2?", options: ["−2", "3", "1.5", "−3"], answer: "3", explanation: "In y = mx + c, the gradient is m = 3.", topic: "Gradient" },
      { type: "mcq", prompt: "Where does y = 2x + 4 cross the y-axis?", options: ["(0, 4)", "(4, 0)", "(0, 2)", "(−2, 0)"], answer: "(0, 4)", explanation: "The y-intercept is c = 4.", topic: "Intercepts" },
      { type: "true_false", prompt: "Parallel lines have the same gradient.", options: ["True", "False"], answer: "True", explanation: "Parallel lines rise at the same rate.", topic: "Gradient" },
    ].forEach((x, i) =>
      db.run(
        `INSERT INTO quiz_questions (id, quiz_id, position, type, prompt, options, answer, explanation, topic) VALUES (?, 'quiz_draft_gradients', ?, ?, ?, ?, ?, ?, ?)`,
        `quiz_draft_gradients_q${i}`,
        i,
        x.type,
        x.prompt,
        JSON.stringify(x.options),
        x.answer,
        x.explanation,
        x.topic,
      ),
    );

    // Quiz attempts -------------------------------------------------------------------------------
    const quizMeta = QUIZZES.map((q) => ({ id: `quiz_${q.key.replace(/^(qz|pt)-/, "")}`, total: q.questions.length, title: q.title, difficulty: q.difficulty, kind: q.kind ?? "quiz" }));
    const addAttempt = (st: (typeof students)[number], quizIdx: number, daysAgo: number, score?: number) => {
      const q = quizMeta[quizIdx]!;
      const ability = Math.min(1, Math.max(0.2, (st.base - 3) / 7 + (rand() - 0.5) * 0.3));
      const s = score ?? Math.max(0, Math.min(q.total, Math.round(q.total * ability)));
      const created = at(daysAgo, 16 + Math.floor(rand() * 4), Math.floor(rand() * 59));
      const mult = { easy: 1, medium: 1.25, hard: 1.5 }[q.difficulty];
      const amount = Math.round((10 + s * 3) * mult) + (s === q.total ? 10 : 0);
      const attemptId = `att_${st.key}_${quizIdx}_${daysAgo}`;
      db.run(
        `INSERT OR IGNORE INTO quiz_attempts (id, quiz_id, student_id, score, total, answers, duration_s, xp_awarded, completed_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?)`,
        attemptId,
        q.id,
        st.id,
        s,
        q.total,
        120 + Math.floor(rand() * 400),
        amount,
        created,
      );
      xp(st.id, amount, `${q.kind === "practice_test" ? "Practice test" : "Quiz"}: ${q.title} (${s}/${q.total})`, "quiz", q.id, `quiz:${q.id}:${st.id}:${dayIso(daysAgo)}`, created);
    };
    // Alex: photosynthesis 5/6, forces 3/5, French Revolution 4/5 (linear & practice test left to try).
    addAttempt(alex, 1, 9, 5);
    addAttempt(alex, 2, 6, 3);
    addAttempt(alex, 3, 3, 4);
    for (const st of students.filter((s) => s.cls === "10A" && s.profile !== "alex")) {
      if (st.profile === "disengaged") {
        [27, 24, 22, 19, 16].forEach((d, i) => addAttempt(st, i % 4, d));
        continue;
      }
      const n = st.profile === "decline" ? 1 : 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) addAttempt(st, Math.floor(rand() * 4), 1 + Math.floor(rand() * 20));
    }

    // Alex's study history: a 6-day streak up to yesterday (today is left for the demo). ---------
    const photoCards = FLASHCARD_SETS[0]!.cards.map((_, i) => `set_photo_c${i}`);
    const linearCards = FLASHCARD_SETS[1]!.cards.map((_, i) => `set_linear_c${i}`);
    for (const d of [...alexDays].sort((a, b) => b - a)) {
      const minutes = 20 + Math.floor(rand() * 4) * 5;
      db.run(
        `INSERT INTO study_sessions (id, user_id, minutes, activity, day, created_at) VALUES (?, ?, ?, 'Focused study', ?, ?)`,
        `ses_alex_${d}`,
        alex.id,
        minutes,
        dayIso(d),
        at(d, 17, 30),
      );
      xp(alex.id, Math.min(30, Math.floor(minutes / 5) * 2), `Focused study (${minutes} min)`, "study_session", `ses_alex_${d}`, `study:ses_alex_${d}`, at(d, 17, 31));
      const cards = d % 2 ? photoCards : linearCards;
      cards.slice(0, 6).forEach((cardId, i) =>
        xp(alex.id, 2, "Flashcard review", "flashcard", cardId, `fc:${cardId}:${alex.id}:${dayIso(d)}`, at(d, 18, i)),
      );
    }
    photoCards.slice(0, 7).forEach((cardId, i) =>
      db.run(
        `INSERT INTO flashcard_progress (card_id, user_id, box, correct, incorrect, due_on, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        cardId,
        alex.id,
        1 + (i % 4),
        2 + (i % 3),
        i % 2,
        i < 4 ? today : dayIso(-2 - i),
        at(1, 18, i),
      ),
    );
    linearCards.slice(0, 5).forEach((cardId, i) =>
      db.run(
        `INSERT INTO flashcard_progress (card_id, user_id, box, correct, incorrect, due_on, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        cardId,
        alex.id,
        2 + (i % 3),
        3,
        1,
        i < 2 ? today : dayIso(-3 - i),
        at(2, 18, i),
      ),
    );
    // Other students: a few study sessions so the school engagement chart has data.
    for (const st of students.filter((s) => s.profile === "normal")) {
      for (let k = 0; k < 4; k++) {
        const d = 1 + Math.floor(rand() * 13);
        db.run(
          `INSERT OR IGNORE INTO study_sessions (id, user_id, minutes, activity, day, created_at) VALUES (?, ?, ?, 'Focused study', ?, ?)`,
          `ses_${st.key}_${d}`,
          st.id,
          15 + Math.floor(rand() * 4) * 5,
          dayIso(d),
          at(d, 18),
        );
      }
    }
    // Noah studied regularly until two weeks ago.
    const noah = students.find((s) => s.profile === "disengaged")!;
    [26, 25, 21, 18, 17, 15].forEach((d) =>
      db.run(`INSERT INTO study_sessions (id, user_id, minutes, activity, day, created_at) VALUES (?, ?, 25, 'Focused study', ?, ?)`, `ses_noah_${d}`, noah.id, dayIso(d), at(d, 18)),
    );

    // Gamification config -------------------------------------------------------------------------
    for (const a of ACHIEVEMENTS) {
      db.run(`INSERT INTO achievements (id, code, title, description, icon, tier, xp_bonus) VALUES (?, ?, ?, ?, ?, ?, ?)`, `ach_${a.code}`, a.code, a.title, a.description, a.icon, a.tier, a.xp);
    }
    for (const q of QUESTS) {
      db.run(
        `INSERT INTO quests (id, school_id, cadence, metric, title, description, target, xp_reward, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        q.id,
        DEMO_SCHOOL_ID,
        q.cadence,
        q.metric,
        q.title,
        q.description,
        q.target,
        q.xp,
        q.difficulty,
      );
    }

    // Volunteering --------------------------------------------------------------------------------
    const activities = [
      { id: "act_recycling", org: "sato", title: "Campus recycling drive", category: "Environment", location: "Main courtyard", days: -3, hour: 14, dur: 90, cap: 20, credits: 40, desc: "Sort and weigh recyclables collected across the school, and help design posters that explain what goes in each bin." },
      { id: "act_library", org: "weber", title: "Library reorganisation afternoon", category: "School", location: "School library", days: -6, hour: 14, dur: 120, cap: 10, credits: 35, desc: "Help the librarian re-shelve the fiction section, label new arrivals and set up a 'staff picks' display." },
      { id: "act_sciencefair", org: "okafor", title: "Science fair setup crew", category: "Events", location: "Sports hall", days: -11, hour: 13, dur: 150, cap: 12, credits: 35, desc: "Set up tables, power strips and signage for the science fair, and help exhibitors find their spots." },
      { id: "act_garden", org: "herrera", title: "Community garden planting day", category: "Community", location: "Demo City community garden (sample location)", days: -9, hour: 10, dur: 180, cap: 15, credits: 50, desc: "Plant spring bulbs and build raised beds with local volunteers. Gloves and tools provided." },
      { id: "act_reading", org: "weber", title: "Peer reading buddies (Grade 7)", category: "Peer support", location: "Room 4", days: -2, hour: 12, dur: 45, cap: 8, credits: 45, desc: "Read with a Grade 7 student once a week during lunch. Training session included." },
      { id: "act_lab2", org: "novak", title: "Classroom refresh: Lab 2", category: "School", location: "Lab 2", days: 3, hour: 14, dur: 90, cap: 8, credits: 25, desc: "Tidy the lab, check equipment inventories and refresh the wall displays." },
      { id: "act_autumn", org: "novak", title: "Autumn recycling campaign", category: "Environment", location: "Main courtyard", days: 20, hour: 14, dur: 120, cap: 25, credits: 40, desc: "Collect and sort recycling during the autumn campaign week." },
      { id: "act_foodbank", org: "herrera", title: "Food bank collection", category: "Community", location: "School entrance", days: 12, hour: 8, dur: 120, cap: 12, credits: 45, desc: "Collect and pack donations for a local food bank collection (sample organisation)." },
      { id: "act_openday", org: "ionescu", title: "School open day helpers", category: "Events", location: "Whole school", days: 35, hour: 9, dur: 240, cap: 20, credits: 35, desc: "Welcome visiting families, give tours and help at subject stands." },
    ];
    for (const a of activities) {
      const start = addDays(now, -a.days);
      start.setHours(a.hour, 0, 0, 0);
      db.run(
        `INSERT INTO volunteering_activities (id, school_id, organizer_id, title, description, category, location, starts_at, duration_minutes, capacity, credits, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id,
        DEMO_SCHOOL_ID,
        `usr_${a.org}`,
        a.title,
        a.desc,
        a.category,
        a.location,
        start.toISOString(),
        a.dur,
        a.cap,
        a.credits,
        a.days > 0 ? (a.days > 7 ? "completed" : "closed") : "open",
      );
    }
    const credit = (userId: string, regId: string, amount: number, title: string, createdAt: string, by: string) =>
      db.run(
        `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key, created_by, created_at) VALUES (?, ?, ?, 'earn', ?, 'volunteering', ?, ?, ?, ?)`,
        `crd_${regId}`,
        userId,
        amount,
        `Volunteering: ${title}`,
        regId,
        `volunteer:${regId}`,
        by,
        createdAt,
      );
    const register = (st: (typeof students)[number], actId: string, status: "registered" | "verified") => {
      const a = activities.find((x) => x.id === actId)!;
      const regId = `reg_${st.key}_${actId}`;
      const verifiedAt = status === "verified" ? at(a.days - 1, 17) : null;
      db.run(
        `INSERT INTO volunteering_registrations (id, activity_id, student_id, status, registered_at, verified_at, verified_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        regId,
        actId,
        st.id,
        status,
        at(a.days + 4, 12),
        verifiedAt,
        status === "verified" ? `usr_${a.org}` : null,
      );
      if (status === "verified") credit(st.id, regId, a.credits, a.title, verifiedAt!, `usr_${a.org}`);
    };
    register(alex, "act_autumn", "verified");
    register(alex, "act_foodbank", "verified");
    register(alex, "act_openday", "verified");
    register(alex, "act_lab2", "registered"); // pending: the demo teacher can verify it
    const others = students.filter((s) => s.profile !== "alex");
    others.slice(0, 3).forEach((s) => register(s, "act_lab2", "registered"));
    others.forEach((s, i) => {
      if (i % 3 === 0) register(s, "act_autumn", "verified");
      if (i % 4 === 1) register(s, "act_openday", "verified");
      if (i % 5 === 2) register(s, "act_foodbank", "verified");
      if (i % 3 === 1) register(s, "act_recycling", "registered");
      if (i % 4 === 2) register(s, "act_garden", "registered");
    });

    // Achievements earned from seeded history (no notifications) --------------------------------
    for (const st of students) {
      for (const a of ACHIEVEMENTS) {
        if (!ACHIEVEMENT_RULES[a.code]?.(db, st.id)) continue;
        const earned = at(1, 20); // yesterday — never creates a new active day for Alex
        db.run(`INSERT INTO student_achievements (user_id, achievement_id, earned_at) VALUES (?, ?, ?)`, st.id, `ach_${a.code}`, earned);
        xp(st.id, a.xp, `Achievement: ${a.title}`, "achievement", `ach_${a.code}`, `ach:ach_${a.code}:${st.id}`, earned);
      }
    }

    // Current-week quest progress for Alex (quizzes completed this ISO week).
    const weekStart = isoDate(startOfWeek(now));
    const alexWeekQuizzes = db.get<{ c: number }>(
      `SELECT COUNT(*) c FROM quiz_attempts WHERE student_id = ? AND date(completed_at, 'localtime') >= ?`,
      alex.id,
      weekStart,
    )!.c;
    if (alexWeekQuizzes) {
      db.run(`INSERT INTO quest_progress (user_id, quest_id, period_key, progress) VALUES (?, 'qst_week_quizzes', ?, ?)`, alex.id, isoWeekKey(now), alexWeekQuizzes);
    }

    // Announcements & events ------------------------------------------------------------------
    const announce = (id: string, classId: string | null, author: string, title: string, body: string, daysAgo: number, pinned = 0) =>
      db.run(
        `INSERT INTO announcements (id, school_id, class_id, author_id, title, body, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        DEMO_SCHOOL_ID,
        classId,
        author,
        title,
        body,
        pinned,
        at(daysAgo, 8, 15),
      );
    announce("ann_welcome", null, "usr_ionescu", "Welcome to EduQuest (demo)", "This is a demonstration school with sample data. Explore the catalog, try the study tools and see how volunteering credits work. Nothing here is real student data.", 10, 1);
    announce("ann_fair", null, "usr_ionescu", "Science fair registrations are open", "Teams of up to three can register a project with Mr. Okafor until next Friday. Setup volunteers earn credits too!", 4);
    announce("ann_linear", "cls_10a", "usr_novak", "Test on linear equations next week", "We'll have a 40-minute test on linear equations. Revise the balance method, brackets and fractions. The practice test in EduQuest is a good warm-up.", 2);
    announce("ann_labcoats", "cls_10a", "usr_raman", "Lab coats on Thursday", "Please bring your lab coats for Thursday's leaf-structure practical.", 1);
    announce("ann_10b_trip", "cls_10b", "usr_weber", "Theatre trip permission slips", "Please return your signed permission slips for the theatre trip by Monday.", 3);

    const event = (id: string, classId: string | null, title: string, kind: string, inDays: number) =>
      db.run(`INSERT INTO events (id, school_id, class_id, title, kind, date) VALUES (?, ?, ?, ?, ?, ?)`, id, DEMO_SCHOOL_ID, classId, title, kind, dayIso(-inDays));
    event("evt_mat_test", "cls_10a", "Mathematics test: linear equations", "exam", 5);
    event("evt_bio_quiz", "cls_10a", "Biology quiz: photosynthesis", "exam", 8);
    event("evt_fair", null, "Science fair", "event", 12);
    event("evt_ptm", null, "Parent–teacher meetings", "meeting", 15);
    event("evt_10b_eng", "cls_10b", "English essay deadline", "exam", 6);
    event("evt_11a_phy", "cls_11a", "Physics practical assessment", "exam", 9);

    // Support caseload + an existing, reviewed case -----------------------------------------------
    for (const st of students.filter((s) => s.cls !== "11A")) {
      db.run(`INSERT INTO support_caseload (staff_id, student_id) VALUES ('usr_adeyemi', ?)`, st.id);
    }
    const lina = students.find((s) => s.profile === "attendance")!;
    db.run(
      `INSERT INTO support_indicators (id, student_id, kind, strength, summary, evidence, status, detected_at, detector, fingerprint) VALUES ('ind_lina_att', ?, 'attendance_change', 'moderate', ?, ?, 'confirmed', ?, 'rules-v1', ?)`,
      lina.id,
      "Attendance over the last four weeks is lower than the previous four weeks.",
      JSON.stringify([{ label: "Attendance rate", before: "96.1%", after: "71.4%" }]),
      at(22, 7),
      `attendance_change:${lina.id}:seed`,
    );
    db.run(
      `INSERT INTO support_reviews (id, indicator_id, reviewer_id, decision, rationale, created_at) VALUES ('rev_lina', 'ind_lina_att', 'usr_adeyemi', 'confirmed', ?, ?)`,
      "Spoke with Lina and her homeroom teacher. Absences are linked to a change in morning transport. Agreed a supportive plan with the family.",
      at(21, 11),
    );
    db.run(
      `INSERT INTO intervention_plans (id, student_id, indicator_id, owner_id, goals, actions, status, review_on, retain_until, created_at) VALUES ('pln_lina', ?, 'ind_lina_att', 'usr_adeyemi', ?, ?, 'monitoring', ?, ?, ?)`,
      lina.id,
      "Return to regular attendance and catch up on missed English and Biology work without extra pressure.",
      "Weekly 10-minute check-in with the counsellor. Homeroom teacher shares missed materials through the library. Family informed about the school's transport support scheme.",
      dayIso(-7),
      dayIso(-365),
      at(20, 10),
    );
    [
      { id: "nte_lina_1", kind: "note", body: "First check-in. Lina is positive about the plan; transport support application submitted with the family.", d: 19 },
      { id: "nte_lina_2", kind: "follow_up", body: "Transport support approved. Lina has caught up on the Biology leaf-structure work.", d: 12 },
      { id: "nte_lina_3", kind: "progress_review", body: "Attendance much improved over the last two weeks. Moving the plan to monitoring.", d: 5 },
    ].forEach((n) =>
      db.run(`INSERT INTO intervention_notes (id, plan_id, author_id, kind, body, created_at) VALUES (?, 'pln_lina', 'usr_adeyemi', ?, ?, ?)`, n.id, n.kind, n.body, at(n.d, 15)),
    );
    const maya = students.find((s) => s.key === "maya")!;
    db.run(
      `INSERT INTO support_indicators (id, student_id, kind, strength, summary, evidence, status, detected_at, detector, fingerprint) VALUES ('ind_maya_eng', ?, 'engagement_drop', 'low', ?, ?, 'dismissed', ?, 'rules-v1', ?)`,
      maya.id,
      "Fewer days with study activity in the last two weeks than in the two weeks before.",
      JSON.stringify([{ label: "Days with study activity", before: "6", after: "1" }]),
      at(30, 7),
      `engagement_drop:${maya.id}:seed`,
    );
    db.run(
      `INSERT INTO support_reviews (id, indicator_id, reviewer_id, decision, rationale, created_at) VALUES ('rev_maya', 'ind_maya_eng', 'usr_adeyemi', 'dismissed', ?, ?)`,
      "Maya was away on a planned family trip; teachers confirm work has been caught up. No action needed.",
      at(29, 10),
    );

    // Plans & subscriptions (prices are configuration, deliberately not set) -------------------------
    const plans = [
      { id: "pln_school", code: "school", name: "EduQuest for Schools", audience: "school", ai: 60, description: "Institutional licence for participating schools. Essential features are free for their students.", features: ["Electronic catalog", "Teacher, admin and student dashboards", "AI study tools with school-level limits", "Gamification & volunteering", "AI courses, grants & accreditation", "Student-support module (permission-based)"] },
      { id: "pln_standard", code: "student_standard", name: "Student Standard", audience: "student_standard", ai: 40, description: "Affordable access to essential EduQuest study tools for students whose school does not participate.", features: ["AI tutor grounded in your own uploads", "Flashcards, quizzes & practice tests", "Personal study planner", "XP, levels and achievements"] },
      { id: "pln_premium", code: "student_premium", name: "Student Premium", audience: "student_premium", ai: 150, description: "Optional extras. Never required for coursework at participating schools.", features: ["Higher AI usage limits", "Advanced study customisation", "Additional AI study tools", "Enhanced personal organisation"] },
    ];
    for (const p of plans) {
      db.run(
        `INSERT INTO subscription_plans (id, code, name, audience, description, features, price_minor, currency, interval, ai_daily_requests) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
        p.id,
        p.code,
        p.name,
        p.audience,
        p.description,
        JSON.stringify(p.features),
        p.ai,
      );
    }
    db.run(`INSERT INTO school_subscriptions (school_id, plan_id, status, seats, starts_on) VALUES (?, 'pln_school', 'demo', 500, ?)`, DEMO_SCHOOL_ID, dayIso(60));

    // Notifications -------------------------------------------------------------------------------
    const ntf = (userId: string, category: string, title: string, body: string, href: string, daysAgo: number, read: boolean, key: string) =>
      db.run(
        `INSERT INTO notifications (id, user_id, category, title, body, href, dedupe_key, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        `ntf_${key}`,
        userId,
        category,
        title,
        body,
        href,
        `seed:${key}`,
        read ? at(daysAgo, 20) : null,
        at(daysAgo, 9 + (key.length % 8)),
      );
    const latestAlexGrade = db.get<{ title: string; value: number; name: string }>(
      `SELECT g.title, g.value, s.name FROM grades g JOIN subjects s ON s.id = g.subject_id WHERE g.student_id = ? ORDER BY g.graded_on DESC LIMIT 1`,
      alex.id,
    );
    if (latestAlexGrade) {
      ntf(alex.id, "academic", `New grade in ${latestAlexGrade.name}`, `${latestAlexGrade.title}: ${latestAlexGrade.value}`, "/app/catalog?tab=grades", 1, false, "alex_grade");
    }
    ntf(alex.id, "announcement", "Test on linear equations next week", "Revise the balance method, brackets and fractions.", "/app/catalog?tab=announcements", 2, false, "alex_ann");
    ntf(alex.id, "volunteering", "New opportunity: Community garden planting day", "50 credits · 15 places", "/app/volunteering", 1, false, "alex_garden");
    ntf(alex.id, "rewards", "+45 credits earned", "Thank you for helping with “Food bank collection”.", "/app/volunteering", 11, true, "alex_credits");
    ntf(alex.id, "gamification", "Achievement unlocked: Homework Hero", "See your collection in Progress.", "/app/progress#achievements", 4, true, "alex_ach");
    ntf(alex.id, "study", "Revision suggestion", "Your Chemistry quiz results suggest revisiting “Chemical bonding”. A summary is ready in the library.", "/app/library", 3, true, "alex_study");
    ntf("usr_novak", "volunteering", "4 students registered: Classroom refresh: Lab 2", "Verify participation to release their credits.", "/app/teacher/volunteering", 2, false, "novak_lab2");
    ntf("usr_novak", "academic", "New submissions", "Several students submitted “Problem set: forming equations”.", "/app/teacher/assignments", 3, false, "novak_subs");
    ntf("usr_ionescu", "system", "Demo data generated", "This school is a demonstration environment with sample data.", "/app/admin/settings", 0, false, "admin_demo");

    db.run(`INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, metadata) VALUES ('aud_seed', NULL, 'demo.seed', 'school', ?, '{}')`, DEMO_SCHOOL_ID);
  });

  // Pattern detection on the generated history (creates indicators awaiting human review).
  const created = runDetection(db, DEMO_SCHOOL_ID, now);
  if (created > 0) {
    db.run(
      `INSERT INTO notifications (id, user_id, category, title, body, href, dedupe_key) VALUES ('ntf_support_queue', 'usr_adeyemi', 'system', ?, ?, '/app/support', 'seed:support_queue')`,
      `${created} indicator${created === 1 ? "" : "s"} awaiting your review`,
      "Patterns were detected in recent academic data. Each one needs a human review before any action.",
    );
  }
  seedPassport(db, now, at);
  db.run(`INSERT INTO meta (key, value) VALUES ('seeded_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, stamp(now));
}

/** Skills Passport demo: a year of history, two projects and one finished mini-course for Alex. */
function seedPassport(db: Db, now: Date, at: (daysAgo: number, hour?: number) => string) {
  // Students joined last school year, so recommendation letters are available in the demo.
  db.run(`UPDATE users SET created_at = ? WHERE role = 'student' AND school_id = ?`, at(420, 9), DEMO_SCHOOL_ID);
  const alex = { id: "usr_alex", role: "student" as const, schoolId: DEMO_SCHOOL_ID, displayName: "Alex Rivera" };
  const novak = { id: "usr_novak", role: "teacher" as const, schoolId: DEMO_SCHOOL_ID, displayName: "Elena Novak" };
  const garden = addProject(db, alex, {
    title: "School garden water sensor",
    description: "Built a soil-moisture sensor with a microcontroller that reminds the eco club when the school garden beds need watering.",
    link: null,
  });
  verifyProject(db, novak, garden, true);
  addProject(db, alex, {
    title: "Study-tips podcast (3 episodes)",
    description: "Recorded and edited a short podcast with classmates about revision techniques for first-year students.",
    link: null,
  });
  // A course finished three weeks ago, written with past dates so it doesn't count as activity today
  // (the demo relies on Alex having a 6-day streak that today's first activity extends).
  const course = courseById("financial-education")!;
  db.run(
    `INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key, created_by, created_at)
     VALUES ('crd_alex_course', ?, ?, 'redeem', ?, 'course_unlock', ?, ?, ?, ?)`,
    alex.id,
    -course.creditCost,
    `Mini-course: ${course.title}`,
    course.id,
    `course:${alex.id}:${course.id}`,
    alex.id,
    at(23, 17),
  );
  const certificateId = issueCredential(
    db,
    {
      schoolId: DEMO_SCHOOL_ID,
      studentId: alex.id,
      kind: "course_certificate",
      title: `Certificate of completion: ${course.title}`,
      payload: { studentName: alex.displayName, schoolName: "Northbrook Demo High School", courseTitle: course.title, skills: course.skills, minutes: course.minutes, score: 100 },
      issuedBy: null,
    },
    new Date(now.getTime() - 21 * 86400000),
  );
  db.run(
    `INSERT INTO course_enrollments (id, course_id, student_id, credit_tx_id, lessons_done, best_score, completed_at, certificate_id, unlocked_at) VALUES ('enr_alex_fin', ?, ?, 'crd_alex_course', ?, 100, ?, ?, ?)`,
    course.id,
    alex.id,
    JSON.stringify(course.lessons.map((_, i) => i)),
    at(21, 18),
    certificateId,
    at(23, 17),
  );
  db.run(
    `INSERT INTO xp_transactions (id, user_id, amount, reason, source_type, source_id, idempotency_key, created_at) VALUES ('xp_alex_course', ?, ?, ?, 'course', ?, ?, ?)`,
    alex.id,
    COURSE_COMPLETION_XP,
    `Course completed: ${course.title}`,
    course.id,
    `course:${course.id}:${alex.id}`,
    at(21, 18),
  );
  seedAiCourse(db, at);
}

/** One AI course waiting for Ms Novak's review, so the review flow is visible in the demo. No grant: Alex doesn't qualify for one yet. */
function seedAiCourse(db: Db, at: (daysAgo: number, hour?: number) => string) {
  const lessons = [
    {
      title: "What makes a strong argument",
      body: `A debate argument has three parts, often remembered as **ARE**:

- **Assertion**: the claim you make (\"School should start at 9:00\").
- **Reasoning**: why it is true (\"Teenagers' sleep cycles shift later\").
- **Evidence**: facts, studies or examples that support the reasoning.

Weak arguments skip the reasoning and jump from claim to evidence. Always explain *why* your evidence proves your point.`,
    },
    {
      title: "Rebuttal: answering the other side",
      body: `Rebuttal means responding directly to the opposing team's arguments.

- Listen and note their main points in short words.
- Attack the weakest link: the assertion, the reasoning or the evidence.
- Use \"Even if…\" to show your side still wins when you accept part of their point.

Respond to arguments, never to people. Calm, specific rebuttal persuades judges more than volume.`,
    },
    {
      title: "Delivery and structure",
      body: `A clear speech is easier to follow and to remember.

- **Signpost**: say how many points you have and number them.
- Keep eye contact with the judges and pause after key lines.
- Speak at a steady pace; nerves make most people talk too fast.
- Finish with a short summary of why your side wins.

Practise with a timer: most school formats give each speaker 3–5 minutes.`,
    },
  ];
  const quiz = [
    { prompt: "What does the R in ARE stand for?", options: ["Reasoning", "Rebuttal", "Rhythm", "Research"], answer: "Reasoning" },
    { prompt: "What is a rebuttal?", options: ["A direct response to the other side's argument", "Your opening joke", "The judges' decision", "A summary of your own points"], answer: "A direct response to the other side's argument" },
    { prompt: "Which part of an argument do weak speakers often skip?", options: ["The reasoning", "The assertion", "The greeting", "The timer"], answer: "The reasoning" },
    { prompt: "What does signposting mean?", options: ["Telling the audience how many points you have and numbering them", "Holding up a sign", "Pointing at the other team", "Reading from your notes"], answer: "Telling the audience how many points you have and numbering them" },
    { prompt: "Rebuttal should target…", options: ["Arguments, not people", "The other speakers personally", "Only the judges", "Nothing; ignore the other side"], answer: "Arguments, not people" },
  ];
  db.run(
    `INSERT INTO ai_courses (id, school_id, student_id, reviewer_id, topic, title, summary, skills, lessons, quiz, created_at) VALUES ('aic_alex_debate', ?, 'usr_alex', 'usr_novak', 'Debate', 'Debate Fundamentals', ?, ?, ?, ?, ?)`,
    DEMO_SCHOOL_ID,
    "Build arguments, answer the other side and speak with confidence in a school debate.",
    JSON.stringify(["Argumentation", "Critical thinking", "Public speaking"]),
    JSON.stringify(lessons),
    JSON.stringify(quiz),
    at(1, 16),
  );
}

/** Drop every table and rebuild the demo dataset (demo mode only). */
export function resetDemo(db: Db, now = new Date()) {
  const tables = db.all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`);
  db.exec("PRAGMA foreign_keys = OFF;");
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  seedDemo(db, now);
}
