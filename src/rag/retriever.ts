import { embed } from "./embedding";
import { supabaseRequest } from "./supabase";

export type KnowledgeChunk = { file: string; heading: string; content: string; similarity: number };

export async function searchKnowledge(query: string, topK = 5): Promise<KnowledgeChunk[]> {
  if (!query.trim()) throw new Error("Поисковый запрос к базе знаний пуст");
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) throw new Error("topK должен быть целым числом от 1 до 20");
  const model = process.env.EMBEDDING_MODEL;
  if (!model) throw new Error("Для поиска нужен EMBEDDING_MODEL");
  const embedding = await embed(query);
  const data = await supabaseRequest("rpc/search_knowledge", {
    method: "POST",
    body: JSON.stringify({ query_embedding: `[${embedding.join(",")}]`, match_count: topK, expected_model: model }),
  });
  if (!Array.isArray(data)) throw new Error("Supabase вернул некорректный результат search_knowledge");
  return data as KnowledgeChunk[];
}
