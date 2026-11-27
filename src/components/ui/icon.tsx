import {
  Atom,
  BookOpen,
  Cpu,
  Flame,
  FlaskConical,
  Globe,
  HandHeart,
  Landmark,
  Leaf,
  NotebookPen,
  Sigma,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Icons referenced by name in the database (subjects, achievements). */
const ICONS: Record<string, LucideIcon> = {
  atom: Atom,
  "book-open": BookOpen,
  book: BookOpen,
  cpu: Cpu,
  flame: Flame,
  "flask-conical": FlaskConical,
  globe: Globe,
  "hand-heart": HandHeart,
  landmark: Landmark,
  leaf: Leaf,
  "notebook-pen": NotebookPen,
  sigma: Sigma,
  sparkles: Sparkles,
  target: Target,
  users: Users,
};

export function NamedIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
