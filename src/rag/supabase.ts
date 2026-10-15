export async function supabaseRequest(path: string, init: RequestInit): Promise<unknown> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Для RAG нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`Supabase ${path} вернул HTTP ${response.status}: ${await response.text()}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
