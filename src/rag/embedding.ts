export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENROUTER_API_KEY;
  const model = process.env.EMBEDDING_MODEL;
  const baseURL = process.env.EMBEDDING_BASE_URL ?? "https://openrouter.ai/api/v1";
  if (!apiKey || !model) throw new Error("Для embeddings нужны EMBEDDING_MODEL и EMBEDDING_API_KEY или OPENROUTER_API_KEY");
  const response = await fetch(`${baseURL.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });
  if (!response.ok) throw new Error(`Embedding API вернул HTTP ${response.status}: ${await response.text()}`);
  const data: unknown = await response.json();
  const vector = (data as { data?: { embedding?: unknown }[] })?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== 1536 || !vector.every((item) => typeof item === "number" && Number.isFinite(item)))
    throw new Error("Embedding API должен вернуть числовой вектор размерности 1536");
  return vector;
}
