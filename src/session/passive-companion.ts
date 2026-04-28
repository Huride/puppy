import type { CoachResult, SessionSignals } from "./types.js";
import type { RunningAgent } from "./agent-detect.js";

export function buildPassiveCompanionCoach(signals: SessionSignals, agents: RunningAgent[]): CoachResult {
  const agentKinds = Array.from(new Set(agents.map((agent) => agent.kind)));
  const cpu = Math.round(signals.resourceUsage.cpuPercent);
  const memory = Math.round(signals.resourceUsage.memoryPercent);
  const agentSummary = agentKinds.length > 0 ? agentKinds.join(", ") : "none";

  if (cpu >= 85 || memory >= 85) {
    return {
      status: "risk",
      summary: `${agentSummary} 프로세스는 감지했지만 passive detect 모드라 실제 실패 로그는 아직 못 읽고 있어요.`,
      risk: `시스템 부하가 높아요. CPU ${cpu}%, 메모리 ${memory}% 상태입니다.`,
      recommendation: "정확한 파일/테스트 진단은 `pawtrol watch -- <command>`처럼 실제 출력 감시 모드에서 확인하세요.",
      petMessage: "멍! 지금은 프로세스와 리소스만 보고 있어요.",
      evidence: [`감지된 에이전트 ${agentSummary}`, `CPU ${cpu}%`, `메모리 ${memory}%`, "passive detect 모드"],
      nextAction: "무거운 작업이 겹쳤는지 먼저 줄이고, 필요하면 watch 모드로 다시 실행하세요.",
    };
  }

  return {
    status: "watch",
    summary: `${agentSummary} 프로세스를 감지했어요. 다만 passive detect 모드라 실제 코드 변경/실패 로그는 읽지 못해요.`,
    risk: "현재 상태창은 프로세스 존재와 시스템 리소스 위주로만 판단하고 있어요.",
    recommendation: "정밀한 코칭이 필요하면 `pawtrol watch -- <command>` 또는 실제 세션 로그 공유가 가능한 경로로 실행하세요.",
    petMessage: "멍! 지금은 멀리서 지켜보는 중이에요.",
    evidence: [`감지된 에이전트 ${agentSummary}`, `CPU ${cpu}%`, `메모리 ${memory}%`, "passive detect 모드"],
    nextAction: "현재 명령을 실제 출력 감시 모드로 다시 붙이면 파일/테스트 단위 조언이 가능해집니다.",
  };
}
