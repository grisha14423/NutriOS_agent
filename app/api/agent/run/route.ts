import { NextResponse } from "next/server";
import { runHealthAgent } from "../../../../src/harness/runHealthAgent";
import type { ToolDiagnostics } from "../../../../src/agents/healthCoachTools";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  const task =
    typeof body === "object" && body !== null && "task" in body
      ? (body as { task?: unknown }).task
      : undefined;
  if (typeof task !== "string" || !task.trim()) {
    return NextResponse.json(
      { error: "Поле task должно быть непустой строкой" },
      { status: 400 },
    );
  }

  const diagnostics: ToolDiagnostics = { toolCalls: [], toolEvents: [] };
  try {
    return NextResponse.json(await runHealthAgent(task.trim(), 3, diagnostics));
  } catch (error) {
    console.error("Ошибка запуска агента", { toolEvents: diagnostics.toolEvents });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ошибка запуска агента",
        ...diagnostics,
      },
      { status: 500 },
    );
  }
}
