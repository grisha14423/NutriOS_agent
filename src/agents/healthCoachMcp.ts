import { Agent, OpenAIResponsesModel, Runner, tool, type MCPServerStdio } from "@openai/agents";
import OpenAI from "openai";
import type { AgentInputItem } from "@openai/agents";
import { z } from "zod";
import { generateShoppingList } from "../skills/shopping";
import { suggestWorkoutTemplate, suggestWorkoutTemplateDescription, suggestWorkoutTemplateSchema } from "../skills/workouts";
import { searchKnowledge } from "../rag/retriever";

export type ToolDiagnostics = {
  toolCalls: string[];
  toolEvents: { name: string; source: string; status: "ok" | "error"; durationMs: number; query?: string; headings?: string[]; matches?: { file: string; heading: string }[]; chunkCount?: number }[];
};

const toolLabel = (name: string, source: string) => `[${source}] ${name}`;

const workoutTool = tool({
  name: "suggestWorkoutTemplate",
  description: suggestWorkoutTemplateDescription,
  parameters: suggestWorkoutTemplateSchema,
  errorFunction: null,
  execute: async ({ goal }) => suggestWorkoutTemplate(goal),
});

export async function runHealthCoach(
  client: OpenAI,
  model: string,
  input: string,
  prompt: string,
  diagnostics: ToolDiagnostics,
  history: AgentInputItem[],
  mcpServers: MCPServerStdio[],
) {
  const knowledgeTool = tool({
    name: "searchKnowledge",
    description: "Ищи в базе знаний рецепты, правила питания, шаблоны тренировок, правила восстановления. Перед составлением плана найди подходящие материалы.",
    parameters: z.object({ query: z.string().min(1) }),
    errorFunction: null,
    execute: async ({ query }) => {
      const startedAt = Date.now();
      try {
        const chunks = await searchKnowledge(query);
        diagnostics.toolEvents.push({ name: "searchKnowledge", source: "knowledge", status: "ok", durationMs: Date.now() - startedAt, query, headings: chunks.map(({ heading }) => heading), matches: chunks.map(({ file, heading }) => ({ file, heading })), chunkCount: chunks.length });
        return JSON.stringify(chunks);
      } catch (error) {
        diagnostics.toolEvents.push({ name: "searchKnowledge", source: "knowledge", status: "error", durationMs: Date.now() - startedAt, query, headings: [], matches: [], chunkCount: 0 });
        throw error;
      }
    },
  });
  const agent = new Agent({
    name: "Health Coach",
    instructions: prompt,
    model: new OpenAIResponsesModel(client, model),
    modelSettings: { store: false },
    tools: [workoutTool, knowledgeTool],
    mcpServers,
  });
  const started = new Map<string, number>();
  const localTools = new Set(agent.tools.map((item) => item.name));
  const toolSources = new Map<string, string>();
  for (const server of mcpServers) {
    for (const availableTool of await server.listTools()) {
      toolSources.set(availableTool.name.replace(/[^a-zA-Z0-9]/g, "_"), server.name);
    }
  }
  const sourceOf = (name: string) => {
    if (name === "searchKnowledge") return "knowledge";
    if (localTools.has(name)) return "local";
    const source = toolSources.get(name);
    if (!source) throw new Error(`Неизвестный источник tool: ${name}`);
    return source;
  };
  const runner = new Runner({ tracingDisabled: true });
  runner.on("agent_tool_start", (_context, _agent, calledTool) => {
    diagnostics.toolCalls.push(toolLabel(calledTool.name, sourceOf(calledTool.name)));
    started.set(calledTool.name, Date.now());
  });
  runner.on("agent_tool_end", (_context, _agent, calledTool, output) => {
    if (calledTool.name === "searchKnowledge") return;
    diagnostics.toolEvents.push({
      name: calledTool.name,
      source: sourceOf(calledTool.name),
      status: output.startsWith("Error:") ? "error" : "ok",
      durationMs: Date.now() - (started.get(calledTool.name) ?? Date.now()),
    });
  });
  const result = await runner.run(agent, [...history, { role: "user", content: input }], { maxTurns: 16 });
  if (!result.finalOutput) throw new Error("Health Coach не вернул текстовый план");
  history.splice(0, history.length, ...result.history);
  return result.finalOutput;
}

export async function saveApprovedPlan(
  plan: string,
  shoppingRequested: boolean,
  diagnostics: ToolDiagnostics,
  mcpServer: MCPServerStdio,
) {
  diagnostics.toolCalls.push(toolLabel("save_health_plan", "markdown-health"));
  const saveStartedAt = Date.now();
  try {
    const result = await mcpServer.callToolResult("save_health_plan", { markdown: plan });
    if (result.isError) throw new Error("MCP-сервер не сохранил план");
    diagnostics.toolEvents.push({ name: "save_health_plan", source: "markdown-health", status: "ok", durationMs: Date.now() - saveStartedAt });
  } catch (error) {
    diagnostics.toolEvents.push({ name: "save_health_plan", source: "markdown-health", status: "error", durationMs: Date.now() - saveStartedAt });
    throw new Error(`Ошибка MCP tool save_health_plan: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (shoppingRequested) {
    diagnostics.toolCalls.push(toolLabel("generateShoppingList", "local"));
    const shoppingStartedAt = Date.now();
    try {
      await generateShoppingList(plan);
      diagnostics.toolEvents.push({ name: "generateShoppingList", source: "local", status: "ok", durationMs: Date.now() - shoppingStartedAt });
    } catch (error) {
      diagnostics.toolEvents.push({ name: "generateShoppingList", source: "local", status: "error", durationMs: Date.now() - shoppingStartedAt });
      throw new Error(`План сохранён, но список покупок не создан. Ошибка tool generateShoppingList: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
