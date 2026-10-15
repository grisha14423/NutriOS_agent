import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const listFavoriteRecipesSchema = z.object({});
export const listFavoriteRecipesDescription =
  "Прочитать любимые быстрые рецепты пользователя из data/recipes.md. Вызывай, когда нужны идеи блюд или меню с учётом предпочтений; сверяй состав с ограничениями профиля.";

export async function listFavoriteRecipes() {
  return readFile(path.join(process.cwd(), "data", "recipes.md"), "utf8");
}
