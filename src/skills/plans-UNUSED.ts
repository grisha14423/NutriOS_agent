import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const savePlanSchema = z.object({
  markdown: z
    .string()
    .min(1)
    .describe(
      "Полный одобренный wellness-план в Markdown, без изменений после проверки Safety Reviewer.",
    ),
});
export const savePlanDescription =
  "Сохранить финальный план в data/output.md. Доступен только после одобрения Safety Reviewer и проверки порога безопасности harness. Передай ровно одобренный текст плана.";

export async function savePlan(markdown: string) {
  const plan = savePlanSchema.parse({ markdown }).markdown;
  await writeFile(
    path.join(process.cwd(), "data", "output.md"),
    `# Финальный план\n\n${plan.trim()}\n`,
    "utf8",
  );
  return "ok";
}
