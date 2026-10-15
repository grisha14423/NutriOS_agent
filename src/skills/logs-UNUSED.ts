import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const getRecentLogSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .describe(
      "Сколько последних записанных дней дневника вернуть, от 1 до 30. Если срок не указан, выбери 7.",
    ),
});
export const getRecentLogDescription =
  "Прочитать последние N датированных записей из data/log.md. Используй, когда пользователь просит учесть дневник, недавнее питание, сон или активность. days означает число записанных дней, а не календарное окно от сегодняшней даты.";

export async function getRecentLog(days: number) {
  const log = await readFile(
    path.join(process.cwd(), "data", "log.md"),
    "utf8",
  );
  const entries = log
    .split(/(?=^##\s+)/m)
    .filter((part) => /^##\s+/m.test(part));
  return entries.slice(-days).join("\n").trim();
}
