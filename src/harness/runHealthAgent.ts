import { MCPServerStdio, type AgentInputItem } from "@openai/agents";
import OpenAI from "openai";
import { runHealthCoach, saveApprovedPlan } from "../agents/healthCoach";
import type { ToolDiagnostics } from "../agents/healthCoachMcp";
import { runSafetyReviewer } from "../agents/safetyReviewer";
import { getServersConfig } from "../mcp/servers.config";
import { ACTIVE_PROMPTS, loadPrompt } from "./promptVersions";
import { recordRound, type RoundState } from "./rounds";
import { MIN_SAFE_SCORE, summarizeScore } from "./score";
import { traceRun } from "./traceRun";
import type { SafetyReview } from "./validateReview";

const medicalRequest =
  /лекар|препарат|табл|капсул|инъекц|укол|доз|давлени|диагноз|лечени|симптом|болезн/i;

export type HealthAgentResult = {
  plan: string;
  review: SafetyReview;
  blockedReason: string | null;
  rounds: RoundState[];
  toolCalls: string[];
  toolEvents: ToolDiagnostics["toolEvents"];
  finalScore: number | null;
  improved: boolean;
  promptVersions: typeof ACTIVE_PROMPTS;
  durationMs: number;
};

export async function runHealthAgent(
  task: string,
  maxRounds = 3,
  diagnostics: ToolDiagnostics = { toolCalls: [], toolEvents: [] },
): Promise<HealthAgentResult> {
  const startedAt = Date.now();
  const progress = { rounds: [] as RoundState[], plan: "" };
  try {
    return await runHealthAgentCore(task, maxRounds, diagnostics, startedAt, progress);
  } catch (error) {
    try {
      await traceRun(task, process.env.OPENROUTER_MODEL ?? "", {
        promptVersions: ACTIVE_PROMPTS,
        rounds: progress.rounds,
        toolCalls: diagnostics.toolCalls,
        toolEvents: diagnostics.toolEvents,
        finalScore: null,
        verdict: "error",
        durationMs: Date.now() - startedAt,
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : String(error),
        },
        planExcerpt: progress.plan.slice(0, 500),
      });
    } catch (traceError) {
      console.error("Не удалось сохранить трейс запуска", {
        error: traceError instanceof Error ? traceError.message : String(traceError),
      });
    }
    throw error;
  }
}

async function runHealthAgentCore(
  task: string,
  maxRounds: number,
  diagnostics: ToolDiagnostics,
  startedAt: number,
  progress: { rounds: RoundState[]; plan: string },
): Promise<HealthAgentResult> {
  const rounds = progress.rounds;
  if (!Number.isInteger(maxRounds) || maxRounds < 1)
    throw new Error("maxRounds должен быть положительным целым числом");

  async function finish(result: HealthAgentResult, traceRounds = result.rounds) {
    try {
      await traceRun(task, process.env.OPENROUTER_MODEL ?? "", result, traceRounds);
    } catch (error) {
      console.error("Не удалось сохранить трейс запуска", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return result;
  }

  if (medicalRequest.test(task)) {
    const review: SafetyReview = {
      verdict: "needs_human_professional",
      score: 0,
      issues: ["Запрос относится к медицинской помощи"],
    };
    return finish({
      plan: "",
      review,
      blockedReason: "Для такого запроса требуется вмешательство человека.",
      rounds: [],
      toolCalls: diagnostics.toolCalls,
      toolEvents: diagnostics.toolEvents,
      finalScore: null,
      improved: false,
      promptVersions: ACTIVE_PROMPTS,
      durationMs: Date.now() - startedAt,
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model)
    throw new Error("Заполните OPENROUTER_API_KEY и OPENROUTER_MODEL в .env");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
  const connected: MCPServerStdio[] = [];
  try {
  for (const config of getServersConfig().filter((server) => server.enabled)) {
    const server = new MCPServerStdio({
      ...config,
      cwd: process.cwd(),
      toolFilter: config.name === "markdown-health" ? { blockedToolNames: ["save_health_plan", "append_daily_log"] } : undefined,
      errorFunction: null,
    });
    connected.push(server);
    await server.connect();
  }
  const mcpServer = connected.find((server) => server.name === "markdown-health");
  const [coachPrompt, reviewerPrompt] = await Promise.all([
    loadPrompt("healthCoach", ACTIVE_PROMPTS.coach),
    loadPrompt("safetyReviewer", ACTIVE_PROMPTS.reviewer),
  ]);
  const shoppingRequested = /покупк|покупок|список продуктов/i.test(task);
  const savedPlanReference =
    /(?:к|для|по)\s+(?:(?:моему|этому|сохран[её]нному|готовому|последнему|существующему|текущему)\s+)?(?:план[ауе]|меню)/i.test(task);
  const explicitlyNewPlan =
    /(?:состав|созд|сдела|подготов|предлож|разработ)[а-яё]*\s+(?:(?:мне|нов[а-яё]*|подробн[а-яё]*)\s+){0,3}(?:план|меню)/i.test(task) ||
    /нов[а-яё]*\s+(?:план|меню)/i.test(task);
  const newPlanRequested = explicitlyNewPlan ||
    (!savedPlanReference && /(?:план|меню)\s+(?:питания\s+)?на\s+(?:завтра|сегодня|неделю|день)/i.test(task));
  let previousPlan: string | null = null;
  if (shoppingRequested && !newPlanRequested && mcpServer) {
    try {
      const content = (await mcpServer.readResource("plans://latest")).contents[0];
      if (!content || typeof content.text !== "string") throw new Error("MCP resource plans://latest не содержит текст");
      previousPlan = content.text
        .replace(/^# Финальный план\s*/, "")
        .trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || String(error).includes("ENOENT"))
        throw new Error("Сохранённый план не найден. Сначала составьте и одобрите план.");
      throw error;
    }
    if (!previousPlan)
      throw new Error("Сохранённый план пуст. Сначала составьте и одобрите план.");
  }
  const coachHistory: AgentInputItem[] = previousPlan
    ? [{ role: "user", content: task }, { role: "assistant", status: "completed", content: [{ type: "output_text", text: previousPlan }] }]
    : [];
  const result = (plan: string, review: SafetyReview, blockedReason: string | null = null): HealthAgentResult => ({
    plan,
    review,
    blockedReason,
    toolCalls: diagnostics.toolCalls,
    toolEvents: diagnostics.toolEvents,
    rounds: !plan
      ? rounds.map((state) => ({ ...state, plan: "" }))
      : rounds,
    ...summarizeScore(rounds),
    promptVersions: ACTIVE_PROMPTS,
    durationMs: Date.now() - startedAt,
  });

  let plan = previousPlan ?? await runHealthCoach(client, model, task, coachPrompt, diagnostics, coachHistory, connected);
  progress.plan = plan;
  if (!previousPlan && !diagnostics.toolEvents.some((event) =>
    event.name === "searchKnowledge" && event.status === "ok" && (event.chunkCount ?? 0) > 0))
    throw new Error("Health Coach не выполнил успешный поиск в базе знаний перед созданием плана");
  let review: SafetyReview = {
    verdict: "revise",
    score: 0,
    issues: [],
  };

  for (let round = 1; round <= maxRounds; round++) {
    review = await runSafetyReviewer(
      client,
      model,
      plan, // Reviewer получает только текст плана и не имеет tools: у него не должно быть побочных эффектов.
      reviewerPrompt,
    );
    if (review.verdict === "approve" && review.score < MIN_SAFE_SCORE)
      review = {
        ...review,
        verdict: "revise",
        issues: [...review.issues, `Оценка ${review.score}/10 ниже порога ${MIN_SAFE_SCORE}/10. Пересмотри план и устрани замечания.`],
      };
    console.log("Раунд проверки", {
      round,
      verdict: review.verdict,
      score: review.score,
      issuesCount: review.issues.length,
    });
    recordRound(rounds, round, plan, review);

    if (review.verdict === "needs_human_professional") {
      return finish(result("", review), rounds);
    }
    if (review.verdict === "approve") {
      // Основной план в data/output.md сохраняет только harness после approve и порога score.
      if (mcpServer) await saveApprovedPlan(plan, shoppingRequested, diagnostics, mcpServer);
      return finish(result(plan, review), rounds);
    }
    if (round < maxRounds) {
      plan = await runHealthCoach(
        client,
        model,
        `Замечания reviewer-а:\n- ${review.issues.join("\n- ")}\nПерепиши последний план с учётом замечаний.`,
        coachPrompt,
        diagnostics,
        coachHistory,
        connected,
      );
      progress.plan = plan;
    }
  }

  return finish(result("", review, `После ${rounds.length} раундов план не получил одобрение. План не выдан.`), rounds);
  } finally {
    await Promise.all(connected.map((server) => server.close()));
  }
}
