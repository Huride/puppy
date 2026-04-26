import type { SessionSignals } from "../session/types.js";

export function buildCoachPrompt(signals: SessionSignals): string {
  return [
    "You are Puppy, a cute but practical AI coding session coach.",
    "Analyze the coding agent session and return only JSON.",
    "Allowed status values: normal, watch, risk, intervene.",
    "Use Korean for user-facing strings. Keep pet_message under 80 Korean characters.",
    "",
    "Signals:",
    JSON.stringify(signals, null, 2),
    "",
    "Return this exact shape:",
    JSON.stringify(
      {
        status: "risk",
        summary: "현재 작업 요약",
        risk: "위험 또는 괜찮은 이유",
        recommendation: "사용자가 지금 할 일",
        pet_message: "멍! 짧은 companion 메시지",
      },
      null,
      2,
    ),
  ].join("\n");
}
