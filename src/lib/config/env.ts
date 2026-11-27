import "server-only";
import { BROWSER_MODEL_LABEL } from "../ai/types";

/**
 * Central, server-only runtime configuration. Nothing here is exposed to
 * the browser; client components receive the derived `PublicConfig`.
 */
export type AiMode = "cloud" | "browser" | "simulated" | "unavailable";

/** Cloud AI (any OpenAI-compatible API). Defaults to Groq's free tier. */
export function cloudConfig() {
  const model = process.env.AI_MODEL || "openai/gpt-oss-120b";
  return {
    apiKey: process.env.AI_API_KEY ?? "",
    baseUrl: (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
    model,
    label: process.env.AI_LABEL || `${model.split("/").pop()} (cloud)`,
  };
}

export type CloudEndpoint = { name: "primary" | "fallback"; apiKey: string; baseUrl: string; model: string; chatModel: string };

/**
 * Cloud endpoints in the order they're tried. The optional fallback (any
 * OpenAI-compatible service, e.g. Gemini) takes over when the primary is
 * busy, over its free limit, or down. *_CHAT_MODEL lets the tutor chat use a
 * smaller, faster model so free limits last longer.
 */
export function cloudEndpoints(): CloudEndpoint[] {
  const primary = cloudConfig();
  const list: CloudEndpoint[] = [
    { name: "primary", apiKey: primary.apiKey, baseUrl: primary.baseUrl, model: primary.model, chatModel: process.env.AI_CHAT_MODEL || primary.model },
  ];
  const fb = { apiKey: process.env.AI_FALLBACK_API_KEY, baseUrl: process.env.AI_FALLBACK_BASE_URL, model: process.env.AI_FALLBACK_MODEL };
  if (fb.apiKey && fb.baseUrl && fb.model) {
    list.push({ name: "fallback", apiKey: fb.apiKey, baseUrl: fb.baseUrl.replace(/\/+$/, ""), model: fb.model, chatModel: process.env.AI_FALLBACK_CHAT_MODEL || fb.model });
  }
  return list;
}

/** Rule-based server fallback, used when a device can't run the on-device model. */
export const simulationEnabled = () => process.env.AI_SIMULATION !== "off";

export function getAiMode(): AiMode {
  if (process.env.AI_API_KEY) return "cloud";
  // The default: an open model runs in each visitor's browser (WebGPU), so
  // no AI provider, key or tokens are involved. AI_BROWSER=off disables it.
  if (process.env.AI_BROWSER !== "off") return "browser";
  return simulationEnabled() ? "simulated" : "unavailable";
}

export const config = {
  /** Hosted demos with a persistent disk set ALLOW_DEMO_RESET=off so nobody can wipe the data. */
  get demoResetAllowed(): boolean {
    return process.env.ALLOW_DEMO_RESET !== "off";
  },
  get mode(): "demo" | "production" {
    return process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.EDUQUEST_MODE === "production"
      ? "production"
      : "demo";
  },
  get aiDailyLimit(): number {
    return Number(process.env.AI_DAILY_REQUEST_LIMIT ?? 60);
  },
  get maxUploadBytes(): number {
    return Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024;
  },
};

export type PublicConfig = {
  mode: "demo" | "production";
  aiMode: AiMode;
  aiModel: string | null;
  ocrEnabled: boolean;
};

export function publicConfig(): PublicConfig {
  const aiMode = getAiMode();
  return {
    mode: config.mode,
    aiMode,
    aiModel: aiMode === "cloud" ? cloudConfig().label : aiMode === "browser" ? BROWSER_MODEL_LABEL : null,
    // Image OCR needed a cloud vision model; it's off since AI went on-device.
    ocrEnabled: false,
  };
}
