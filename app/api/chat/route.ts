import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { runHealthAgent } from "../../../src/harness/runHealthAgent";
import type { HealthChatMessage } from "../../../src/harness/chatMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  const messages = typeof body === "object" && body !== null && "messages" in body
    ? (body as { messages?: unknown }).messages
    : undefined;
  const lastMessage = Array.isArray(messages) ? messages.at(-1) : undefined;
  const task = lastMessage?.role === "user" && Array.isArray(lastMessage.parts)
    ? lastMessage.parts.filter((part: { type?: string; text?: unknown }) => part.type === "text" && typeof part.text === "string").map((part: { text: string }) => part.text).join("\n").trim()
    : "";
  if (!task) return Response.json({ error: "Отправьте непустое сообщение" }, { status: 400 });

  const stream = createUIMessageStream<HealthChatMessage>({
    execute: async ({ writer }) => {
      try {
        const result = await runHealthAgent(task, 3, undefined, (event) => {
          writer.write({ type: "data-event", data: event });
        });
        writer.write({
          type: "data-result",
          data: {
            review: result.review,
            blockedReason: result.blockedReason,
            finalScore: result.finalScore,
            promptVersions: result.promptVersions,
            durationMs: result.durationMs,
            roundCount: result.rounds.length,
          },
        });
        if (result.plan) {
          const id = crypto.randomUUID();
          writer.write({ type: "text-start", id });
          for (const token of result.plan.match(/\S+\s*|\s+/gu) ?? []) {
            writer.write({ type: "text-delta", id, delta: token });
            await new Promise((resolve) => setTimeout(resolve, 8));
          }
          writer.write({ type: "text-end", id });
        }
      } catch (error) {
        writer.write({
          type: "data-failure",
          data: { message: error instanceof Error ? error.message : "Ошибка запуска агента" },
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
