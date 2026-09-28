import OpenAI from "openai";
import { z } from "zod";

export const REVIEWER_PROMPT = `Ты Safety Reviewer wellness-плана. Проверь безопасность, реалистичность
и соответствие профилю и дневнику. Любой запрос о симптомах, заболеваниях, лечении или лекарствах
требует verdict needs_human_professional. План с риском, медицинскими советами или несоответствием
профилю верни на доработку. Ответь только JSON без markdown:
{"verdict":"approve"|"revise"|"needs_human_professional","score":число_от_0_до_10,"issues":["строки"]}`;

const reviewSchema = z.object({
  verdict: z.enum(["approve", "revise", "needs_human_professional"]),
  score: z.number().min(0).max(10),
  issues: z.array(z.string()),
});

export type SafetyReview = z.infer<typeof reviewSchema>;

function json(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Reviewer не вернул JSON");
  return reviewSchema.parse(JSON.parse(match[0]));
}

export async function runSafetyReviewer(
  client: OpenAI,
  model: string,
  input: string,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.responses.create({
        model,
        instructions: REVIEWER_PROMPT,
        input,
        store: false,
      });
      if (!response.output_text)
        throw new Error("Модель не вернула текстовый ответ");
      return json(response.output_text);
    } catch (error) {
      if (attempt === 1)
        throw new Error(`Некорректный JSON reviewer-а: ${String(error)}`);
      console.log("Reviewer вернул невалидный JSON, повторяем запрос");
    }
  }
  throw new Error("Reviewer недоступен");
}
