# Health Coach Agent

Простое Next.js-приложение для запуска wellness-агента и проверки плана safety reviewer-ом.

## Запуск

1. Укажите в `.env`:

   ```env
   OPENROUTER_API_KEY=ваш_ключ
   OPENROUTER_MODEL=модель_openrouter
   ```

2. Установите зависимости и запустите приложение:

   ```powershell
   npm install
   npm run dev
   ```

3. Откройте `http://localhost:3000`.

## Структура

- `app/page.tsx`: интерфейс запуска.
- `app/api/agent/run/route.ts`: POST-эндпоинт.
- `src/agents`: промпты и вызовы coach/reviewer.
- `src/harness/runHealthAgent.ts`: revision loop до трёх раундов.
- `data`: профиль, дневник и сгенерированный план.

Старый `index.ts` удалён. Его логика перенесена в harness и модули агентов, а единственной точкой входа стал Next.js UI.
