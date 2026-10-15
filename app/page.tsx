"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  Check,
  ChefHat,
  CloudSun,
  Database,
  Dumbbell,
  FilePenLine,
  FileText,
  FolderOpen,
  HeartPulse,
  LoaderCircle,
  NotebookPen,
  NotebookTabs,
  Plug,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  ShoppingBasket,
  SquarePen,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AgentEvent, AgentStage } from "@/src/harness/agentEvents";
import type { ChatRunResult, HealthChatMessage } from "@/src/harness/chatMessage";

const stageLabels: Record<AgentStage, string> = {
  reading_profile: "Reading profile",
  searching_knowledge: "Searching knowledge",
  generating_plan: "Generating plan",
  reviewing_safety: "Reviewing safety",
  revising: "Revising",
  final_approved_plan: "Final approved plan",
};

const verdictLabels = {
  approve: "Одобрено",
  revise: "Нужна доработка",
  needs_human_professional: "Требуется специалист",
};

const transport = new DefaultChatTransport<HealthChatMessage>({ api: "/api/chat" });

const toolIcons: Record<string, LucideIcon> = {
  read_profile: UserRound,
  read_recent_logs: NotebookPen,
  append_daily_log: SquarePen,
  list_recipes: ChefHat,
  searchKnowledge: BookOpen,
  suggestWorkoutTemplate: Dumbbell,
  save_health_plan: Save,
  generateShoppingList: ShoppingBasket,
  get_weather_forecast: CloudSun,
};

function iconForTool(name: string, source: string): LucideIcon {
  if (toolIcons[name]) return toolIcons[name];
  if (source === "weather") return CloudSun;
  if (source === "notion") return NotebookTabs;
  if (/search/i.test(name)) return Search;
  if (/write|edit|update/i.test(name)) return FilePenLine;
  if (/list|directory|folder/i.test(name)) return FolderOpen;
  if (/read|file/i.test(name)) return FileText;
  return source === "knowledge" ? Database : source === "local" ? Wrench : Plug;
}

function timelineFor(message: HealthChatMessage, failed: boolean) {
  const entries = new Map<string, AgentEvent>();
  for (const part of message.parts) {
    if (part.type !== "data-event") continue;
    const event = part.data;
    const key = event.type === "stage"
      ? `stage:${event.stage}:${event.round ?? 0}`
      : `tool:${event.id}`;
    entries.set(key, event);
  }
  return [...entries.entries()].filter(([, event]) => !failed || event.status !== "running");
}

function resultFor(message: HealthChatMessage): ChatRunResult | undefined {
  return message.parts.find((part) => part.type === "data-result")?.data;
}

function sourceKind(source: string) {
  if (source === "knowledge") return "rag";
  if (source === "local") return "local";
  return "mcp";
}

function Timeline({ message, failed }: { message: HealthChatMessage; failed: boolean }) {
  const entries = timelineFor(message, failed);
  if (!entries.length) return null;

  return (
    <ol className="timeline" aria-label="Этапы работы агента">
      {entries.map(([key, event]) => {
        if (event.type === "stage") {
          const running = event.status === "running";
          return (
            <li key={key} className={`timeline-row${running ? " is-running" : ""}`}>
              <span className="timeline-icon" aria-hidden="true">
                {running ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
              </span>
              <div className="timeline-copy">
                <span className="timeline-title">
                  {stageLabels[event.stage]}
                  {event.stage === "revising" && event.round ? ` (round ${event.round})` : ""}
                </span>
                {event.query && <span className="timeline-detail">Запрос: {event.query}</span>}
                {event.verdict && (
                  <span className="timeline-detail">
                    {verdictLabels[event.verdict]}{event.score !== undefined ? `, ${event.score}/10` : ""}
                  </span>
                )}
              </div>
            </li>
          );
        }

        const kind = sourceKind(event.source);
        const Icon = iconForTool(event.name, event.source);
        return (
          <li key={key} className={`timeline-row tool-row${event.status === "running" ? " is-running" : ""}`}>
            <span className="timeline-icon" aria-hidden="true"><Icon size={15} /></span>
            <div className="timeline-copy">
              <span className="timeline-title"><span className="source-tag">[{kind}]</span> {event.name}</span>
              {event.query && <span className="timeline-detail">{event.query}</span>}
            </div>
            <span className={`tool-status ${event.status === "error" ? "tool-error" : ""}`}>
              {event.status === "running" ? "В работе" : event.status === "ok" ? "Готово" : "Ошибка"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function AssistantMessage({ message, transportFailed }: { message: HealthChatMessage; transportFailed: boolean }) {
  const plan = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  const result = resultFor(message);
  const failure = message.parts.find((part) => part.type === "data-failure")?.data;
  const failed = Boolean(failure) || transportFailed;
  const needsProfessional = result?.review.verdict === "needs_human_professional";

  return (
    <article className="assistant-message" aria-label="Ответ Health Coach">
      <div className="assistant-heading"><ShieldCheck size={17} aria-hidden="true" /> Health Coach</div>
      <Timeline message={message} failed={failed} />

      {needsProfessional && result && (
        <section className="notice notice-amber" aria-labelledby={`professional-${message.id}`}>
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h2 id={`professional-${message.id}`}>Требуется специалист</h2>
            <p>По этому запросу план не выдаётся.</p>
            {result.review.issues.length > 0 && (
              <ul>{result.review.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
            )}
          </div>
        </section>
      )}

      {result?.blockedReason && !needsProfessional && (
        <section className="notice notice-amber">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h2>План не выдан</h2>
            <p>{result.blockedReason}</p>
            {result.review.issues.length > 0 && (
              <ul>{result.review.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
            )}
          </div>
        </section>
      )}

      {plan && <div className="plan-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{plan}</ReactMarkdown></div>}

      {failure && (
        <div className="notice notice-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><h2>Не удалось выполнить задачу</h2><p>{failure.message}</p></div>
        </div>
      )}

      {result && (
        <div className="review-footer">
          <span>Safety review: <strong>{verdictLabels[result.review.verdict]}</strong></span>
          <span>Оценка: <strong>{result.review.score}/10</strong></span>
          <span>{result.roundCount} {result.roundCount === 1 ? "раунд" : "раундов"}</span>
        </div>
      )}
    </article>
  );
}

export default function Home() {
  const [draft, setDraft] = useState("");
  const { messages, sendMessage, status, error, setMessages, clearError } = useChat<HealthChatMessage>({ transport });
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";
  const latestMessage = messages.at(-1);
  const hasFailure = latestMessage?.parts.some((part) => part.type === "data-failure");

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [draft]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    void sendMessage({ text });
  }

  function resetSession() {
    setMessages([]);
    setDraft("");
    clearError();
  }

  return (
    <main id="main-content" className="chat-shell">
      <header className="chat-header">
        <div className="brand-mark"><HeartPulse size={22} aria-hidden="true" /></div>
        <div>
          <p className="brand-kicker">Персональный wellness-помощник</p>
          <h1>Health Coach Agent</h1>
        </div>
        <button className="new-session-button" type="button" onClick={resetSession} disabled={busy} title={busy ? "Дождитесь завершения задачи" : undefined}>
          <RotateCcw size={16} aria-hidden="true" /> Новая сессия
        </button>
      </header>

      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-mark"><HeartPulse size={28} aria-hidden="true" /></div>
            <h2>С чего начнём?</h2>
            <p>Опишите цель на день или привычку. Коуч подготовит план и проверит его безопасность перед ответом.</p>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((message) => message.role === "user" ? (
              <div key={message.id} className="user-message">
                {message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")}
              </div>
            ) : message.role === "assistant" ? (
              <AssistantMessage key={message.id} message={message} transportFailed={Boolean(error) && latestMessage?.id === message.id} />
            ) : null)}
            {status === "submitted" && <p className="waiting-line"><LoaderCircle className="spin" size={16} aria-hidden="true" /> Запускаем агента...</p>}
            {error && <p className="request-error" role="alert">Ошибка соединения: {error.message}</p>}
          </div>
        )}
      </div>

      <div className="composer-wrap">
        <form className="composer" onSubmit={submit}>
          <label htmlFor="chat-input">Ваше сообщение</label>
          <div className="composer-row">
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Например: составь план питания и активности на день"
              disabled={busy}
              aria-describedby="chat-hint"
            />
            <button type="submit" disabled={busy || !draft.trim()} aria-label={busy ? "Агент работает" : "Отправить сообщение"}>
              {busy && !hasFailure ? <LoaderCircle className="spin" size={20} aria-hidden="true" /> : <ArrowUp size={20} aria-hidden="true" />}
            </button>
          </div>
          <p id="chat-hint">Enter отправляет, Shift+Enter переносит строку. Чат хранится только на этой странице.</p>
        </form>
      </div>
    </main>
  );
}
