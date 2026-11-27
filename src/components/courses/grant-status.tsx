import { HandCoins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { GrantStatus } from "@/lib/domain/ai-courses";

const LABEL: Record<Exclude<GrantStatus, "none">, { text: string; tone: "sun" | "iris" | "mint" | "neutral" | "rose"; help: string }> = {
  requested: { text: "Step 1 of 3 · teacher review", tone: "sun", help: "The reviewing teacher decides whether to recommend it." },
  recommended: { text: "Step 2 of 3 · administration", tone: "iris", help: "Recommended by the teacher. The school administration makes the final decision." },
  approved: { text: "Step 3 of 3 · reserved", tone: "mint", help: "Approved and reserved. It's paid out once the course is accredited." },
  released: { text: "Paid out", tone: "mint", help: "Released after the course was accredited." },
  declined: { text: "Declined", tone: "rose", help: "This grant request was not approved." },
};

/** Where a course's grant request stands in the three-step process. */
export function GrantStatusCard({ grant, currency }: { grant: { requested: number; recommended: number; approved: number; purpose: string | null; status: GrantStatus; note: string | null }; currency: string }) {
  if (grant.status === "none") return null;
  const l = LABEL[grant.status];
  const amount = grant.status === "approved" || grant.status === "released" ? grant.approved : grant.status === "recommended" ? grant.recommended : grant.requested;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-fg-3">
          <HandCoins className="size-4 text-mint" aria-hidden /> School grant
        </p>
        <Badge tone={l.tone}>{l.text}</Badge>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
        {amount} {currency}
        {grant.status !== "requested" && amount !== grant.requested ? <span className="ml-2 text-sm font-medium text-fg-3">of {grant.requested} requested</span> : null}
      </p>
      <p className="mt-1 text-xs text-fg-3">{l.help}</p>
      {grant.note ? <p className="mt-2 text-sm text-fg-2">Note: {grant.note}</p> : null}
      {grant.purpose ? <p className="mt-3 border-t border-line pt-3 text-sm text-fg-2">{grant.purpose}</p> : null}
    </Card>
  );
}
