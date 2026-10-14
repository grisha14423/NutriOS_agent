import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import type { ToolDiagnostics } from "../src/agents/healthCoachTools";
import { ACTIVE_PROMPTS } from "../src/harness/promptVersions";
import { runHealthAgent } from "../src/harness/runHealthAgent";
import type { RunTrace } from "../src/harness/traceRun";

async function main() {
  const tracePath = process.argv[2];
  if (!tracePath) throw new Error("Укажите файл трейса: npm run replay runs/run-XXX.json");

  const filePath = path.resolve(tracePath);
  const old = JSON.parse(await readFile(filePath, "utf8")) as RunTrace;
  if (typeof old.task !== "string" || !old.task.trim() || !Array.isArray(old.rounds) || !Array.isArray(old.toolCalls))
    throw new Error(`Некорректный трейс: ${filePath}`);

  nextEnv.loadEnvConfig(process.cwd());
  const diagnostics: ToolDiagnostics = { toolCalls: [], toolEvents: [] };
  let current: Awaited<ReturnType<typeof runHealthAgent>> | null = null;
  let currentError: string | null = null;
  try {
    current = await runHealthAgent(old.task, 3, diagnostics);
  } catch (error) {
    currentError = error instanceof Error ? error.message : String(error);
  }
  const rows = [
    { field: "verdict", old: old.verdict, current: current?.review.verdict ?? "error" },
    { field: "score", old: String(old.finalScore ?? "-"), current: String(current?.finalScore ?? "-") },
    { field: "rounds", old: String(old.rounds.length), current: current ? String(current.rounds.length) : "см. новый трейс" },
    { field: "toolCalls", old: old.toolCalls.join(", ") || "-", current: diagnostics.toolCalls.join(", ") || "-" },
    { field: "promptVersions", old: JSON.stringify(old.promptVersions), current: JSON.stringify(current?.promptVersions ?? ACTIVE_PROMPTS) },
  ];
  if (old.error || currentError)
    rows.push({ field: "error", old: old.error?.message ?? "-", current: currentError ?? "-" });
  console.log(`Replay: ${filePath}`);
  console.table([
    ...rows.map((row) => ({ ...row, diff: row.old === row.current ? "=" : "changed" })),
    { field: "model", old: old.model, current: process.env.OPENROUTER_MODEL ?? "", diff: old.model === (process.env.OPENROUTER_MODEL ?? "") ? "=" : "changed" },
  ]);
  if (currentError) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Replay завершился с ошибкой", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
