"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  HeartPulse,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AgentResult = {
  plan: string;
  review: Review;
  blockedReason: string | null;
  rounds: { round: number; plan: string; review: Review }[];
  toolCalls: string[];
  toolEvents: ToolDiagnostics["toolEvents"];
  finalScore: number | null;
  improved: boolean;
  promptVersions: { coach: string; reviewer: string };
  durationMs: number;
};

type ToolDiagnostics = {
  toolCalls: string[];
  toolEvents: { name: string; source: string; status: "ok" | "error"; durationMs: number; query?: string; chunkCount?: number }[];
};

type Review = {
  verdict: "approve" | "revise" | "needs_human_professional";
  score: number;
  issues: string[];
};

const verdictLabels = {
  approve: "Одобрено",
  revise: "Нужна доработка",
  needs_human_professional: "Нужна консультация",
};

function ToolEventsList({ events }: { events: ToolDiagnostics["toolEvents"] }) {
  return (
    <ol className="space-y-2.5">
      {events.map(({ name, source, status, durationMs, query, chunkCount }, index) => (
        <li key={`${index}-${name}`} className="flex flex-wrap items-center gap-3 rounded-lg border bg-secondary/30 p-3 sm:flex-nowrap sm:p-4">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-sm font-semibold text-primary shadow-sm ring-1 ring-border">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all text-sm font-semibold text-foreground">
                {source === "knowledge" ? <>🔍 knowledge: {query} → {chunkCount ?? 0} chunks</> : name}
              </span>
              <Badge className={source !== "local" ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-card text-secondary-foreground"}>
                [{source}]
              </Badge>
            </div>
            <div className={`mt-1 flex items-center gap-1.5 text-sm ${status === "ok" ? "text-primary" : "text-destructive"}`}>
              {status === "ok" ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <AlertCircle aria-hidden="true" className="size-3.5" />}
              <span>{status === "ok" ? "Выполнен" : "Ошибка"}</span>
            </div>
          </div>
          <span className="ml-11 text-xs tabular-nums text-muted-foreground sm:ml-0 sm:text-sm">{durationMs} мс</span>
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  const [task, setTask] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "result">("idle");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState("");
  const [errorDiagnostics, setErrorDiagnostics] = useState<ToolDiagnostics | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task.trim()) return;

    setStatus("running");
    setResult(null);
    setError("");
    setErrorDiagnostics(null);

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorDiagnostics({
          toolCalls: Array.isArray(data.toolCalls) ? data.toolCalls : [],
          toolEvents: Array.isArray(data.toolEvents) ? data.toolEvents : [],
        });
        throw new Error(data.error || "Не удалось запустить агента");
      }
      setResult(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Ошибка запуска агента",
      );
    } finally {
      setStatus("result");
    }
  }

  const needsProfessional = result?.review.verdict === "needs_human_professional";

  return (
    <main id="main-content" className="min-h-dvh bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-start gap-4 sm:mb-10">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HeartPulse aria-hidden="true" className="size-6" />
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-primary">Персональный wellness-помощник</p>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Health Coach Agent
            </h1>
            <p className="mt-2 max-w-xl text-base leading-7 text-muted-foreground">
              Составляет реалистичный план и проверяет его безопасность перед выдачей.
            </p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles aria-hidden="true" className="size-4" />
              Новая задача
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Что вы хотите улучшить?</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Опишите цель на день или привычку. Агент работает только с wellness-рекомендациями.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="task" className="text-sm font-medium text-foreground">
                  Ваша задача
                </label>
                <div className="flex items-end gap-2">
                  <Textarea
                    id="task"
                    rows={1}
                    value={task}
                    onChange={(event) => {
                      const field = event.currentTarget;
                      field.style.height = "auto";
                      field.style.height = `${field.scrollHeight}px`;
                      setTask(field.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Например: составь план питания и активности на день"
                    aria-describedby="task-hint"
                    disabled={status === "running"}
                    className={cn("min-h-11 max-h-48 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl px-4 py-2.5")}
                  />
                  <Button type="submit" aria-label={status === "running" ? "Агент работает" : "Отправить запрос"} disabled={status === "running" || !task.trim()} className="size-11 shrink-0 rounded-full p-0">
                    {status === "running" ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <ArrowUp aria-hidden="true" className="size-5" />}
                  </Button>
                </div>
                <p id="task-hint" className="text-sm text-muted-foreground">
                  Enter отправляет запрос, Shift+Enter переносит строку. Не указывайте симптомы, диагнозы, лечение или лекарства.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6" aria-live="polite">
          {status === "running" && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground">
                <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
                Агент готовит план и выполняет safety review. Это может занять некоторое время.
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert className="flex gap-3 border-destructive/30 bg-destructive/5 text-foreground">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-semibold">Не удалось выполнить задачу</p>
                <p className="mt-1 text-sm leading-6">{error}</p>
                {errorDiagnostics && errorDiagnostics.toolEvents.length > 0 && (
                  <div className="mt-4"><ToolEventsList events={errorDiagnostics.toolEvents} /></div>
                )}
              </div>
            </Alert>
          )}

          <div className="space-y-3">
            {needsProfessional && result && (
              <Alert className="flex gap-3 border-amber-700/30 bg-amber-50 text-amber-950">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold">Для этого запроса требуется вмешательство человека</p>
                  <p className="mt-1 text-sm leading-6">
                    Агент не показывает план для запросов, связанных с медицинской помощью.
                  </p>
                </div>
              </Alert>
            )}

            {result?.blockedReason && (
              <Alert className="flex gap-3 border-amber-700/30 bg-amber-50 text-amber-950">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold">План не выдан</p>
                  <p className="mt-1 text-sm leading-6">{result.blockedReason}</p>
                </div>
              </Alert>
            )}
          </div>

          {result && (
            <section className="mt-8 space-y-6" aria-labelledby="result-title">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-primary">Результат</p>
                  <h2 id="result-title" className="text-2xl font-bold tracking-tight">Safety review</h2>
                </div>
                <Badge
                  className={
                    needsProfessional || result.blockedReason
                      ? "border-amber-700/30 bg-amber-50 text-amber-900"
                      : result.review.verdict === "approve"
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-border bg-secondary text-secondary-foreground"
                  }
                >
                  {result.plan ? (
                    <CheckCircle2 aria-hidden="true" className="mr-1.5 size-3.5" />
                  ) : (
                    <ShieldCheck aria-hidden="true" className="mr-1.5 size-3.5" />
                  )}
                  {result.blockedReason ? "План не выдан" : verdictLabels[result.review.verdict]}
                </Badge>
              </div>

              {result.plan && (
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-semibold">Финальный план</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap break-words text-base leading-7 text-foreground">
                      {result.plan}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Что сделал агент</h3>
                  <p className="text-sm text-muted-foreground">Источники данных и локальные действия по порядку выполнения.</p>
                </CardHeader>
                <CardContent>
                  {result.toolEvents.length ? (
                    <ToolEventsList events={result.toolEvents} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Tools не вызывались.</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">Оценка безопасности</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                      {result.review.score}<span className="text-lg font-medium text-muted-foreground">/10</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">Раундов проверки</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{result.rounds.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
                  <p>Время выполнения: {result.durationMs} мс</p>
                  <p>Версии промптов: coach {result.promptVersions.coach}, reviewer {result.promptVersions.reviewer}</p>
                  <details className="group border-t pt-3">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                      <span>История раундов <span className="ml-1 text-muted-foreground">({result.rounds.length})</span></span>
                      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <ol className="mt-3 space-y-2.5 text-foreground">
                      {result.rounds.map(({ round, review }) => (
                        <li key={round} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 sm:p-4">
                          <div className="flex items-center gap-3">
                            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">{round}</span>
                            <span className="font-medium">Раунд {round}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={review.verdict === "approve" ? "border-primary/20 bg-primary/10 text-primary" : "border-amber-700/30 bg-amber-50 text-amber-900"}>
                              {verdictLabels[review.verdict]}
                            </Badge>
                            <span className="min-w-10 text-right font-semibold tabular-nums text-foreground">{review.score}/10</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </details>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Замечания</h3>
                  <p className="text-sm text-muted-foreground">Вывод Safety Reviewer по финальному раунду.</p>
                </CardHeader>
                <CardContent>
                  {result.review.issues.length ? (
                    <ul className="space-y-2.5 text-sm leading-6 text-foreground">
                      {result.review.issues.map((issue, index) => (
                        <li key={`${index}-${issue}`} className="flex gap-3 rounded-lg border border-amber-700/20 bg-amber-50/60 p-3 sm:p-4">
                          <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900">{index + 1}</span>
                          <span className="min-w-0 break-words">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={`flex items-center gap-2.5 rounded-lg border p-4 text-sm leading-6 ${result.blockedReason ? "bg-secondary/40 text-muted-foreground" : "border-primary/20 bg-primary/5 text-primary"}`}>
                      {!result.blockedReason && <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />}
                      <span>{result.blockedReason ? "Reviewer не указал конкретных замечаний." : "Замечаний нет."}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
