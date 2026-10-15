import type { SafetyReview } from "./validateReview";

export type AgentStage =
  | "reading_profile"
  | "searching_knowledge"
  | "generating_plan"
  | "reviewing_safety"
  | "revising"
  | "final_approved_plan";

export type AgentEvent =
  | {
      type: "stage";
      stage: AgentStage;
      status: "running" | "completed";
      round?: number;
      query?: string;
      verdict?: SafetyReview["verdict"];
      score?: number;
    }
  | {
      type: "tool";
      id: string;
      name: string;
      source: string;
      status: "running" | "ok" | "error";
      durationMs?: number;
      query?: string;
      chunkCount?: number;
    };

export type AgentEventHandler = (event: AgentEvent) => void;
