# CODEX.md

## Назначение

Health Coach Agent - локальное Next.js-приложение для создания wellness-планов.
Запрос пользователя проходит через агента-коуча и safety reviewer. Приложение не
ставит диагнозы, не назначает лечение и не рекомендует лекарства.

## Запуск

```powershell
npm install
npm run dev
```

Для production-проверки используйте:

```powershell
npm run build
npm run start
```

В `.env` должны быть указаны `OPENROUTER_API_KEY` и `OPENROUTER_MODEL`.
Не читайте, не выводите и не коммитьте значения этих переменных.

## Архитектура

- `app/page.tsx`: клиентский интерфейс с состояниями idle, running и result.
- `app/api/agent/run/route.ts`: POST-эндпоинт, принимающий `{ task }`.
- `src/harness/runHealthAgent.ts`: оркестрация agent loop, по умолчанию до трёх раундов.
- `src/harness/validateReview.ts`: Zod-проверка JSON reviewer-а и один повторный запрос.
- `src/harness/rounds.ts`: состояние и история раундов.
- `src/harness/score.ts`: итоговая оценка и изменение оценки между раундами.
- `src/harness/promptVersions.ts`: активные версии и загрузка промптов из `prompts/`.
- `src/agents/healthCoach.ts` и `src/agents/safetyReviewer.ts`: вызовы агентов.
- `data/profile.md` и `data/log.md`: входной контекст агента.
- `data/output.md`: сохранённый одобренный план.

## Агентный flow

1. Harness читает профиль и дневник.
2. Health Coach создаёт план через OpenRouter Responses API.
3. Safety Reviewer проверяет план.
4. При `revise` coach получает замечания и переписывает план. Всего не более трёх раундов.
5. При `approve` и оценке не ниже 7/10 план записывается в `data/output.md` и возвращается в UI.
6. При низкой оценке, отсутствии одобрения после всех раундов или `needs_human_professional` план не возвращается в UI.

Не меняйте промпты, medical regex, `store: false` или правила revision loop без явного запроса.
OpenRouter stateless: полный нужный контекст передаётся в каждом вызове, `previous_response_id` не используется.

## UI

- Используйте существующие shadcn-совместимые компоненты из `components/ui`.
- Стили и семантические CSS-токены находятся в `app/globals.css`.
- Для className применяйте `cn` из `lib/utils.ts`.
- Иконки берите только из `lucide-react`, без emoji в интерфейсе.
- Сохраняйте доступные label, видимый focus ring, `aria-live` для статусов и адаптивную вёрстку.

## Правила изменений

- Не добавляйте стриминг, чат, историю сообщений, авторизацию или базу данных.
- При написании кода агентом не пиши тесты и не используй TDD.
- При новых изменениях архитектуры вноси также указывай их в этом файле.
- Не передавайте API-ключи в клиентский код.
- Не логируйте содержимое `.env`, `data/profile.md` и `data/log.md`.
- Перед передачей изменений запустите `npm run build`.
