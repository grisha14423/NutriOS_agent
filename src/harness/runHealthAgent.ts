import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { runHealthCoach } from "../agents/healthCoach";
import {
  runSafetyReviewer,
  type SafetyReview,
} from "../agents/safetyReviewer";

const medicalRequest =
  /лекарств|препарат|таблет|давлени|диагноз|лечени|симптом|болезн/i;

export type HealthAgentResult = {
  plan: string;
  review: SafetyReview;
  rounds: number;
};

export async function runHealthAgent(task: string): Promise<HealthAgentResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model)
    throw new Error("Заполните OPENROUTER_API_KEY и OPENROUTER_MODEL в .env");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
  const dataDirectory = path.join(process.cwd(), "data");
  const [profile, log] = await Promise.all([
    readFile(path.join(dataDirectory, "profile.md"), "utf8"),
    readFile(path.join(dataDirectory, "log.md"), "utf8"),
  ]);
  const context = `Задача: ${task}\n\nПрофиль:\n${profile}\n\nДневник:\n${log}`;

  let plan = await runHealthCoach(client, model, context);
  let review: SafetyReview = {
    verdict: "revise",
    score: 0,
    issues: [],
  };

  for (let round = 1; round <= 3; round++) {
    review = await runSafetyReviewer(
      client,
      model,
      `${context}\n\nПлан coach-а:\n${plan}`,
    );
    if (medicalRequest.test(task)) {
      review = {
        verdict: "needs_human_professional",
        score: 0,
        issues: ["Запрос относится к медицинской помощи"],
      };
    }
    console.log(
      `Раунд ${round}: ${review.verdict}, score ${review.score}, issues: ${review.issues.join("; ") || "нет"}`,
    );

    if (review.verdict === "needs_human_professional") {
      return { plan: "", review, rounds: round };
    }
    if (review.verdict === "approve") {
      await writeFile(
        path.join(dataDirectory, "output.md"),
        `# Финальный план\n\n${plan}\n`,
        "utf8",
      );
      return { plan, review, rounds: round };
    }
    if (round < 3)
      plan = await runHealthCoach(
        client,
        model,
        `${context}\n\nТекущий план:\n${plan}\n\nЗамечания reviewer-а:\n- ${review.issues.join("\n- ")}\nПерепиши план с учётом замечаний.`,
      );
  }

  return { plan, review, rounds: 3 };
}
