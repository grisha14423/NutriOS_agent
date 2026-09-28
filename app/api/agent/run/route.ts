import { NextResponse } from "next/server";
import { runHealthAgent } from "../../../../src/harness/runHealthAgent";

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

  try {
    return NextResponse.json(await runHealthAgent(task.trim()));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка запуска агента" },
      { status: 500 },
    );
  }
}
