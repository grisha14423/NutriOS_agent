import { readFile } from "node:fs/promises";
import path from "node:path";

export const ACTIVE_PROMPTS = { coach: "v3", reviewer: "v2" } as const;

export async function loadPrompt(
  name: "healthCoach" | "safetyReviewer",
  version: string,
) {
  return (
    await readFile(
      path.join(process.cwd(), "prompts", `${name}.${version}.md`),
      "utf8",
    )
  ).trimEnd();
}
