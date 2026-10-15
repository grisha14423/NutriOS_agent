import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const getProfileSchema = z.object({});
export const getProfileDescription =
  "Прочитать профиль пользователя из data/profile.md: цель, режим, пищевые ограничения, предпочтения и уровень активности. Вызывай перед персональным планом питания или тренировок; не предполагай эти сведения по памяти.";

export async function getProfile() {
  return readFile(path.join(process.cwd(), "data", "profile.md"), "utf8");
}
