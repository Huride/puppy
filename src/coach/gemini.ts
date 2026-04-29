import "../config/env.js";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { CoachResult, SessionSignals, SessionStatus } from "../session/types.js";
import { buildCoachPrompt } from "./prompt.js";
import type { LlmProvider, ResolvedLlmProvider } from "./provider.js";
import { getRecommendedModel, resolveProvider } from "./provider.js";

const ALLOWED_STATUS = new Set<SessionStatus>(["normal", "watch", "risk", "intervene"]);

export type CodexCoachRunner = (prompt: string) => Promise<string>;

export type AnalyzeWithProviderOptions = {
  provider?: LlmProvider;
  model?: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  codexRunner?: CodexCoachRunner;
};

export type AnalyzeWithProviderDetailedResult = {
  coach: CoachResult;
  requestedProvider: ResolvedLlmProvider;
  requestedModel: string;
  actualProvider: ResolvedLlmProvider;
  actualModel: string;
  fallbackProvider?: "heuristic";
  error?: string;
};

export function buildCodexExecArgs(outputPath: string, prompt: string): string[] {
  return [
    "exec",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "--color",
    "never",
    "--output-last-message",
    outputPath,
    prompt,
  ];
}

export function selectCodexCoachOutput(fileContents: string | null | undefined, stdout: string): string {
  const trimmedFile = fileContents?.trim();
  if (trimmedFile) {
    return trimmedFile;
  }

  const stdoutLines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return stdoutLines.at(-1) ?? "";
}

export async function analyzeWithGemini(signals: SessionSignals): Promise<CoachResult> {
  return analyzeWithProvider(signals, { provider: "gemini" });
}

export async function analyzeWithProvider(
  signals: SessionSignals,
  options: AnalyzeWithProviderOptions = {},
): Promise<CoachResult> {
  return (await analyzeWithProviderDetailed(signals, options)).coach;
}

export async function analyzeWithProviderDetailed(
  signals: SessionSignals,
  options: AnalyzeWithProviderOptions = {},
): Promise<AnalyzeWithProviderDetailedResult> {
  const env = options.env ?? process.env;
  const provider = resolveProvider(options.provider ?? "auto", env);
  const requestedModel = options.model ?? getRecommendedModel(provider);

  if (provider === "heuristic") {
    return {
      coach: heuristicCoach(signals),
      requestedProvider: provider,
      requestedModel,
      actualProvider: "heuristic",
      actualModel: getRecommendedModel("heuristic"),
    };
  }

  try {
    const parsed =
      provider === "gemini"
        ? await analyzeGemini(signals, requestedModel, env)
        : provider === "openai"
          ? await analyzeOpenAI(signals, requestedModel, env, options.fetch ?? fetch)
          : provider === "claude"
            ? await analyzeClaude(signals, requestedModel, env, options.fetch ?? fetch)
            : await analyzeCodex(signals, options.codexRunner ?? runCodexCoach);

    if (isParseFallback(parsed)) {
      return {
        coach: heuristicCoach(signals),
        requestedProvider: provider,
        requestedModel,
        actualProvider: "heuristic",
        actualModel: getRecommendedModel("heuristic"),
        fallbackProvider: "heuristic",
        error: "LLM 응답을 구조화하지 못했어요.",
      };
    }

    return {
      coach: parsed,
      requestedProvider: provider,
      requestedModel,
      actualProvider: provider,
      actualModel: requestedModel,
    };
  } catch (error) {
    return {
      coach: heuristicCoach(signals),
      requestedProvider: provider,
      requestedModel,
      actualProvider: "heuristic",
      actualModel: getRecommendedModel("heuristic"),
      fallbackProvider: "heuristic",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function analyzeCodex(signals: SessionSignals, codexRunner: CodexCoachRunner): Promise<CoachResult> {
  return parseCoachResult(await codexRunner(buildCoachPrompt(signals)));
}

async function runCodexCoach(prompt: string): Promise<string> {
  const outputPath = path.join(getCodexOutputRoot(), `pawtrol-codex-${randomUUID()}.json`);
  const args = buildCodexExecArgs(outputPath, prompt);
  const child = spawn("codex", args, {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  try {
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdin.end();

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 0));
    });

    const fileContents = (await fileExists(outputPath)) ? await readFile(outputPath, "utf8") : null;
    const output = selectCodexCoachOutput(fileContents, stdout);

    if (exitCode !== 0) {
      throw new Error(`codex exec failed (${exitCode}): ${stderr || stdout || "unknown error"}`);
    }

    if (!output) {
      throw new Error(`codex exec produced no coach output: ${stderr || "empty stdout/file"}`);
    }

    return output;
  } finally {
    child.kill();
    await rm(outputPath, { force: true });
  }
}

function getCodexOutputRoot(platform = process.platform): string {
  return platform === "darwin" ? "/tmp" : tmpdir();
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
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
      evidence: stringArrayValue(parsed.evidence),
      nextAction: stringValue(parsed.next_action, stringValue(parsed.recommendation, "조금 더 지켜봐도 괜찮아요.")),
    };
  } catch {
    return {
      status: "watch",
      summary: "현재 세션 상태를 확인하고 있어요.",
      risk: "Gemini 응답을 JSON으로 읽지 못했어요.",
      recommendation: "잠시 뒤 다시 분석할게요.",
      petMessage: "멍! 상태를 확인하는 중이에요.",
      evidence: ["LLM 응답을 구조화하지 못했어요."],
      nextAction: "잠시 뒤 같은 신호로 다시 분석해요.",
    };
  }
}

export function heuristicCoach(signals: SessionSignals): CoachResult {
  if (signals.repeatedFailureCount >= 3 && signals.repeatedFailureKey) {
    const [task, reason] = splitFailureKey(signals.repeatedFailureKey);
    const eta = signals.tokenEtaMinutes === null ? "토큰 ETA는 아직 불명확해요" : `현재 속도면 약 ${signals.tokenEtaMinutes}분 뒤 토큰 압박이 올 수 있어요`;
    const touchedFile = findRecentTouchedFile(signals.recentLines, task);
    const evidence = buildEvidence(signals, [`${reason} 실패`, `반복 실패 ${signals.repeatedFailureCount}번`]);
    const nextAction = buildFailureNextAction(task, reason, touchedFile);
    return {
      status: "intervene",
      summary: `${task}에서 같은 실패가 ${signals.repeatedFailureCount}번 반복되고 있어요.`,
      risk: `${reason} 실패가 반복 중이고 컨텍스트는 ${signals.contextPercent}%예요. ${eta}.`,
      recommendation: `${nextAction} 계속 진행하면 같은 실패 로그가 더 쌓이고 남은 여유는 약 ${signals.tokenEtaMinutes ?? "알 수 없음"}분 기준으로 더 빠르게 줄 수 있어요.`,
      petMessage: `멍! ${task}에서 같은 실패가 반복돼요.`,
      evidence,
      nextAction,
    };
  }

  if (signals.repeatedFailureCount >= 3 || signals.contextPercent >= 80) {
    const evidence = buildEvidence(signals);
    const nextAction =
      signals.contextPercent >= 80
        ? "현재 목표, 변경 파일, 실패 로그를 짧게 요약한 뒤 새 세션에서 가장 작은 테스트 범위로 이어가세요."
        : "반복되는 실패 키를 먼저 정하고 전체 명령 대신 가장 작은 재현 명령만 실행하세요.";
    return {
      status: "intervene",
      summary:
        signals.contextPercent >= 80
          ? `컨텍스트가 ${signals.contextPercent}%까지 차서 다음 판단 품질이 떨어질 수 있어요.`
          : `같은 실패가 ${signals.repeatedFailureCount}번 반복되고 있어요.`,
      risk: buildRiskLine(signals),
      recommendation: `${nextAction} 계속 진행하면 새 판단보다 같은 로그 재해석에 컨텍스트를 더 쓸 가능성이 커요.`,
      petMessage: "멍! 지금은 한 번 끊어가는 게 좋아요.",
      evidence,
      nextAction,
    };
  }

  if (signals.tokenEtaMinutes !== null && signals.tokenEtaMinutes <= 10) {
    const evidence = buildEvidence(signals, [`토큰 ETA ${signals.tokenEtaMinutes}분`]);
    const nextAction = "지금까지의 목표, 실패 로그, 다음 명령을 요약하고 큰 파일 읽기나 전체 테스트 반복은 줄이세요.";
    return {
      status: "risk",
      summary: `토큰 여유가 약 ${signals.tokenEtaMinutes}분 수준으로 줄어들고 있어요.`,
      risk: `지금 속도면 ${signals.tokenEtaMinutes}분 안에 긴 로그를 더 읽기 어려워질 수 있어요. 컨텍스트는 ${signals.contextPercent}%예요.`,
      recommendation: `${nextAction} 계속 진행하면 중요한 실패 근거가 컨텍스트 밖으로 밀릴 수 있어요.`,
      petMessage: "멍! 토큰 여유가 줄고 있어요.",
      evidence,
      nextAction,
    };
  }

  return {
    status: "normal",
    summary: "세션이 정상적으로 진행 중이에요.",
    risk: "큰 위험 신호는 없어요.",
    recommendation: "조금 더 기다려도 괜찮아요.",
    petMessage: "좋아요. 제가 계속 지켜볼게요.",
    evidence: buildEvidence(signals),
    nextAction: "현재 흐름을 유지하되 새 실패가 생기면 해당 테스트나 파일 단위로 범위를 줄이세요.",
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

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
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

function buildEvidence(signals: SessionSignals, extra: string[] = []): string[] {
  const evidence = [...extra];
  evidence.push(`작업 phase ${signals.activityPhase}`);
  if (signals.failureKind) {
    evidence.push(`실패 종류 ${failureKindLabel(signals.failureKind)}`);
  }
  if (signals.stuckReason) {
    evidence.push(`정체 신호 ${stuckReasonLabel(signals.stuckReason)}`);
  }
  evidence.push(`컨텍스트 ${signals.contextPercent}%`);
  if (signals.tokenEtaMinutes !== null) {
    evidence.push(`토큰 ETA ${signals.tokenEtaMinutes}분`);
  }
  if (signals.resourceTrend !== "normal") {
    evidence.push(`리소스 ${resourceTrendLabel(signals.resourceTrend)}`);
  }
  return [...new Set(evidence)];
}

function buildFailureNextAction(task: string, reason: string, touchedFile: string | null): string {
  const fileScope = touchedFile ? `와 ${touchedFile} 변경만` : "와 관련 변경 파일만";
  return `전체 테스트 반복 대신 ${task} 단일 실패${fileScope} 확인하고, ${reason} 원인을 먼저 좁히세요.`;
}

function findRecentTouchedFile(lines: string[], task: string): string | null {
  const taskFile = task.match(/\b[\w./-]+\.(?:ts|tsx|js|jsx|css|html|md|json)\b/)?.[0] ?? null;

  for (const line of [...lines].reverse()) {
    const file = line.match(/\b[\w./-]+\.(?:ts|tsx|js|jsx|css|html|md|json)\b/)?.[0] ?? null;
    if (file && file !== taskFile) {
      return file;
    }
  }

  return null;
}

function failureKindLabel(kind: NonNullable<SessionSignals["failureKind"]>): string {
  const labels: Record<NonNullable<SessionSignals["failureKind"]>, string> = {
    test_failure: "테스트 실패",
    build_error: "빌드 오류",
    auth_error: "인증 오류",
    network_error: "네트워크 오류",
    timeout: "타임아웃",
    missing_file: "파일 누락",
    type_error: "타입 오류",
    unknown_error: "알 수 없는 오류",
  };
  return labels[kind];
}

function stuckReasonLabel(reason: NonNullable<SessionSignals["stuckReason"]>): string {
  const labels: Record<NonNullable<SessionSignals["stuckReason"]>, string> = {
    repeated_failure: "같은 실패 반복",
    same_file_repeated: "같은 파일 반복",
    long_idle: "긴 무출력",
    output_flood: "출력 폭주",
  };
  return labels[reason];
}

function resourceTrendLabel(trend: SessionSignals["resourceTrend"]): string {
  const labels: Record<SessionSignals["resourceTrend"], string> = {
    normal: "정상",
    high_cpu: "CPU 높음",
    high_memory: "메모리 높음",
    high_cpu_memory: "CPU와 메모리 높음",
  };
  return labels[trend];
}
