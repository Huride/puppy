import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSignals } from "../src/session/types.js";
import {
  analyzeWithGemini,
  analyzeWithProvider,
  analyzeWithProviderDetailed,
  buildCodexExecArgs,
  heuristicCoach,
  parseCoachResult,
  selectCodexCoachOutput,
} from "../src/coach/gemini.js";
import { buildCoachPrompt } from "../src/coach/prompt.js";

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: generateContentMock,
    },
  })),
}));

const baseSignals: SessionSignals = {
  recentLines: ["running tests"],
  repeatedFailureCount: 0,
  repeatedFailureKey: null,
  contextPercent: 42,
  tokenEtaMinutes: 30,
  resourceUsage: {
    cpuPercent: 12,
    memoryPercent: 34,
  },
  idleSeconds: 0,
  activityPhase: "test",
  failureKind: null,
  stuckReason: null,
  resourceTrend: "normal",
};

const originalGeminiApiKey = process.env.GEMINI_API_KEY;

beforeEach(() => {
  generateContentMock.mockReset();
});

afterEach(() => {
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

describe("parseCoachResult", () => {
  it("parses structured Gemini JSON", () => {
    const result = parseCoachResult(`{
      "status": "intervene",
      "summary": "인증 테스트가 반복 실패 중이에요.",
      "risk": "컨텍스트가 82% 찼어요.",
      "recommendation": "새 세션으로 분리하세요.",
      "pet_message": "멍! 지금 끊어가는 게 좋아요."
    }`);

    expect(result).toEqual({
      status: "intervene",
      summary: "인증 테스트가 반복 실패 중이에요.",
      risk: "컨텍스트가 82% 찼어요.",
      recommendation: "새 세션으로 분리하세요.",
      petMessage: "멍! 지금 끊어가는 게 좋아요.",
      evidence: [],
      nextAction: "새 세션으로 분리하세요.",
    });
  });

  it("parses fenced Gemini JSON", () => {
    const result = parseCoachResult(`\`\`\`json
{
  "status": "risk",
  "summary": "빌드가 느려지고 있어요.",
  "risk": "토큰 여유가 줄었어요.",
  "recommendation": "결과를 정리하세요.",
  "pet_message": "멍! 정리하고 가요."
}
\`\`\``);

    expect(result.status).toBe("risk");
    expect(result.petMessage).toBe("멍! 정리하고 가요.");
  });

  it("falls back to watch when Gemini returns an invalid status", () => {
    const result = parseCoachResult(`{
      "status": "panic",
      "summary": "상태 값이 이상해요.",
      "risk": "알 수 없는 상태예요.",
      "recommendation": "보수적으로 지켜보세요.",
      "pet_message": "멍! 조심히 볼게요."
    }`);

    expect(result.status).toBe("watch");
    expect(result.summary).toBe("상태 값이 이상해요.");
  });

  it("falls back to a safe result when JSON is invalid", () => {
    const result = parseCoachResult("not json");

    expect(result.status).toBe("watch");
    expect(result.petMessage).toContain("상태를 확인");
  });
});

describe("buildCoachPrompt", () => {
  it("asks the LLM for concrete task, evidence, prediction, and next action", () => {
    const prompt = buildCoachPrompt(baseSignals);

    expect(prompt).toContain("name the problematic file, test, command, or repeated task");
    expect(prompt).toContain("concrete evidence");
    expect(prompt).toContain("immediate next action");
    expect(prompt).toContain("predict what happens");
    expect(prompt).toContain("problem_task");
    expect(prompt).toContain("evidence");
    expect(prompt).toContain("next_action");
  });
});

describe("heuristicCoach", () => {
  it("returns intervene for high context usage", () => {
    const result = heuristicCoach({ ...baseSignals, contextPercent: 80 });

    expect(result.status).toBe("intervene");
  });

  it("returns intervene for repeated failures", () => {
    const result = heuristicCoach({ ...baseSignals, repeatedFailureCount: 3 });

    expect(result.status).toBe("intervene");
  });

  it("builds specific guidance for repeated failure keys", () => {
    const result = heuristicCoach({
      ...baseSignals,
      repeatedFailureCount: 4,
      repeatedFailureKey: "auth.spec.ts: refresh token expires too early",
      contextPercent: 74,
      tokenEtaMinutes: 12,
    });

    expect(result.summary).toContain("auth.spec.ts");
    expect(result.risk).toContain("refresh token expires too early");
    expect(result.recommendation).toContain("auth.spec.ts");
    expect(result.recommendation).toContain("12분");
  });

  it("predicts near-token exhaustion when ETA is low", () => {
    const result = heuristicCoach({
      ...baseSignals,
      tokenEtaMinutes: 7,
      contextPercent: 68,
    });

    expect(result.status).toBe("risk");
    expect(result.risk).toContain("7분");
    expect(result.recommendation).toContain("요약");
  });

  it("generates concrete next actions from classified failure signals", () => {
    const result = heuristicCoach({
      ...baseSignals,
      recentLines: [
        "[codex] running npm test auth.spec.ts",
        "FAIL auth.spec.ts: refresh token expires too early",
        "[codex] editing src/auth/token.ts",
      ],
      repeatedFailureCount: 3,
      repeatedFailureKey: "auth.spec.ts: refresh token expires too early",
      failureKind: "test_failure",
      stuckReason: "repeated_failure",
      activityPhase: "test",
    });

    expect(result.evidence).toContain("반복 실패 3번");
    expect(result.nextAction).toContain("auth.spec.ts");
    expect(result.nextAction).toContain("src/auth/token.ts");
    expect(result.recommendation).toContain("계속 진행하면");
  });
});

describe("analyzeWithGemini", () => {
  it("returns heuristic fallback when GEMINI_API_KEY is absent", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await analyzeWithGemini(baseSignals);

    expect(result).toEqual(heuristicCoach(baseSignals));
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("requests structured JSON from Gemini", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContentMock.mockResolvedValue({
      text: `{
        "status": "normal",
        "summary": "정상이에요.",
        "risk": "위험이 없어요.",
        "recommendation": "계속 진행하세요.",
        "pet_message": "좋아요. 지켜볼게요."
      }`,
    });

    await analyzeWithGemini(baseSignals);

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3-flash-preview",
        config: { responseMimeType: "application/json" },
      }),
    );
  });

  it("returns heuristic fallback when Gemini throws", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContentMock.mockRejectedValue(new Error("quota exceeded"));

    const result = await analyzeWithGemini({ ...baseSignals, repeatedFailureCount: 3 });

    expect(result).toEqual(heuristicCoach({ ...baseSignals, repeatedFailureCount: 3 }));
  });

  it("returns heuristic fallback when Gemini returns malformed JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const riskySignals = { ...baseSignals, repeatedFailureCount: 3 };
    generateContentMock.mockResolvedValue({ text: "not json" });

    const result = await analyzeWithGemini(riskySignals);

    expect(result).toEqual(heuristicCoach(riskySignals));
  });
});

describe("analyzeWithProvider", () => {
  it("prefers Codex output file content and falls back to stdout when the file is empty", () => {
    expect(selectCodexCoachOutput("{\"status\":\"watch\"}", "ignored")).toBe("{\"status\":\"watch\"}");
    expect(selectCodexCoachOutput("", "\n{\"status\":\"risk\"}\n")).toBe("{\"status\":\"risk\"}");
    expect(selectCodexCoachOutput(undefined, "")).toBe("");
  });

  it("builds Codex exec arguments without unsupported approval flags", () => {
    expect(buildCodexExecArgs("/tmp/out.json", "hello")).toEqual([
      "exec",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--color",
      "never",
      "--output-last-message",
      "/tmp/out.json",
      "hello",
    ]);
  });

  it("uses OpenAI Responses API when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: `{
          "status": "watch",
          "summary": "테스트를 확인 중이에요.",
          "risk": "아직 반복 실패는 약해요.",
          "recommendation": "한 번 더 테스트를 돌려보세요.",
          "pet_message": "멍! 테스트 흐름을 보고 있어요."
        }`,
      }),
    });

    const result = await analyzeWithProvider(baseSignals, {
      provider: "openai",
      model: "gpt-5.4-mini",
      env: { OPENAI_API_KEY: "test-key" },
      fetch: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
    expect(result.status).toBe("watch");
  });

  it("uses Claude Messages API when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: `{
              "status": "risk",
              "summary": "auth.spec.ts가 반복 실패 중이에요.",
              "risk": "같은 테스트가 3번 실패했어요.",
              "recommendation": "로그를 요약하고 원인부터 확인하세요.",
              "pet_message": "멍! 같은 실패가 반복돼요."
            }`,
          },
        ],
      }),
    });

    const result = await analyzeWithProvider({ ...baseSignals, repeatedFailureCount: 3 }, {
      provider: "claude",
      model: "claude-sonnet-4-6",
      env: { ANTHROPIC_API_KEY: "test-key" },
      fetch: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-key",
          "anthropic-version": "2023-06-01",
        }),
      }),
    );
    expect(result.status).toBe("risk");
  });

  it("uses Codex auth through the Codex CLI when requested", async () => {
    const codexRunner = vi.fn().mockResolvedValue(`{
      "status": "watch",
      "summary": "테스트 흐름을 보고 있어요.",
      "risk": "아직 큰 위험은 없어요.",
      "recommendation": "작은 테스트 단위로 계속 확인하세요.",
      "pet_message": "멍! 코덱스로 같이 볼게요."
    }`);

    const result = await analyzeWithProvider(baseSignals, {
      provider: "codex",
      codexRunner,
    });

    expect(codexRunner).toHaveBeenCalledWith(expect.stringContaining("Analyze the coding agent session"));
    expect(result.status).toBe("watch");
    expect(result.petMessage).toBe("멍! 코덱스로 같이 볼게요.");
  });

  it("reports Codex as the actual analysis engine when Codex succeeds", async () => {
    const codexRunner = vi.fn().mockResolvedValue(`{
      "status": "watch",
      "summary": "테스트 흐름을 보고 있어요.",
      "risk": "아직 큰 위험은 없어요.",
      "recommendation": "작은 테스트 단위로 계속 확인하세요.",
      "pet_message": "멍! 코덱스로 같이 볼게요."
    }`);

    const result = await analyzeWithProviderDetailed(baseSignals, {
      provider: "codex",
      codexRunner,
    });

    expect(result.actualProvider).toBe("codex");
    expect(result.actualModel).toBe("codex-auth");
    expect(result.fallbackProvider).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("reports heuristic fallback when Codex analysis fails", async () => {
    const codexRunner = vi.fn().mockRejectedValue(new Error("codex exec failed"));

    const result = await analyzeWithProviderDetailed(baseSignals, {
      provider: "codex",
      codexRunner,
    });

    expect(result.actualProvider).toBe("heuristic");
    expect(result.actualModel).toBe("local-heuristic");
    expect(result.fallbackProvider).toBe("heuristic");
    expect(result.error).toBe("codex exec failed");
    expect(result.coach).toEqual(heuristicCoach(baseSignals));
  });
});
