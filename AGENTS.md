# CODEX.md

## Назначение

Health Coach Agent - локальное Next.js-приложение с чатом для создания wellness-планов.
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

- `app/page.tsx`: чат в памяти страницы на Vercel AI SDK `useChat`, таймлайн этапов и действий tools.
- `app/api/chat/route.ts`: POST-эндпоинт со стримом событий и одобренного плана.
- `app/api/agent/run/route.ts`: POST-эндпоинт, принимающий `{ task }` и возвращающий диагностику tools при ошибке.
- `src/harness/runHealthAgent.ts`: оркестрация agent loop, по умолчанию до трёх раундов; опциональный `onEvent` сообщает о ходе работы.
- `src/harness/agentEvents.ts` и `src/harness/chatMessage.ts`: типы событий и частей сообщения чата.
- `src/harness/validateReview.ts`: Zod-проверка JSON reviewer-а и один повторный запрос.
- `src/harness/rounds.ts`: состояние и история раундов.
- `src/harness/score.ts`: итоговая оценка и изменение оценки между раундами.
- `src/harness/promptVersions.ts`: активные версии и загрузка промптов из `prompts/`.
- `src/harness/traceRun.ts`: запись локального JSON-трейса результата или ошибки запуска в `runs/`.
- `src/agents/healthCoach.ts` и `src/agents/safetyReviewer.ts`: вызовы агентов.
- `src/agents/healthCoachMcp.ts`: Health Coach на OpenAI Agents SDK, MCP tools, история вызовов и диагностика.
- `knowledge/`: общая база знаний, разбитая на разделы `##`; `scripts/ingest.ts` загружает embeddings в Supabase pgvector.
- `src/rag/retriever.ts`: поиск ближайших разделов через embedding и SQL-функцию `search_knowledge`.
- `docs/001_*.sql` - `docs/004_*.sql`: схема, атомарная загрузка и проверка embedding-модели; копии миграций находятся в `supabase/migrations/`.
- `src/mcp/markdownHealthServer.ts`: локальный stdio-сервер с tools и resources для Markdown-данных.
- `src/mcp/servers.config.ts`: команды, окружение и флаги для локального, filesystem, weather и Notion MCP-серверов.
- `src/skills/`: локальные tools для шаблона тренировки и списка покупок. Старые модули данных имеют суффикс `-UNUSED.ts` и не подключены к агенту.
- `data/profile.md` и `data/log.md`: данные, доступные коучу через tools.
- `data/output.md`: сохранённый одобренный план.
- `scripts/replay.ts`: повторный запуск задачи из трейса и сравнение результатов.
- `scripts/eval.ts` и `evals/cases/`: последовательная проверка типовых задач и medical safety gate.

## Агентный flow

1. Harness запускает включённые stdio MCP-серверы из конфига на время запроса. Health Coach получает их tools через OpenAI Agents SDK и запрашивает нужные данные. Перед новым планом коуч вызывает локальный `searchKnowledge`, который ищет в Supabase pgvector; harness отклоняет план без успешного поиска. Notion включается при наличии `NOTION_TOKEN`.
2. Health Coach создаёт план.
3. Safety Reviewer получает только текст плана и не имеет tools.
4. При `revise` coach получает замечания и переписывает план. Всего не более трёх раундов.
5. При `approve` и оценке не ниже 7/10 harness вызывает MCP tool `save_health_plan` с одобренным текстом, затем при запросе списка покупок локальный `generateShoppingList`. Вызовы попадают в `toolCalls` и UI.
6. При низкой оценке, отсутствии одобрения после всех раундов или `needs_human_professional` план не возвращается в UI.
7. Запрос списка покупок к существующему плану читает resource `plans://latest`; запрос нового плана со списком покупок сначала создаёт и проверяет новый план.
8. Чат получает события этапов и tools по мере работы. Текст плана передаётся частями только после safety approval. История сообщений живёт только в состоянии страницы; harness обрабатывает последнюю задачу отдельно.

Не меняйте промпты, medical regex, `store: false` или правила revision loop без явного запроса.
OpenRouter stateless: история вызовов tools и результатов передаётся между раундами до завершения запроса, `previous_response_id` не используется. Профиль и дневник целиком не добавляются в начальный промпт.

## UI

- Используйте существующие shadcn-совместимые компоненты из `components/ui`.
- Стили и семантические CSS-токены находятся в `app/globals.css`.
- Для className применяйте `cn` из `lib/utils.ts`.
- Иконки берите только из `lucide-react`, без emoji в интерфейсе.
- Сохраняйте доступные label, видимый focus ring, `aria-live` для статусов и адаптивную вёрстку.

## Правила изменений

- Не добавляйте персист истории сообщений, авторизацию или базу данных.
- При написании кода агентом не пиши тесты и не используй TDD.
- При изменениях архитектуры обновляй этот файл и README.md.
- Обновляй README.md, когда меняются запуск, пользовательские возможности, API, инструменты или рабочий процесс приложения. Описывай текущее поведение кратко, не копируй туда внутренние инструкции для разработчиков.
- Не передавайте API-ключи в клиентский код.
- Не логируйте содержимое `.env`, `data/profile.md` и `data/log.md`.
- Перед передачей изменений запустите `npm run build`.
