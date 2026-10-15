import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { embed } from "../src/rag/embedding";
import { supabaseRequest } from "../src/rag/supabase";

const files = ["recipes.md", "nutrition_rules.md", "training_templates.md", "recovery_rules.md", "personal_preferences.md"];

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.EMBEDDING_MODEL)
    throw new Error("Для ingest нужны SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и EMBEDDING_MODEL");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_publishable_"))
    throw new Error("SUPABASE_SERVICE_ROLE_KEY содержит publishable key; нужен секретный legacy service_role key");
  const chunks: { file: string; heading: string; content: string; embedding: string }[] = [];
  for (const file of files) {
    const markdown = await readFile(path.join(process.cwd(), "knowledge", file), "utf8");
    const sections = markdown.split(/^## /m).slice(1);
    if (!sections.length) throw new Error(`Нет секций ## в knowledge/${file}`);
    for (const section of sections) {
      const [heading, ...body] = section.split(/\r?\n/);
      const content = body.join("\n").trim();
      if (!content) throw new Error(`Пустая секция ${heading} в knowledge/${file}`);
      const vector = await embed(`${heading}\n${content}`);
      chunks.push({ file, heading: heading.trim(), content, embedding: `[${vector.join(",")}]` });
    }
  }
  const inserted = await supabaseRequest("rpc/replace_knowledge_chunks", {
    method: "POST",
    body: JSON.stringify({ chunks, model_name: process.env.EMBEDDING_MODEL }),
  });
  if (inserted !== chunks.length) throw new Error(`Supabase сохранил ${inserted} из ${chunks.length} секций`);
  console.log(`Загружено ${chunks.length} секций из ${files.length} файлов`);
}

main().catch((error) => {
  console.error("Ошибка загрузки базы знаний", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
