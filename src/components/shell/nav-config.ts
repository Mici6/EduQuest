import {
  Award,
  BellRing,
  BookMarked,
  FileSignature,
  BookOpen,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  HandCoins,
  GraduationCap,
  HandHeart,
  House,
  Layers,
  LayoutGrid,
  LibraryBig,
  ListChecks,
  Megaphone,
  NotebookPen,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/types";

export type NavItem = { href: string; label: string; icon: LucideIcon; match?: string[] };
export type NavConfig = { primary: NavItem[]; secondary: NavItem[]; mobile: NavItem[] };

const settings: NavItem = { href: "/app/settings", label: "Settings", icon: Settings };
const notifications: NavItem = { href: "/app/notifications", label: "Notifications", icon: BellRing };

export const NAV: Record<Role, NavConfig> = {
  student: {
    primary: [
      { href: "/app/dashboard", label: "Dashboard", icon: House },
      { href: "/app/catalog", label: "Catalog", icon: GraduationCap },
      { href: "/app/study", label: "AI Study", icon: Sparkles, match: ["/app/study"] },
      { href: "/app/flashcards", label: "Flashcards", icon: Layers },
      { href: "/app/quizzes", label: "Quizzes", icon: ListChecks },
      { href: "/app/homework", label: "Homework", icon: NotebookPen },
      { href: "/app/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/app/library", label: "Library", icon: LibraryBig },
      { href: "/app/volunteering", label: "Volunteering", icon: HandHeart },
      { href: "/app/courses", label: "Courses", icon: BookMarked },
      { href: "/app/passport", label: "Skills Passport", icon: Award },
      { href: "/app/progress", label: "Progress", icon: Trophy },
    ],
    secondary: [notifications, settings],
    mobile: [
      { href: "/app/dashboard", label: "Home", icon: House },
      { href: "/app/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/app/study", label: "Study", icon: Sparkles, match: ["/app/study", "/app/flashcards", "/app/quizzes"] },
      { href: "/app/courses", label: "Courses", icon: BookMarked },
    ],
  },
  teacher: {
    primary: [
      { href: "/app/teacher", label: "Dashboard", icon: House },
      { href: "/app/teacher/classes", label: "Classes & grades", icon: GraduationCap },
      { href: "/app/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
      { href: "/app/teacher/assignments", label: "Assignments", icon: NotebookPen },
      { href: "/app/teacher/studio", label: "AI Studio", icon: WandSparkles },
      { href: "/app/library", label: "Library", icon: LibraryBig },
      { href: "/app/schedule", label: "Schedule", icon: CalendarDays },
      { href: "/app/teacher/announcements", label: "Announcements", icon: Megaphone },
      { href: "/app/teacher/volunteering", label: "Volunteering", icon: HandHeart },
      { href: "/app/teacher/courses", label: "Course reviews", icon: WandSparkles },
      { href: "/app/teacher/passports", label: "Passports & letters", icon: FileSignature },
    ],
    secondary: [notifications, settings],
    mobile: [
      { href: "/app/teacher", label: "Home", icon: House },
      { href: "/app/teacher/classes", label: "Classes", icon: GraduationCap },
      { href: "/app/teacher/courses", label: "Reviews", icon: WandSparkles },
      { href: "/app/schedule", label: "Schedule", icon: CalendarDays },
    ],
  },
  admin: {
    primary: [
      { href: "/app/admin", label: "Overview", icon: ChartColumn },
      { href: "/app/admin/people", label: "People", icon: Users },
      { href: "/app/admin/classes", label: "Classes & subjects", icon: LayoutGrid },
      { href: "/app/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/app/admin/volunteering", label: "Volunteering", icon: HandHeart },
      { href: "/app/admin/grants", label: "Grants", icon: HandCoins },
      { href: "/app/admin/plans", label: "Plans & pricing", icon: Wallet },
      { href: "/app/admin/audit", label: "Audit log", icon: ScrollText },
      { href: "/app/admin/settings", label: "School settings", icon: ShieldCheck },
    ],
    secondary: [notifications, settings],
    mobile: [
      { href: "/app/admin", label: "Overview", icon: ChartColumn },
      { href: "/app/admin/people", label: "People", icon: Users },
      { href: "/app/admin/grants", label: "Grants", icon: HandCoins },
      { href: "/app/admin/settings", label: "School", icon: ShieldCheck },
    ],
  },
  support: {
    primary: [
      { href: "/app/support", label: "Review queue", icon: ClipboardList, match: ["/app/support/indicators"] },
      { href: "/app/support/caseload", label: "Caseload", icon: Users },
      { href: "/app/support/plans", label: "Support plans", icon: BookOpen },
    ],
    secondary: [notifications, settings],
    mobile: [
      { href: "/app/support", label: "Queue", icon: ClipboardList, match: ["/app/support/indicators"] },
      { href: "/app/support/caseload", label: "Caseload", icon: Users },
      { href: "/app/support/plans", label: "Plans", icon: BookOpen },
      { href: "/app/notifications", label: "Alerts", icon: BellRing },
    ],
  },
};

export function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  const roots = ["/app/teacher", "/app/admin", "/app/support", "/app/dashboard"];
  if (roots.includes(item.href)) return (item.match ?? []).some((m) => pathname.startsWith(m));
  return pathname.startsWith(item.href + "/") || (item.match ?? []).some((m) => pathname.startsWith(m));
}
