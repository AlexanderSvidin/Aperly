# Aperly — Обзор проекта для нового разработчика

## Что это такое

**Aperly** — это Telegram Mini App MVP для студентов HSE Perm (ВШЭ Пермь). Задача продукта — помочь студенту быстро найти конкретного человека под конкретную цель. Не социальная сеть, не лента, а структурированный матчинг.

Три сценария (все равнозначны, ни один не является заглушкой):

| Сценарий | Что ищут |
|----------|----------|
| **CASE** | Участники в команду на кейс-чемпионат или хакатон |
| **PROJECT** | Со-основатели / разработчики / дизайнеры в пет-проект или стартап |
| **STUDY** | StudyBuddy — партнёр для совместной учёбы по предмету |

Ключевая идея: студент создаёт **запрос** (Request) с параметрами своей задачи, система подбирает подходящие **матчи** (другие запросы или профили), участники общаются в **чате** внутри приложения, и только после взаимного согласия обмениваются контактами. Telegram-контакты не раскрываются раньше времени.

---

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 6 |
| Backend | Next.js Route Handlers (Node.js), TypeScript |
| База данных | PostgreSQL + Prisma ORM |
| Валидация | Zod 4 |
| Стили | Ручной мобильный CSS (без UI-библиотек), адаптирован под Telegram Mini Apps |
| Тесты | Node.js built-in test runner (tsx) |
| Деплой | Vercel (`vercel.json` в корне) |
| Пакетный менеджер | npm |

---

## Структура проекта

```
MVP1/
├── prisma/
│   ├── schema.prisma          # Единый источник правды по моделям БД
│   ├── migrations/            # Prisma-миграции
│   └── seed.cjs               # Сидирование базы
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (app)/             # Защищённые страницы (требуют аутентификации)
│   │   │   ├── home/          # Главная — лента активных запросов
│   │   │   ├── matches/       # Матчи / отклики
│   │   │   ├── chats/         # Чаты
│   │   │   ├── profile/       # Профиль
│   │   │   ├── requests/new/  # Создание запроса
│   │   │   └── admin/         # Административная панель
│   │   ├── api/               # Route Handlers (REST API)
│   │   ├── onboarding/        # Онбординг (первое открытие)
│   │   ├── layout.tsx         # Root layout — подключает TelegramAppProvider и SDK
│   │   └── globals.css        # Все стили
│   ├── features/              # Фичи (UI-слой)
│   │   ├── auth/              # Компоненты аутентификации
│   │   ├── chat/              # Экран чатов, типы
│   │   ├── home/              # Главный экран, типы
│   │   ├── matching/          # Экран матчей, типы
│   │   ├── profile/           # Форма профиля, удаление аккаунта
│   │   ├── requests/          # Форма создания/редактирования запроса
│   │   ├── study/             # Каталог предметов, пикер предметов
│   │   ├── study-sessions/    # StudyBuddy сессии (типы, форма расписания)
│   │   └── telegram/          # TelegramAppProvider, dev-fallback
│   ├── server/
│   │   ├── db/                # Prisma client (singleton)
│   │   └── services/          # Серверная бизнес-логика
│   │       ├── auth/          # Гварды requirePageUser / requireApiUserFromRequest
│   │       ├── chat/          # Чат-сервис
│   │       ├── home/          # Сервис главного экрана
│   │       ├── matching/      # Алгоритм матчинга
│   │       ├── profile/       # Профиль-сервис
│   │       ├── requests/      # CRUD запросов
│   │       ├── study-sessions/# StudyBuddy сессии
│   │       ├── analytics/     # Абстракция аналитики
│   │       └── notifications/ # Уведомления через Telegram
│   ├── lib/                   # Shared утилиты
│   │   ├── env/               # Типизированные переменные окружения
│   │   ├── telegram/          # Парсинг initData, хелперы
│   │   └── ui/                # ActionState (loading/success/error)
│   ├── components/            # Переиспользуемые UI-компоненты
│   │   ├── layout/            # MobileAppShell, ShellNav (нижняя навигация)
│   │   └── ui/                # Button, Card и др.
│   ├── types/                 # Глобальные TypeScript-типы
│   └── proxy.ts               # Next.js middleware: Cache-Control: no-store на /api/*
├── tests/
│   └── home-admin.test.ts     # Интеграционные тесты
├── docs/                      # Документация
├── AGENTS.md                  # Ограничения и правила для агентов / AI-ассистентов
└── package.json
```

---

## Паттерн страница → сервис

Все защищённые страницы работают по одному паттерну:

```
Page (Server Component)
  → requirePageUser()          # проверяет сессию, бросает redirect если нет
  → someService.getXxx()       # загружает сериализованные данные
  → <ScreenShell initialData={...} key={user.id} />
```

`key={user.id}` на каждом Shell-компоненте критически важен — он сбрасывает React-дерево при смене аккаунта в Telegram.

Клиентские Shell-компоненты (`"use client"`) принимают `initialData` и управляют интерактивностью: фильтры, локальный стейт, вызовы API через `fetch`.

---

## Аутентификация и Telegram

1. `telegram-web-app.js` загружается синхронным `<script>` в root layout (до гидрации React — намеренно, без `async/defer`).
2. `TelegramAppProvider` на клиенте опрашивает `window.Telegram.WebApp` каждые 50 мс, таймаут 1500 мс.
3. При инициализации приложение проверяет `/api/me` — сопоставляет `telegramId` из Telegram SDK с текущей сессией. Если не совпадают (смена аккаунта) → вызов `/api/auth/logout` → `window.location.replace("/")`.
4. В dev-режиме работает `createDevTelegramSession` (переменная `ALLOW_DEV_TELEGRAM_FALLBACK`).
5. Все API ответы: `Cache-Control: no-store, no-cache` (middleware `src/proxy.ts`).

---

## Домен: основные сущности и их жизненные циклы

### Request (Запрос)

Главный объект. Пользователь создаёт запрос в одном из трёх сценариев.

```
ACTIVE → EXPIRED (по expiresAt)
       → CLOSED  (вручную)
       → DELETED (скрыт)
```

Ограничения:
- 1 активный запрос на пользователя на сценарий
- Детали хранятся в отдельных таблицах: `CaseRequestDetails`, `ProjectRequestDetails`, `StudyRequestDetails`

### Match (Матч)

Создаётся движком матчинга. Имеет уникальный `pairKey`.

```
READY → PENDING_RECIPIENT_ACCEPTANCE (отправлен интро-запрос)
      → DECLINED
      → EXPIRED
      → CLOSED (после открытия чата)
```

**Два режима матчинга:**
- `REQUEST_TO_REQUEST` — основной: сопоставляет два запроса с одинаковым сценарием
- `REQUEST_TO_PROFILE` — fallback: используется только если пул запросов < 5, не более 3 таких матчей на запрос, только для discoverable профилей

**Алгоритм скоринга** (детерминированный, без AI):
- Совпадение навыков и ролей
- Совпадение временных слотов
- Совпадение формата (онлайн/офлайн/гибрид)
- Минимальный балл для попадания в результат: 45
- Максимум 10 матчей на запрос

### Chat (Чат)

Создаётся при принятии матча. Polling-based (MVP).

```
ACTIVE → STALE (72 часа без ответа, показывается как "ожидает ответа")
       → CLOSED
       → BLOCKED
```

Контакты раскрываются только при `ContactExchangeStatus = MUTUAL_CONSENT`. До этого момента Telegram username и телефон не видны другой стороне.

### Session (StudyBuddy сессия)

Сессия учёбы, привязанная к конкретному чату (матчу в сценарии STUDY).

```
PROPOSED → CONFIRMED → COMPLETED → nextAction: SCHEDULE_NEXT | FIND_NEW_PARTNER | STOP_SEARCHING
         → CANCELLED
         → MISSED
```

---

## API Endpoints (основные)

| Метод | Путь | Действие |
|-------|------|----------|
| GET | `/api/home` | Лента возможностей |
| GET | `/api/matches` | Матчи текущего пользователя |
| POST | `/api/matches/[id]/respond` | Принять/отклонить матч |
| PATCH | `/api/matches/[id]/open-chat` | Открыть чат из матча |
| GET | `/api/chats` | Список чатов |
| POST | `/api/chats/[id]/messages` | Отправить сообщение |
| POST | `/api/chats/[id]/contact-exchange/request` | Запросить обмен контактами |
| GET | `/api/requests` | Запросы текущего пользователя |
| POST | `/api/requests` | Создать запрос |
| PATCH | `/api/requests/[id]` | Обновить запрос |
| POST | `/api/requests/[id]/close` | Закрыть запрос |
| POST | `/api/requests/[id]/pause` | Приостановить запрос |
| GET | `/api/requests/[id]/matches/refresh` | Пересчитать матчи |
| GET/PATCH | `/api/profile` | Профиль текущего пользователя |
| GET | `/api/sessions` | StudyBuddy сессии |
| POST | `/api/sessions` | Запланировать сессию |

---

## Навигация (нижнее меню)

```
⌂ Главная   →  /home
+ Создать   →  /requests/new   (акцентная кнопка)
◎ Отклики   →  /matches
○ Профиль   →  /profile
```

Чаты (`/chats`) доступны по ссылкам из экрана матчей/главной, отдельной таб-кнопки нет.

---

## Как запустить локально

```bash
npm install
# заполнить .env по образцу .env.example
npm run db:migrate      # применить миграции
npm run db:seed         # засеять тестовые данные
npm run dev             # запустить dev-сервер
```

Для тестов:
```bash
npm test                # интеграционные тесты (требует заполненный .env)
```

Для проверки типов и линтера:
```bash
npm run typecheck
npm run lint
```

---

## Что точно нельзя трогать без согласования

Из `AGENTS.md` — жёсткие ограничения проекта:

- Три сценария (CASE, PROJECT, STUDY) — все три обязательны
- Telegram Mini App как единственный канал
- PostgreSQL + Prisma как слой данных
- Гибридная стратегия матчинга (request-to-request + fallback)
- Контакты — только после взаимного согласия
- Polling-based чат (реалтайм можно добавить позже, но не ломать текущий seam)
- StudyBuddy follow-up actions: SCHEDULE_NEXT, FIND_NEW_PARTNER, STOP_SEARCHING

---

## Текущее состояние (май 2026)

Последний крупный коммит (`580b2e4` от 12.05.2026) — стабилизация core flow:

- **Исправлен баг account switching**: при смене Telegram-аккаунта приложение корректно сбрасывает состояние и не показывает данные предыдущего пользователя
- **Новые API**: закрытие и пауза запросов, ручной рефреш матчей, профиль
- **Упрощён HomeScreenShell**: убрана избыточная сложность, добавлена фильтрация по сценарию
- **StudyBuddy session panel** встроен в экран чата
- **DeleteProfilePanel** — возможность удалить аккаунт из профиля
- **ActionState** — единый тип для управления loading/success/error состоянием в UI-компонентах
- Добавлен `docs/regression-account-switching.md` — чеклист для ручного регрессионного тестирования

Продукт функционально готов по основным сценариям. Из известных точек роста: расширение аналитики, система напоминаний, верификация через HSE email.
