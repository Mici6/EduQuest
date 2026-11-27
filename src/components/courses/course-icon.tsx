import { Camera, Code, HeartPulse, Mic, PiggyBank, Video, type LucideIcon } from "lucide-react";
import type { Course } from "@/lib/domain/course-catalog";

const ICONS: Record<Course["icon"], LucideIcon> = { video: Video, code: Code, mic: Mic, "heart-pulse": HeartPulse, camera: Camera, "piggy-bank": PiggyBank };

export function CourseIcon({ icon, className }: { icon: Course["icon"]; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}
