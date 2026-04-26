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

export type SessionSignals = {
  recentLines: string[];
  repeatedFailureCount: number;
  repeatedFailureKey: string | null;
  contextPercent: number;
  tokenEtaMinutes: number | null;
  resourceUsage: ResourceUsage;
  idleSeconds: number;
};

export type CoachResult = {
  status: SessionStatus;
  summary: string;
  risk: string;
  recommendation: string;
  petMessage: string;
};

export type OverlayState = {
  status: SessionStatus;
  petState: "idle" | "walking" | "alert" | "happy";
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
  };
};
