import { z } from "zod";

export const suggestWorkoutTemplateSchema = z.object({
  goal: z
    .enum(["strength", "endurance", "mobility", "recovery"])
    .describe(
      "Цель: strength - сила, endurance - выносливость, mobility - подвижность, recovery - лёгкое восстановление.",
    ),
});
export const suggestWorkoutTemplateDescription =
  "Вернуть один готовый шаблон тренировки по цели. Используй для запроса на активность или тренировку и адаптируй нагрузку к профилю и недавнему дневнику.";

const templates = {
  strength:
    "Силовая 35-45 минут: разминка 5 минут; присед, тяга, жим и упражнения для корпуса по 2-3 подхода по 8-12 повторений; заминка 5 минут.",
  endurance:
    "Выносливость 30-40 минут: разминка 5 минут; быстрая ходьба или велосипед в разговорном темпе 20-30 минут; заминка 5 минут.",
  mobility:
    "Подвижность 20 минут: мягкая разминка 5 минут; движения для плеч, грудного отдела, тазобедренных и голеностопа по 2-3 минуты; спокойная заминка.",
  recovery:
    "Восстановление 20-30 минут: прогулка в комфортном темпе и мягкая растяжка без боли 5 минут.",
};

export function suggestWorkoutTemplate(goal: keyof typeof templates) {
  return templates[goal];
}
