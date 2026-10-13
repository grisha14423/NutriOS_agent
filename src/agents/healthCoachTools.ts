import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { zodResponsesFunction } from "openai/helpers/zod";
import { getProfile, getProfileDescription, getProfileSchema } from "../skills/profile";
import { getRecentLog, getRecentLogDescription, getRecentLogSchema } from "../skills/logs";
import { savePlan } from "../skills/plans";
import { generateShoppingList } from "../skills/shopping";
import { suggestWorkoutTemplate, suggestWorkoutTemplateDescription, suggestWorkoutTemplateSchema } from "../skills/workouts";
import { listFavoriteRecipes, listFavoriteRecipesDescription, listFavoriteRecipesSchema } from "../skills/recipes";

const readTools = [
  zodResponsesFunction({ name: "getProfile", description: getProfileDescription, parameters: getProfileSchema }),
  zodResponsesFunction({ name: "getRecentLog", description: getRecentLogDescription, parameters: getRecentLogSchema }),
  zodResponsesFunction({ name: "suggestWorkoutTemplate", description: suggestWorkoutTemplateDescription, parameters: suggestWorkoutTemplateSchema }),
  zodResponsesFunction({ name: "listFavoriteRecipes", description: listFavoriteRecipesDescription, parameters: listFavoriteRecipesSchema }),
];

export type ToolDiagnostics = {
  toolCalls: string[];
  toolEvents: { name: string; status: "ok" | "error"; durationMs: number }[];
};

async function executeReadTool(name: string, rawArguments: string) {
  const args: unknown = JSON.parse(rawArguments);
  switch (name) {
    case "getProfile":
      getProfileSchema.parse(args);
      return getProfile();
    case "getRecentLog":
      return getRecentLog(getRecentLogSchema.parse(args).days);
    case "suggestWorkoutTemplate":
      return suggestWorkoutTemplate(suggestWorkoutTemplateSchema.parse(args).goal);
    case "listFavoriteRecipes":
      listFavoriteRecipesSchema.parse(args);
      return listFavoriteRecipes();
    default:
      throw new Error(`Health Coach запросил неизвестный tool: ${name}`);
  }
}

export async function runHealthCoach(
  client: OpenAI,
  model: string,
  input: string,
  prompt: string,
  diagnostics: ToolDiagnostics,
  history: ResponseInputItem[],
) {
  history.push({ role: "user", content: input });
  for (let step = 0; step < 8; step++) {
    const response = await client.responses.create({ model, instructions: prompt, input: history, tools: readTools, store: false });
    const calls = response.output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      if (!response.output_text) throw new Error("Health Coach не вернул текстовый план");
      history.push(...response.output);
      return response.output_text;
    }
    history.push(...response.output);
    for (const call of calls) {
      diagnostics.toolCalls.push(call.name);
      const startedAt = Date.now();
      try {
        const output = await executeReadTool(call.name, call.arguments);
        diagnostics.toolEvents.push({ name: call.name, status: "ok", durationMs: Date.now() - startedAt });
        history.push({ type: "function_call_output", call_id: call.call_id, output });
      } catch (error) {
        diagnostics.toolEvents.push({ name: call.name, status: "error", durationMs: Date.now() - startedAt });
        throw new Error(`Ошибка tool ${call.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  throw new Error("Health Coach превысил лимит вызовов tools без готового плана");
}

export async function saveApprovedPlan(
  plan: string,
  shoppingRequested: boolean,
  diagnostics: ToolDiagnostics,
) {
  diagnostics.toolCalls.push("savePlan");
  const saveStartedAt = Date.now();
  try {
    await savePlan(plan);
    diagnostics.toolEvents.push({ name: "savePlan", status: "ok", durationMs: Date.now() - saveStartedAt });
  } catch (error) {
    diagnostics.toolEvents.push({ name: "savePlan", status: "error", durationMs: Date.now() - saveStartedAt });
    throw new Error(`Ошибка tool savePlan: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (shoppingRequested) {
    diagnostics.toolCalls.push("generateShoppingList");
    const shoppingStartedAt = Date.now();
    try {
      await generateShoppingList(plan);
      diagnostics.toolEvents.push({ name: "generateShoppingList", status: "ok", durationMs: Date.now() - shoppingStartedAt });
    } catch (error) {
      diagnostics.toolEvents.push({ name: "generateShoppingList", status: "error", durationMs: Date.now() - shoppingStartedAt });
      throw new Error(`План сохранён, но список покупок не создан. Ошибка tool generateShoppingList: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
