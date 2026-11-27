import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloudProvider } from "../src/lib/ai/cloud";
import { getProvider } from "../src/lib/ai";
import { DomainError } from "../src/lib/auth/errors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const completion = (content: string) => json({ choices: [{ message: { content } }] });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("AI_API_KEY", "test-key");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cloud AI provider (OpenAI-compatible)", () => {
  it("is selected when AI_API_KEY is set and calls Groq by default with the key", async () => {
    expect(getProvider().id).toBe("cloud");
    fetchMock.mockResolvedValue(completion(JSON.stringify({ cards: [{ front: "What is a covalent bond?", back: "A shared pair of electrons." }] })));
    const cards = await cloudProvider.flashcards("Covalent bonds share electrons.", "Bonding", 5);
    expect(cards).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body).model).toBe("openai/gpt-oss-120b");
  });

  it("uses AI_BASE_URL / AI_MODEL for other providers and tolerates ```json fences", async () => {
    vi.stubEnv("AI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/");
    vi.stubEnv("AI_MODEL", "gemini-flash");
    fetchMock.mockResolvedValue(completion('```json\n{"cards":[{"front":"a","back":"b"}]}\n```'));
    await cloudProvider.flashcards("text", "t", 3);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).model).toBe("gemini-flash");
  });

  it("rejects output that doesn't match the schema", async () => {
    fetchMock.mockResolvedValue(completion('{"wrong":true}'));
    await expect(cloudProvider.flashcards("text", "t", 3)).rejects.toThrow();
  });

  it("turns a 429 into a friendly rate-limit error", async () => {
    fetchMock.mockResolvedValue(json({ error: "rate" }, 429));
    await expect(cloudProvider.summarize("text", "t", { length: "concise", format: "notes" })).rejects.toBeInstanceOf(DomainError);
  });

  it("falls back to the second provider when the first is rate-limited or down", async () => {
    vi.stubEnv("AI_FALLBACK_API_KEY", "fb-key");
    vi.stubEnv("AI_FALLBACK_BASE_URL", "https://fallback.example/v1/");
    vi.stubEnv("AI_FALLBACK_MODEL", "fb-model");
    const ok = completion(JSON.stringify({ cards: [{ front: "a", back: "b" }] }));
    fetchMock.mockResolvedValueOnce(json({ error: "rate" }, 429)).mockResolvedValueOnce(ok);
    expect(await cloudProvider.flashcards("text", "t", 3)).toHaveLength(1);
    expect(fetchMock.mock.calls[1]![0]).toBe("https://fallback.example/v1/chat/completions");
    expect(fetchMock.mock.calls[1]![1].headers.Authorization).toBe("Bearer fb-key");
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).model).toBe("fb-model");

    fetchMock.mockReset().mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(completion(JSON.stringify({ cards: [{ front: "a", back: "b" }] })));
    expect(await cloudProvider.flashcards("text", "t", 3)).toHaveLength(1);

    fetchMock.mockReset().mockResolvedValue(json({ error: "rate" }, 429));
    await expect(cloudProvider.flashcards("text", "t", 3)).rejects.toBeInstanceOf(DomainError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses AI_CHAT_MODEL for the tutor only", async () => {
    vi.stubEnv("AI_CHAT_MODEL", "small-fast");
    fetchMock.mockResolvedValue(new Response("data: [DONE]\n\n", { status: 200 }));
    for await (const _ of cloudProvider.tutor({ question: "hi", history: [], sources: [], grounded: false, level: "standard", studentName: "A" })) void _;
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).model).toBe("small-fast");
    fetchMock.mockResolvedValue(completion(JSON.stringify({ cards: [{ front: "a", back: "b" }] })));
    await cloudProvider.flashcards("text", "t", 3);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).model).toBe("openai/gpt-oss-120b");
  });

  it("drafts a recommendation letter as plain text", async () => {
    fetchMock.mockResolvedValue(completion("Dear Committee,\n\n" + "[Student] is a dedicated volunteer. ".repeat(10) + "\n\nSincerely,"));
    const text = await cloudProvider.recommendation!({ purpose: "university", recipient: null, teacherRole: "homeroom teacher", monthsKnown: 14, volunteering: [], totalHours: 0, badges: [], courses: [], projects: [], average: null, attendancePct: null });
    expect(text).toContain("[Student]");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).messages[1].content).not.toMatch(/Alex|Rivera/);
  });

  it("streams tutor deltas from server-sent events, split across chunks", async () => {
    const sse = ['data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"de', 'lta":{"content":"lo"}}]}\n\n', ": keep-alive\n\ndata: [DONE]\n\n"];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const s of sse) c.enqueue(new TextEncoder().encode(s));
        c.close();
      },
    });
    fetchMock.mockResolvedValue(new Response(body, { status: 200 }));
    let out = "";
    for await (const d of cloudProvider.tutor({ question: "hi", history: [], sources: [], grounded: false, level: "standard", studentName: "Alex" })) out += d;
    expect(out).toBe("Hello");
  });
});
