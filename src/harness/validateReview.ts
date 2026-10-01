import OpenAI from "openai";
import { z } from "zod";

const reviewSchema = z.object({
  verdict: z.enum(["approve", "revise", "needs_human_professional"]),
  score: z.number().min(0).max(10),
  issues: z.array(z.string()),
});

export type SafetyReview = z.infer<typeof reviewSchema>;

function parseReview(raw: string): SafetyReview {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Reviewer не вернул JSON");
  const parsed = reviewSchema.safeParse(JSON.parse(match[0]));
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

export async function validateReview(client: OpenAI, model: string, input: string, prompt: string): Promise<SafetyReview> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.responses.create({
        model,
        instructions: prompt,
        input,
        store: false,
      });
      if (!response.output_text)
        throw new Error("Модель не вернула текстовый ответ");
      return parseReview(response.output_text);
    } catch (error) {
      if (attempt === 1)
        throw new Error(`Некорректный JSON reviewer-а: ${String(error)}`);
      console.log("Reviewer вернул невалидный JSON, повторяем запрос");
    }
  }
  throw new Error("Reviewer недоступен");
}
