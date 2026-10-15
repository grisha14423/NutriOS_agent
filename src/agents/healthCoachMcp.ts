import { Agent, OpenAIResponsesModel, Runner, tool, type MCPServerStdio } from "@openai/agents";
import OpenAI from "openai";
import type { AgentInputItem } from "@openai/agents";
import { z } from "zod";
import { generateShoppingList } from "../skills/shopping";
import { suggestWorkoutTemplate, suggestWorkoutTemplateDescription, suggestWorkoutTemplateSchema } from "../skills/workouts";

export type ToolDiagnostics = {
  toolCalls: string[];
  toolEvents: { name: string; source: "mcp" | "tool"; status: "ok" | "error"; durationMs: number }[];
};

const toolLabel = (name: string, source: "mcp" | "tool") => `${name} (${source})`;

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
  mcpServer: MCPServerStdio,
) {
  const agent = new Agent({
    name: "Health Coach",
    instructions: prompt,
    model: new OpenAIResponsesModel(client, model),
    modelSettings: { store: false },
    tools: [workoutTool],
    mcpServers: [mcpServer],
  });
  const started = new Map<string, number>();
  const localTools = new Set(agent.tools.map((item) => item.name));
  const runner = new Runner({ tracingDisabled: true });
  runner.on("agent_tool_start", (_context, _agent, calledTool) => {
    const source = localTools.has(calledTool.name) ? "tool" : "mcp";
    diagnostics.toolCalls.push(toolLabel(calledTool.name, source));
    started.set(calledTool.name, Date.now());
  });
  runner.on("agent_tool_end", (_context, _agent, calledTool) => {
    diagnostics.toolEvents.push({
      name: calledTool.name,
      source: localTools.has(calledTool.name) ? "tool" : "mcp",
      status: "ok",
      durationMs: Date.now() - (started.get(calledTool.name) ?? Date.now()),
    });
  });
  const result = await runner.run(agent, [...history, { role: "user", content: input }], { maxTurns: 8 });
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
  diagnostics.toolCalls.push(toolLabel("save_health_plan", "mcp"));
  const saveStartedAt = Date.now();
  try {
    const result = await mcpServer.callToolResult("save_health_plan", { markdown: plan });
    if (result.isError) throw new Error("MCP-сервер не сохранил план");
    diagnostics.toolEvents.push({ name: "save_health_plan", source: "mcp", status: "ok", durationMs: Date.now() - saveStartedAt });
  } catch (error) {
    diagnostics.toolEvents.push({ name: "save_health_plan", source: "mcp", status: "error", durationMs: Date.now() - saveStartedAt });
    throw new Error(`Ошибка MCP tool save_health_plan: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (shoppingRequested) {
    diagnostics.toolCalls.push(toolLabel("generateShoppingList", "tool"));
    const shoppingStartedAt = Date.now();
    try {
      await generateShoppingList(plan);
      diagnostics.toolEvents.push({ name: "generateShoppingList", source: "tool", status: "ok", durationMs: Date.now() - shoppingStartedAt });
    } catch (error) {
      diagnostics.toolEvents.push({ name: "generateShoppingList", source: "tool", status: "error", durationMs: Date.now() - shoppingStartedAt });
      throw new Error(`План сохранён, но список покупок не создан. Ошибка tool generateShoppingList: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
