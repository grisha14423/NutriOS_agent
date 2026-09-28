import OpenAI from "openai";

export const COACH_PROMPT = `Ты Health Coach для wellness-задач. Даёшь только рекомендации по питанию,
тренировкам, восстановлению и привычкам. Не ставь диагнозы, не лечи и не советуй лекарства.
Если задача касается симптомов, заболеваний, лечения или препаратов, откажись от плана и
посоветуй обратиться к профильному специалисту. Формат: цель на день, питание, активность,
восстановление, одна привычка. Пиши по-русски, конкретно и реалистично.`;

export async function runHealthCoach(
  client: OpenAI,
  model: string,
  input: string,
) {
  const response = await client.responses.create({
    model,
    instructions: COACH_PROMPT,
    input,
    store: false,
  });
  if (!response.output_text)
    throw new Error("Модель не вернула текстовый ответ");
  return response.output_text;
}
