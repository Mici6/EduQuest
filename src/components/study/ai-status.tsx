"use client";

import { Cloud, Cpu, Download, FlaskConical, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Notice } from "@/components/ui/states";
import { loadBrowserAi, useBrowserAi } from "@/lib/ai/browser";
import type { AiMode } from "@/lib/config/env";

const SIMULATED = "Until then, tools use transparent rule-based text tools on your real lesson materials, labelled “Simulated”.";

export function AiStatusNotice({ mode, model, className }: { mode: AiMode; model: string | null; className?: string }) {
  if (mode === "cloud") {
    return (
      <Notice tone="ai" icon={<Cloud />} title={`Live AI · ${model}`} className={className}>
        Answers come from a cloud AI service and are grounded in your teachers&apos; materials where possible. Don&apos;t type personal details into the AI tools. AI can make mistakes, so check important facts with your teacher.
      </Notice>
    );
  }
  if (mode === "browser") return <BrowserAiNotice model={model} className={className} />;
  if (mode === "simulated") {
    return (
      <Notice tone="warn" icon={<FlaskConical />} title="Simulation mode — no AI model is connected" className={className}>
        Outputs come from transparent rule-based text tools working on your real lesson materials (quoting passages, extractive summaries, cloze questions). They are labelled “Simulated”.
      </Notice>
    );
  }
  return (
    <Notice tone="danger" icon={<PlugZap />} title="AI is not configured" className={className}>
      An administrator needs to enable AI before these tools can be used. Your materials and other EduQuest features still work.
    </Notice>
  );
}

function BrowserAiNotice({ model, className }: { model: string | null; className?: string }) {
  const ai = useBrowserAi();
  if (ai.status === "ready") {
    return (
      <Notice tone="ai" icon={<Cpu />} title={`On-device AI ready · ${model}`} className={className}>
        Runs privately on this device: free, and your questions never leave your browser. Answers are grounded in your teachers&apos; materials where possible. AI can make mistakes, so check important facts with your teacher.
      </Notice>
    );
  }
  if (ai.status === "loading") {
    return (
      <Notice tone="ai" icon={<Download />} title={`Loading on-device AI · ${Math.round(ai.progress * 100)}%`} className={className}>
        <ProgressBar value={ai.progress} tone="iris" size="sm" className="my-2" label="Model download" />
        <span className="text-xs">{ai.text}</span>
      </Notice>
    );
  }
  if (ai.status === "unsupported") {
    return (
      <Notice tone="warn" icon={<FlaskConical />} title="This device can't run the on-device AI" className={className}>
        It needs a browser with WebGPU (recent Chrome or Edge on a laptop or desktop). Tools here use transparent rule-based text tools instead, labelled “Simulated”.
      </Notice>
    );
  }
  return (
    <Notice tone={ai.status === "error" ? "danger" : "ai"} icon={<Cpu />} title={ai.status === "error" ? "The on-device AI couldn't load" : `Free on-device AI · ${model}`} className={className}>
      <p>
        {ai.status === "error"
          ? `${ai.text} Make sure about 2 GB of graphics memory is free, then try again.`
          : "Runs in your browser on this device's graphics card. No account, no cost, nothing sent to an AI company. One-time download of about 1 GB; after that it loads from cache."}{" "}
        {SIMULATED}
      </p>
      <Button size="sm" variant="iris" className="mt-2" onClick={() => void loadBrowserAi()} disabled={ai.status === "checking"}>
        <Download /> {ai.status === "error" ? "Try again" : "Load AI model"}
      </Button>
    </Notice>
  );
}
