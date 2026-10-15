import type { UIMessage } from "ai";
import type { AgentEvent } from "./agentEvents";
import type { HealthAgentResult } from "./runHealthAgent";

export type ChatRunResult = Pick<HealthAgentResult, "review" | "blockedReason" | "finalScore" | "promptVersions" | "durationMs"> & {
  roundCount: number;
};

export type HealthChatMessage = UIMessage<unknown, {
  event: AgentEvent;
  result: ChatRunResult;
  failure: { message: string };
}>;
