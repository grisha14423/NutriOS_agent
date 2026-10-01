import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { runHealthCoach } from "../agents/healthCoach";
import { runSafetyReviewer } from "../agents/safetyReviewer";
import { ACTIVE_PROMPTS, loadPrompt } from "./promptVersions";
import { recordRound, type RoundState } from "./rounds";
import { MIN_SAFE_SCORE, summarizeScore } from "./score";
import type { SafetyReview } from "./validateReview";

const medicalRequest =
  /лекар|препарат|табл|капсул|инъекц|укол|доз|давлени|диагноз|лечени|симптом|болезн/i;

export type HealthAgentResult = {
  plan: string;
  review: SafetyReview;
  blockedReason: string | null;
  rounds: RoundState[];
  finalScore: number | null;
  improved: boolean;
  promptVersions: typeof ACTIVE_PROMPTS;
  durationMs: number;
};

export async function runHealthAgent(task: string, maxRounds = 3): Promise<HealthAgentResult> {
  const startedAt = Date.now();
  if (!Number.isInteger(maxRounds) || maxRounds < 1)
    throw new Error("maxRounds должен быть положительным целым числом");

  if (medicalRequest.test(task)) {
    const review: SafetyReview = {
      verdict: "needs_human_professional",
      score: 0,
      issues: ["Запрос относится к медицинской помощи"],
    };
    return {
      plan: "",
      review,
      blockedReason: "Для такого запроса требуется вмешательство человека.",
      rounds: [],
      finalScore: null,
      improved: false,
      promptVersions: ACTIVE_PROMPTS,
      durationMs: Date.now() - startedAt,
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model)
    throw new Error("Заполните OPENROUTER_API_KEY и OPENROUTER_MODEL в .env");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
  const dataDirectory = path.join(process.cwd(), "data");
  const [profile, log, coachPrompt, reviewerPrompt] = await Promise.all([
    readFile(path.join(dataDirectory, "profile.md"), "utf8"),
    readFile(path.join(dataDirectory, "log.md"), "utf8"),
    loadPrompt("healthCoach", ACTIVE_PROMPTS.coach),
    loadPrompt("safetyReviewer", ACTIVE_PROMPTS.reviewer),
  ]);
  const context = `Задача: ${task}\n\nПрофиль:\n${profile}\n\nДневник:\n${log}`;
  const rounds: RoundState[] = [];
  const result = (plan: string, review: SafetyReview, blockedReason: string | null = null): HealthAgentResult => ({
    plan,
    review,
    blockedReason,
    rounds: !plan
      ? rounds.map((state) => ({ ...state, plan: "" }))
      : rounds,
    ...summarizeScore(rounds),
    promptVersions: ACTIVE_PROMPTS,
    durationMs: Date.now() - startedAt,
  });

  let plan = await runHealthCoach(client, model, context, coachPrompt);
  let review: SafetyReview = {
    verdict: "revise",
    score: 0,
    issues: [],
  };

  for (let round = 1; round <= maxRounds; round++) {
    review = await runSafetyReviewer(
      client,
      model,
      `${context}\n\nПлан coach-а:\n${plan}`,
      reviewerPrompt,
    );
    console.log(
      `Раунд ${round}: ${review.verdict}, score ${review.score}, issues: ${review.issues.join("; ") || "нет"}`,
    );
    recordRound(rounds, round, review.verdict === "needs_human_professional" ? "" : plan, review);

    if (review.verdict === "needs_human_professional") {
      return result("", review);
    }
    if (review.verdict === "approve") {
      if (review.score < MIN_SAFE_SCORE)
        return result(
          "",
          review,
          `Reviewer одобрил план, но оценка безопасности ${review.score}/10 ниже порога ${MIN_SAFE_SCORE}/10. План не выдан.`,
        );
      await writeFile(
        path.join(dataDirectory, "output.md"),
        `# Финальный план\n\n${plan}\n`,
        "utf8",
      );
      return result(plan, review);
    }
    if (round < maxRounds)
      plan = await runHealthCoach(
        client,
        model,
        `${context}\n\nТекущий план:\n${plan}\n\nЗамечания reviewer-а:\n- ${review.issues.join("\n- ")}\nПерепиши план с учётом замечаний.`,
        coachPrompt,
      );
  }

  return result("", review, `После ${rounds.length} раундов план не получил одобрение. План не выдан.`);
}
