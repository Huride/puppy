import "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import type { CoachResult, SessionSignals, SessionStatus } from "../session/types.js";
import { buildCoachPrompt } from "./prompt.js";
import type { LlmProvider } from "./provider.js";
import { resolveProvider } from "./provider.js";

const ALLOWED_STATUS = new Set<SessionStatus>(["normal", "watch", "risk", "intervene"]);

export type AnalyzeWithProviderOptions = {
  provider?: LlmProvider;
  model?: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
};

const DEFAULT_MODELS = {
  gemini: "gemini-3-flash-preview",
  openai: "gpt-5.2",
  claude: "claude-sonnet-4-5",
} as const;

export async function analyzeWithGemini(signals: SessionSignals): Promise<CoachResult> {
  return analyzeWithProvider(signals, { provider: "gemini" });
}

export async function analyzeWithProvider(
  signals: SessionSignals,
  options: AnalyzeWithProviderOptions = {},
): Promise<CoachResult> {
  const env = options.env ?? process.env;
  const provider = resolveProvider(options.provider ?? "auto", env);

  if (provider === "heuristic") {
    return heuristicCoach(signals);
  }

  try {
    const parsed =
      provider === "gemini"
        ? await analyzeGemini(signals, options.model ?? DEFAULT_MODELS.gemini, env)
        : provider === "openai"
          ? await analyzeOpenAI(signals, options.model ?? DEFAULT_MODELS.openai, env, options.fetch ?? fetch)
          : await analyzeClaude(signals, options.model ?? DEFAULT_MODELS.claude, env, options.fetch ?? fetch);

    return isParseFallback(parsed) ? heuristicCoach(signals) : parsed;
  } catch {
    return heuristicCoach(signals);
  }
}

async function analyzeGemini(
  signals: SessionSignals,
  model: string,
  env: Record<string, string | undefined>,
): Promise<CoachResult> {
  if (!env.GEMINI_API_KEY) {
    return heuristicCoach(signals);
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model,
    contents: buildCoachPrompt(signals),
    config: { responseMimeType: "application/json" },
  });

  return parseCoachResult(response.text ?? "");
}

async function analyzeOpenAI(
  signals: SessionSignals,
  model: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<CoachResult> {
  if (!env.OPENAI_API_KEY) {
    return heuristicCoach(signals);
  }

  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildCoachPrompt(signals),
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return parseCoachResult(extractOpenAIText(json));
}

async function analyzeClaude(
  signals: SessionSignals,
  model: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<CoachResult> {
  if (!env.ANTHROPIC_API_KEY) {
    return heuristicCoach(signals);
  }

  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      messages: [{ role: "user", content: buildCoachPrompt(signals) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude request failed: ${response.status}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  return parseCoachResult(extractClaudeText(json));
}

export function parseCoachResult(raw: string): CoachResult {
  try {
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const status =
      typeof parsed.status === "string" && ALLOWED_STATUS.has(parsed.status as SessionStatus)
        ? (parsed.status as SessionStatus)
        : "watch";

    return {
      status,
      summary: stringValue(parsed.summary, "현재 세션 상태를 확인하고 있어요."),
      risk: stringValue(parsed.risk, "아직 큰 위험은 찾지 못했어요."),
      recommendation: stringValue(parsed.recommendation, "조금 더 지켜봐도 괜찮아요."),
      petMessage: stringValue(parsed.pet_message, "멍! 상태를 확인하고 있어요."),
    };
  } catch {
    return {
      status: "watch",
      summary: "현재 세션 상태를 확인하고 있어요.",
      risk: "Gemini 응답을 JSON으로 읽지 못했어요.",
      recommendation: "잠시 뒤 다시 분석할게요.",
      petMessage: "멍! 상태를 확인하는 중이에요.",
    };
  }
}

export function heuristicCoach(signals: SessionSignals): CoachResult {
  if (signals.repeatedFailureCount >= 3 && signals.repeatedFailureKey) {
    const [task, reason] = splitFailureKey(signals.repeatedFailureKey);
    const eta = signals.tokenEtaMinutes === null ? "토큰 ETA는 아직 불명확해요" : `현재 속도면 약 ${signals.tokenEtaMinutes}분 뒤 토큰 압박이 올 수 있어요`;
    return {
      status: "intervene",
      summary: `${task}에서 같은 실패가 ${signals.repeatedFailureCount}번 반복되고 있어요.`,
      risk: `${reason} 실패가 반복 중이고 컨텍스트는 ${signals.contextPercent}%예요. ${eta}.`,
      recommendation: `${task} 전체를 계속 맡기기보다 실패 로그를 요약하고, 관련 변경 파일 하나만 남겨 ${reason} 원인을 먼저 확인하세요. 남은 여유는 약 ${signals.tokenEtaMinutes ?? "알 수 없음"}분 기준으로 봐야 해요.`,
      petMessage: `멍! ${task}에서 같은 실패가 반복돼요.`,
    };
  }

  if (signals.repeatedFailureCount >= 3 || signals.contextPercent >= 80) {
    return {
      status: "intervene",
      summary:
        signals.contextPercent >= 80
          ? `컨텍스트가 ${signals.contextPercent}%까지 차서 다음 판단 품질이 떨어질 수 있어요.`
          : `같은 실패가 ${signals.repeatedFailureCount}번 반복되고 있어요.`,
      risk: buildRiskLine(signals),
      recommendation: "현재 로그와 변경 파일을 짧게 요약한 뒤, 새 세션이나 더 작은 테스트 범위로 넘기는 게 좋아요.",
      petMessage: "멍! 지금은 한 번 끊어가는 게 좋아요.",
    };
  }

  if (signals.tokenEtaMinutes !== null && signals.tokenEtaMinutes <= 10) {
    return {
      status: "risk",
      summary: `토큰 여유가 약 ${signals.tokenEtaMinutes}분 수준으로 줄어들고 있어요.`,
      risk: `지금 속도면 ${signals.tokenEtaMinutes}분 안에 긴 로그를 더 읽기 어려워질 수 있어요. 컨텍스트는 ${signals.contextPercent}%예요.`,
      recommendation: "지금까지의 목표, 실패 로그, 다음 명령을 요약해두고 큰 파일 읽기나 전체 테스트 반복은 줄이세요.",
      petMessage: "멍! 토큰 여유가 줄고 있어요.",
    };
  }

  return {
    status: "normal",
    summary: "세션이 정상적으로 진행 중이에요.",
    risk: "큰 위험 신호는 없어요.",
    recommendation: "조금 더 기다려도 괜찮아요.",
    petMessage: "좋아요. 제가 계속 지켜볼게요.",
  };
}

function buildRiskLine(signals: SessionSignals): string {
  const parts = [`컨텍스트 ${signals.contextPercent}%`];
  if (signals.tokenEtaMinutes !== null) {
    parts.push(`토큰 ETA ${signals.tokenEtaMinutes}분`);
  }
  if (signals.repeatedFailureCount > 0) {
    parts.push(`반복 실패 ${signals.repeatedFailureCount}번`);
  }
  parts.push(`CPU ${Math.round(signals.resourceUsage.cpuPercent)}%`);
  parts.push(`메모리 ${Math.round(signals.resourceUsage.memoryPercent)}%`);
  return `${parts.join(", ")} 상태예요.`;
}

function splitFailureKey(failureKey: string): [string, string] {
  const [rawTask, ...rawReason] = failureKey.split(":");
  return [rawTask.trim() || "현재 작업", rawReason.join(":").trim() || "같은 오류"];
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isParseFallback(result: CoachResult): boolean {
  return result.risk === "Gemini 응답을 JSON으로 읽지 못했어요.";
}

function extractOpenAIText(json: Record<string, unknown>): string {
  if (typeof json.output_text === "string") {
    return json.output_text;
  }

  const output = Array.isArray(json.output) ? json.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content)
      : [];
    for (const contentItem of content) {
      if (
        contentItem &&
        typeof contentItem === "object" &&
        typeof (contentItem as { text?: unknown }).text === "string"
      ) {
        return (contentItem as { text: string }).text;
      }
    }
  }

  return "";
}

function extractClaudeText(json: Record<string, unknown>): string {
  const content = Array.isArray(json.content) ? json.content : [];
  for (const item of content) {
    if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
      return (item as { text: string }).text;
    }
  }

  return "";
}
