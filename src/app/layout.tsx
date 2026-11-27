import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const body = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin", "latin-ext"], display: "swap" });
const heading = Sora({ variable: "--font-heading", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "EduQuest — Learn. Level Up. Make a Difference.", template: "%s · EduQuest" },
  description:
    "EduQuest combines an electronic school catalog, AI-powered study tools, gamified progress, verified volunteering and teacher-accredited courses to help students stay engaged.",
  applicationName: "EduQuest",
  appleWebApp: { capable: true, title: "EduQuest", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#080B12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} h-full antialiased`}>
      <body className="relative min-h-full">
        <a href="#main" className="sr-only z-[200] rounded-full bg-sun-200 px-4 py-2 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <div className="app-root">
          <TooltipProvider>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </div>
      </body>
    </html>
  );
}
