import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const data = (name: string) => path.join(process.cwd(), "data", name);
const server = new McpServer({ name: "markdown-health", version: "1.0.0" });
const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

async function recentLogs(days: number) {
  const log = await readFile(data("log.md"), "utf8");
  return log.split(/(?=^##\s+)/m).filter((part) => /^##\s+/m.test(part)).slice(-days).join("\n").trim();
}

server.registerTool("read_profile", { description: "Прочитать профиль пользователя перед персональным планом." },
  async () => text(await readFile(data("profile.md"), "utf8")));
server.registerTool("read_recent_logs", {
  description: "Прочитать последние N записанных дней дневника, от 1 до 30.",
  inputSchema: { days: z.number().int().min(1).max(30) },
}, async ({ days }) => text(await recentLogs(days)));
server.registerTool("append_daily_log", {
  description: "Добавить новую запись в дневник в Markdown.",
  inputSchema: { entry: z.string().min(1) },
}, async ({ entry }) => {
  await appendFile(data("log.md"), `\n${entry.trim()}\n`, "utf8");
  return text("ok");
});
server.registerTool("save_health_plan", {
  description: "Сохранить одобренный wellness-план. Вызывается harness только после проверки Safety Reviewer.",
  inputSchema: { markdown: z.string().min(1) },
}, async ({ markdown }) => {
  await writeFile(data("output.md"), `# Финальный план\n\n${markdown.trim()}\n`, "utf8");
  return text("ok");
});
server.registerTool("list_recipes", { description: "Прочитать любимые рецепты пользователя." },
  async () => text(await readFile(data("recipes.md"), "utf8")));

for (const [name, uri, filename] of [
  ["profile", "profile://me", "profile.md"],
  ["recipes", "recipes://all", "recipes.md"],
  ["plans", "plans://latest", "output.md"],
] as const) {
  server.registerResource(name, uri, { mimeType: "text/markdown" },
    async () => ({ contents: [{ uri, mimeType: "text/markdown", text: await readFile(data(filename), "utf8") }] }));
}
server.registerResource("logs", "logs://recent", { mimeType: "text/markdown" },
  async () => ({ contents: [{ uri: "logs://recent", mimeType: "text/markdown", text: await recentLogs(7) }] }));

await server.connect(new StdioServerTransport());
