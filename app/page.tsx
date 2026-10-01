"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
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

type AgentResult = {
  plan: string;
  review: Review;
  blockedReason: string | null;
  rounds: { round: number; plan: string; review: Review }[];
  finalScore: number | null;
  improved: boolean;
  promptVersions: { coach: string; reviewer: string };
  durationMs: number;
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

export default function Home() {
  const [task, setTask] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "result">("idle");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task.trim()) return;

    setStatus("running");
    setResult(null);
    setError("");

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось запустить агента");
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
                <Textarea
                  id="task"
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  placeholder="Например: составь план питания и активности на день"
                  aria-describedby="task-hint"
                  disabled={status === "running"}
                />
                <p id="task-hint" className="text-sm text-muted-foreground">
                  Не указывайте симптомы, диагнозы, лечение или лекарства.
                </p>
              </div>
              <Button type="submit" disabled={status === "running" || !task.trim()} className="w-full sm:w-auto">
                {status === "running" ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    Агент работает…
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden="true" className="size-4" />
                    Запустить агента
                  </>
                )}
              </Button>
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
              </div>
            </Alert>
          )}

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
                  <details>
                    <summary className="w-fit cursor-pointer rounded-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      История раундов
                    </summary>
                    <ol className="mt-3 space-y-2 pl-5 text-foreground">
                      {result.rounds.map(({ round, review }) => (
                        <li key={round}>
                          Раунд {round} - {verdictLabels[review.verdict]} - {review.score}/10
                        </li>
                      ))}
                    </ol>
                  </details>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Замечания</h3>
                </CardHeader>
                <CardContent>
                  {result.review.issues.length ? (
                    <ul className="space-y-3 text-sm leading-6 text-foreground">
                      {result.review.issues.map((issue) => (
                        <li key={issue} className="flex gap-3">
                          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {result.blockedReason ? "Reviewer не указал конкретных замечаний." : "Замечаний нет."}
                    </p>
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
