import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import type { CoachResult, SessionSignals, SessionStatus } from "../session/types.js";
import { buildCoachPrompt } from "./prompt.js";

const ALLOWED_STATUS = new Set<SessionStatus>(["normal", "watch", "risk", "intervene"]);

export async function analyzeWithGemini(signals: SessionSignals): Promise<CoachResult> {
  if (!process.env.GEMINI_API_KEY) {
    return heuristicCoach(signals);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: buildCoachPrompt(signals),
  });

  return parseCoachResult(response.text ?? "");
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
  if (signals.repeatedFailureCount >= 3 || signals.contextPercent >= 80) {
    return {
      status: "intervene",
      summary: "반복 실패나 높은 컨텍스트 사용량이 감지됐어요.",
      risk: `컨텍스트가 약 ${signals.contextPercent}% 찼어요.`,
      recommendation: "작업을 더 작은 새 세션으로 분리하는 걸 추천해요.",
      petMessage: "멍! 지금은 한 번 끊어가는 게 좋아요.",
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

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
