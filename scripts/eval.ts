import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { runHealthAgent } from "../src/harness/runHealthAgent";

type EvalCase = {
  name: string;
  task: string;
  expect: {
    verdict: "approve" | "needs_human_professional";
    minScore?: number;
    requiredToolCalls?: string[];
    requiredKnowledgeFile?: string;
    stopBeforeModel?: boolean;
  };
};

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const casesDirectory = path.join(process.cwd(), "evals", "cases");
  const files = (await readdir(casesDirectory)).filter((file) => file.endsWith(".json")).sort();
  if (!files.length) throw new Error(`Eval-кейсы не найдены: ${casesDirectory}`);

  const rows = [];
  for (const file of files) {
    const evalCase = JSON.parse(await readFile(path.join(casesDirectory, file), "utf8")) as EvalCase;
    if (!evalCase.name || !evalCase.task || !["approve", "needs_human_professional"].includes(evalCase.expect?.verdict) ||
      (evalCase.expect.requiredToolCalls !== undefined &&
        (!Array.isArray(evalCase.expect.requiredToolCalls) || !evalCase.expect.requiredToolCalls.every((tool) => typeof tool === "string"))) ||
      (evalCase.expect.requiredKnowledgeFile !== undefined &&
        (typeof evalCase.expect.requiredKnowledgeFile !== "string" || !evalCase.expect.requiredKnowledgeFile)) ||
      (evalCase.expect.stopBeforeModel !== undefined && typeof evalCase.expect.stopBeforeModel !== "boolean"))
      throw new Error(`Некорректный eval-кейс: ${file}`);

    try {
      const result = await runHealthAgent(evalCase.task);
      const missingTools = (evalCase.expect.requiredToolCalls ?? []).filter((tool) =>
        !result.toolCalls.some((call) => call.replace(/^\[[^\]]+\] /, "") === (tool === "savePlan" ? "save_health_plan" : tool)));
      const matchedRecipes = result.toolEvents
        .filter((event) => event.name === "searchKnowledge" && event.status === "ok")
        .flatMap((event) => event.matches ?? [])
        .filter((match) => match.file === evalCase.expect.requiredKnowledgeFile);
      const knowledgeUsed = !evalCase.expect.requiredKnowledgeFile ||
        (result.plan.includes(evalCase.expect.requiredKnowledgeFile) &&
          matchedRecipes.some((match) => result.plan.toLocaleLowerCase("ru-RU").includes(match.heading.toLocaleLowerCase("ru-RU"))));
      const stopped = !evalCase.expect.stopBeforeModel ||
        (result.plan === "" && result.rounds.length === 0 && result.toolCalls.length === 0 && result.blockedReason !== null);
      const passed = result.review.verdict === evalCase.expect.verdict &&
        (evalCase.expect.minScore === undefined || (result.finalScore ?? -1) >= evalCase.expect.minScore) &&
        (result.review.verdict !== "needs_human_professional" || result.plan === "") &&
        missingTools.length === 0 && knowledgeUsed && stopped;
      rows.push({ case: evalCase.name, result: passed ? "PASS" : "FAIL", verdict: result.review.verdict, score: result.finalScore ?? "-", rounds: result.rounds.length, missingTools: missingTools.join(", ") || "-", knowledgeSource: evalCase.expect.requiredKnowledgeFile ? (knowledgeUsed ? "ok" : "missing") : "-" });
    } catch (error) {
      rows.push({ case: evalCase.name, result: "FAIL", verdict: error instanceof Error ? error.message : String(error), score: "-", rounds: "-", missingTools: "-", knowledgeSource: "-" });
    }
  }

  console.table(rows);
  if (rows.some((row) => row.result === "FAIL")) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Eval завершился с ошибкой", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
