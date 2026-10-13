import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const generateShoppingListSchema = z.object({
  planMarkdown: z
    .string()
    .min(1)
    .describe(
      "Полный текст одобренного плана питания в Markdown, из которого нужно извлечь продукты.",
    ),
});
export const generateShoppingListDescription =
  "Извлечь продукты из раздела питания одобренного плана и записать список в data/shopping.md. Вызывай, когда пользователь просит список покупок к плану. Передавай тот же план, который одобрил reviewer.";

const products: [RegExp, string][] = [
  [/овсян|гранол/i, "Овсяные хлопья или гранола"],
  [/яйц|омлет/i, "Яйца"],
  [/куриц|курин/i, "Курица"],
  [/индейк|индюш/i, "Индейка"],
  [/рыб|лосос|треск/i, "Рыба"],
  [/греч/i, "Гречка"],
  [/рис/i, "Рис"],
  [/макарон|паст[аыу]/i, "Макароны"],
  [/хлеб|тост/i, "Хлеб"],
  [/банан/i, "Бананы"],
  [/яблок/i, "Яблоки"],
  [/ягод/i, "Ягоды"],
  [/орех|кешью|арахис/i, "Орехи"],
  [/творог/i, "Творог без лактозы"],
  [/йогурт/i, "Йогурт без лактозы"],
  [/сыр/i, "Сыр без лактозы"],
  [/молок/i, "Молоко без лактозы или растительное"],
  [/помидор|томат/i, "Помидоры"],
  [/огур/i, "Огурцы"],
  [/морков/i, "Морковь"],
  [/брокколи/i, "Брокколи"],
  [/кабач/i, "Кабачки"],
  [/салатн|салат из|лист.*салат/i, "Салатные листья"],
  [/авокад/i, "Авокадо"],
  [/оливков.*масл/i, "Оливковое масло"],
];

export async function generateShoppingList(planMarkdown: string) {
  const plan = generateShoppingListSchema.parse({ planMarkdown }).planMarkdown;
  const nutrition =
    plan.match(
      /(?:^|\n)(?:#{1,3}\s*)?(?:\*\*)?Питание(?:\*\*)?[^\n]*\n([\s\S]*?)(?=\n(?:#{1,3}\s*)?(?:\*\*)?(?:Активность|Тренировка|Восстановление|Одна привычка)(?:\*\*)?|$)/i,
    )?.[1] ?? plan;
  const found = products
    .filter(([pattern]) => pattern.test(nutrition))
    .map(([, name]) => name);
  if (!found.length)
    throw new Error("Не удалось извлечь продукты из одобренного плана питания");
  await writeFile(
    path.join(process.cwd(), "data", "shopping.md"),
    `# Список покупок\n\n${found.map((name) => `- ${name}`).join("\n")}\n`,
    "utf8",
  );
  return found;
}
