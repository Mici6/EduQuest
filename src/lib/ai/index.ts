import "server-only";
import { getAiMode, simulationEnabled } from "../config/env";
import { cloudProvider } from "./cloud";
import { simulatedProvider } from "./simulated";
import { AiUnavailableError, type AiProvider } from "./types";

/**
 * The server-side provider: the cloud AI when AI_API_KEY is set. Otherwise
 * real AI runs in the browser (see ./browser.ts) and the server only runs the
 * labelled rule-based simulator, for devices that can't run the on-device model.
 */
export function getProvider(): AiProvider {
  if (getAiMode() === "cloud") return cloudProvider;
  if (simulationEnabled()) return simulatedProvider;
  throw new AiUnavailableError("This device can't run the on-device AI, and the simulated fallback is turned off.");
}

export { AiUnavailableError } from "./types";
