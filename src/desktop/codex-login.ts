import type { CodexAuthStatus } from "../auth/setup.js";

export type CodexLoginEntryPoint = "desktop" | "auth-window";

export type CodexLoginPlan =
  | {
      action: "show-status";
      message: string;
      detail: string;
    }
  | {
      action: "confirm-terminal" | "open-terminal";
      message: string;
      detail: string;
    };

const CODEX_TERMINAL_DETAIL = "새 Terminal 창에서 `codex login`을 실행합니다. 인증 후 Pawtrol 메뉴에서 상태를 다시 확인하세요.";

export function planCodexLoginFlow(
  status: CodexAuthStatus,
  entryPoint: CodexLoginEntryPoint,
): CodexLoginPlan {
  if (!status.installed) {
    return {
      action: "show-status",
      message: "Codex CLI를 찾지 못했어요.",
      detail: status.detail,
    };
  }

  if (status.authenticated) {
    return {
      action: "show-status",
      message: "Codex가 이미 로그인되어 있어요.",
      detail: status.detail,
    };
  }

  if (entryPoint === "auth-window") {
    return {
      action: "open-terminal",
      message: "Codex 로그인 흐름을 열었어요.",
      detail: CODEX_TERMINAL_DETAIL,
    };
  }

  return {
    action: "confirm-terminal",
    message: "터미널에서 Codex 로그인을 시작할까요?",
    detail: CODEX_TERMINAL_DETAIL,
  };
}

export function buildCodexWindowLaunchResult(envPath: string): { ok: true; message: string } {
  return {
    ok: true,
    message: [
      "Codex CLI 로그인 흐름을 열었어요.",
      "브라우저에서 인증을 완료한 뒤 Pawtrol 메뉴에서 상태를 다시 확인하세요.",
      "LLM: codex",
      "Model: codex-auth",
      envPath,
    ].join("\n"),
  };
}
