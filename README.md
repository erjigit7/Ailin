# Ailin — система автоматизации кинотеатра

Веб-приложение для кинотеатра: продажа билетов (касса), бар, управление фильмами/сеансами,
отчёты и информационный дисплей для гостей с обновлением мест в реальном времени.

Реализуется по ТЗ «Программа автоматизации кинотеатра» (1 зал · 49 мест · бар · отчёты · экран для гостей).

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS + react-i18next |
| Backend | NestJS (Node.js + TypeScript) |
| Real-time | Socket.IO (WebSocket) |
| БД | PostgreSQL + Prisma ORM |
| Отчёты | ExcelJS + pdfmake |
| Печать чеков | ESC/POS термопринтеры (Xprinter/Epson) |

## Структура

```
apps/
  api/          NestJS backend (REST + WebSocket)
  web/          React frontend (касса, админка, дисплей для гостей)
packages/
  shared/       Общие типы и константы (конфигурация зала, enum'ы)
docker-compose.yml   PostgreSQL
```

## Установка на ПК кинотеатра (для клиента)

Двойной клик по **`Запустить-Ailin.bat`** — программа сама ставится, обновляется
из git (если есть интернет), собирается и запускается на `http://localhost:3000`.
Подробно — в [INSTALL.md](./INSTALL.md).

## Быстрый старт (разработка)

```bash
# 1. Скопировать переменные окружения
cp .env.example .env

# 2. Установить зависимости (npm workspaces)
npm install

# 3. Собрать общий пакет (типы/раскладка зала) и сгенерировать Prisma Client
npm run build --workspace @ailin/shared
npm run prisma:generate

# 4. Поднять PostgreSQL в Docker
npm run db:up

# 5. Применить миграции, частичные индексы (защита от двойной продажи) и сиды
npm run prisma:migrate
npm run db:indexes
npm run db:seed

# 6. Запустить API и фронтенд (в двух терминалах)
npm run dev:api
npm run dev:web
```

- Касса: http://localhost:5173
- Дисплей для гостей: http://localhost:5173/display
- API: http://localhost:3000

## Документация

- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура, модули, модель данных, real-time.
