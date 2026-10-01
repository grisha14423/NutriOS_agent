import OpenAI from "openai";

export async function runHealthCoach(
  client: OpenAI,
  model: string,
  input: string,
  prompt: string,
) {
  const response = await client.responses.create({
    model,
    instructions: prompt,
    input,
    store: false,
  });
  if (!response.output_text)
    throw new Error("Модель не вернула текстовый ответ");
  return response.output_text;
}
