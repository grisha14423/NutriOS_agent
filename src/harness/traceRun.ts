import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HealthAgentResult } from "./runHealthAgent";
import type { RoundState } from "./rounds";

export type RunTrace = {
  runId: string;
  task: string;
  promptVersions: HealthAgentResult["promptVersions"];
  model: string;
  rounds: { round: number; planExcerpt: string; review: RoundState["review"] }[];
  toolCalls: string[];
  finalScore: number | null;
  verdict: RoundState["review"]["verdict"] | "error";
  durationMs: number;
  createdAt: string;
  error?: { name: string; message: string };
  planExcerpt?: string;
};

export type ErrorRun = {
  promptVersions: HealthAgentResult["promptVersions"];
  rounds: RoundState[];
  toolCalls: string[];
  finalScore: null;
  verdict: "error";
  durationMs: number;
  error: { name: string; message: string };
  planExcerpt: string;
};

export async function traceRun(
  task: string,
  model: string,
  result: HealthAgentResult | ErrorRun,
  rounds: RoundState[] = result.rounds,
) {
  const createdAt = new Date().toISOString();
  const runId = `run-${createdAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const trace: RunTrace = {
    runId,
    task,
    promptVersions: result.promptVersions,
    model,
    rounds: rounds.map(({ round, plan, review }) => ({
      round,
      planExcerpt: plan.slice(0, 500),
      review,
    })),
    toolCalls: result.toolCalls,
    finalScore: result.finalScore,
    verdict: "error" in result ? result.verdict : result.review.verdict,
    durationMs: result.durationMs,
    createdAt,
    ...("error" in result ? { error: result.error, planExcerpt: result.planExcerpt } : {}),
  };
  const runsDirectory = path.join(process.cwd(), "runs");
  await mkdir(runsDirectory, { recursive: true });
  await writeFile(path.join(runsDirectory, `${runId}.json`), JSON.stringify(trace, null, 2) + "\n", { flag: "wx" });
}
