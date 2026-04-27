export type SessionStatus = "normal" | "watch" | "risk" | "intervene";

export type AgentOutputEvent = {
  type: "agent_output";
  stream: "stdout" | "stderr";
  line: string;
  timestamp: number;
};

export type ResourceUsage = {
  cpuPercent: number;
  memoryPercent: number;
};

export type ActivityPhase = "test" | "build" | "file_edit" | "dependency_install" | "waiting" | "unknown";

export type FailureKind =
  | "test_failure"
  | "build_error"
  | "auth_error"
  | "network_error"
  | "timeout"
  | "missing_file"
  | "type_error"
  | "unknown_error";

export type StuckReason = "repeated_failure" | "same_file_repeated" | "long_idle" | "output_flood";

export type ResourceTrend = "normal" | "high_cpu" | "high_memory" | "high_cpu_memory";

export type SessionSignals = {
  recentLines: string[];
  repeatedFailureCount: number;
  repeatedFailureKey: string | null;
  contextPercent: number;
  tokenEtaMinutes: number | null;
  resourceUsage: ResourceUsage;
  idleSeconds: number;
  activityPhase: ActivityPhase;
  failureKind: FailureKind | null;
  stuckReason: StuckReason | null;
  resourceTrend: ResourceTrend;
};

export type CoachResult = {
  status: SessionStatus;
  summary: string;
  risk: string;
  recommendation: string;
  petMessage: string;
  evidence: string[];
  nextAction: string;
};

export type PetBehaviorState =
  | "walking"
  | "sitting"
  | "lying"
  | "stretching"
  | "sniffing"
  | "watching"
  | "happy"
  | "alert"
  | "sleepy"
  | "petting"
  | "kennel";

export type OverlayState = {
  status: SessionStatus;
  petState: PetBehaviorState;
  message: string;
  popup: {
    title: string;
    contextPercent: number;
    tokenEtaMinutes: number | null;
    repeatedFailureCount: number;
    repeatedFailureKey: string | null;
    cpuPercent: number;
    memoryPercent: number;
    summary: string;
    recommendation: string;
    isDemo?: boolean;
  };
};
