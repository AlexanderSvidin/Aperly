"use client";

import { FormEvent, useState, useTransition } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SerializedHomeDashboardData } from "@/features/home/lib/home-types";
import {
  chatReadinessLabels,
  scenarioLabelByValue
} from "@/features/matching/lib/match-options";
import { formatOptions } from "@/features/profile/lib/profile-options";
import {
  formatRequestDate,
  requestStatusLabels,
  requestStatusTone
} from "@/features/requests/lib/request-options";
import type { SerializedStudyContinuation } from "@/features/study-sessions/lib/study-session-types";

const partnerGoalOptions = [
  {
    value: "case-championship",
    label: "Кейс-чемпионат",
    description: "Сразу откроем сценарий команды под кейс с ролями и дедлайном.",
    href: "/requests/new?scenario=CASE",
    actionLabel: "Перейти к кейсу",
    tone: "blue"
  },
  {
    value: "hackathon",
    label: "Хакатон",
    description: "Хакатон идёт через командный сценарий: роли, сроки и формат.",
    href: "/requests/new?scenario=CASE",
    actionLabel: "Перейти к хакатону",
    tone: "sky"
  },
  {
    value: "study",
    label: "Совместная учеба",
    description: "Откроем StudyBuddy с предметом, ритмом встреч и удобным временем.",
    href: "/requests/new?scenario=STUDY",
    actionLabel: "Перейти к учебе",
    tone: "mint"
  },
  {
    value: "startup",
    label: "Стартап",
    description: "Откроем проектный сценарий под идею, стадию и нужные роли.",
    href: "/requests/new?scenario=PROJECT",
    actionLabel: "Перейти к стартапу",
    tone: "amber"
  },
  {
    value: "pet-project",
    label: "Пэт-проект",
    description: "Откроем проектный сценарий для сборки команды под свой продукт.",
    href: "/requests/new?scenario=PROJECT",
    actionLabel: "Перейти к проекту",
    tone: "sage"
  }
] as const;

type PartnerGoalValue = (typeof partnerGoalOptions)[number]["value"];

type HomeScreenShellProps = {
  initialData: SerializedHomeDashboardData;
  showWelcomeSelector?: boolean;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
};

const formatLabelByValue = Object.fromEntries(
  formatOptions.map((option) => [option.value, option.label])
) as Record<(typeof formatOptions)[number]["value"], string>;

const chatStatusLabelByValue = {
  ACTIVE: "Активен",
  STALE: "Ожидает ответа",
  CLOSED: "Закрыт",
  BLOCKED: "Ограничен"
} as const;

const studyStatusLabelByValue = {
  PROPOSED: "Предложена",
  CONFIRMED: "Подтверждена",
  COMPLETED: "Проведена",
  CANCELLED: "Отменена",
  MISSED: "Пропущена"
} as const;

const studyStatusToneByValue = {
  PROPOSED: "warning",
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
  MISSED: "warning"
} as const;

const studyRecommendedActionCopy = {
  NONE: {
    title: "Связка уже живая",
    description:
      "Можно сразу договориться о следующем шаге: запланировать новую встречу, освежить поиск или остановить его."
  },
  SCHEDULE_NEXT: {
    title: "Лучший следующий шаг — запланировать новую встречу",
    description:
      "Сессия уже дала сигнал к продолжению. Зафиксируйте следующее окно, пока у пары есть инерция."
  },
  FIND_NEW_PARTNER: {
    title: "Лучший следующий шаг — найти нового напарника",
    description:
      "Текущая связка не сработала идеально. Можно быстро перезапустить поиск, не теряя историю чата и сессий."
  },
  STOP_SEARCHING: {
    title: "Поиск можно аккуратно завершить",
    description:
      "Если задача уже закрыта, остановите поиск и оставьте историю пары доступной для чтения."
  }
} as const;

function buildChatsHref(chatId?: string | null): Route {
  const searchParams = new URLSearchParams();

  if (chatId) {
    searchParams.set("chatId", chatId);
  }

  const queryString = searchParams.toString();

  return (queryString ? `/chats?${queryString}` : "/chats") as Route;
}

function buildMatchesHref(requestId?: string | null, matchId?: string | null): Route {
  const searchParams = new URLSearchParams();

  if (requestId) {
    searchParams.set("requestId", requestId);
  }

  if (matchId) {
    searchParams.set("matchId", matchId);
  }

  const queryString = searchParams.toString();

  return (queryString ? `/matches?${queryString}` : "/matches") as Route;
}

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function toLocalDateTimeInputValue(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function buildDefaultNextSessionValue(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + 7);

  return toLocalDateTimeInputValue(date.toISOString());
}

function buildInitialScheduleState(continuation: SerializedStudyContinuation | null) {
  return {
    scheduledAt: continuation
      ? buildDefaultNextSessionValue(continuation.scheduledFor)
      : "",
    format: continuation?.format ?? "ONLINE",
    notes: continuation?.notes ?? ""
  };
}

export function HomeScreenShell({
  initialData,
  showWelcomeSelector = false
}: HomeScreenShellProps) {
  const router = useRouter();
  const [selectedGoalValue, setSelectedGoalValue] = useState<PartnerGoalValue>(
    partnerGoalOptions[0].value
  );
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleNextState, setScheduleNextState] = useState(() =>
    buildInitialScheduleState(initialData.studyContinuation)
  );

  const selectedGoal =
    partnerGoalOptions.find((goal) => goal.value === selectedGoalValue) ??
    partnerGoalOptions[0];
  const continuationCopy = initialData.studyContinuation
    ? studyRecommendedActionCopy[initialData.studyContinuation.recommendedAction]
    : null;

  function handleRefreshMatches(requestId: string) {
    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/requests/${requestId}/matches/refresh`, {
        method: "POST"
      });

      const result = (await response.json().catch(() => null)) as
        | { message?: string; matchCount?: number }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "Не удалось обновить подбор для этого запроса."
        });
        return;
      }

      setFeedback({
        kind: "success",
        message:
          typeof result?.matchCount === "number"
            ? `Подбор обновлен: найдено ${result.matchCount} релевантных вариантов.`
            : "Подбор успешно обновлен."
      });
      router.refresh();
    });
  }

  function handleOpenMatchChat(matchId: string) {
    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/matches/${matchId}/open-chat`, {
        method: "POST"
      });

      const result = (await response.json().catch(() => null)) as
        | {
            status?: "CHAT_READY" | "INVITE_SENT";
            chatId?: string;
            message?: string;
          }
        | null;

      if (!response.ok || !result?.status) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "Не удалось продолжить работу по этому мэтчу."
        });
        return;
      }

      if (result.status === "CHAT_READY" && result.chatId) {
        router.push(buildChatsHref(result.chatId));
        router.refresh();
        return;
      }

      setFeedback({
        kind: "success",
        message:
          "Приглашение отправлено. Чат откроется, когда вторая сторона его примет."
      });
      router.refresh();
    });
  }

  function handleToggleScheduleForm() {
    setShowScheduleForm((current) => !current);
    setScheduleNextState((current) =>
      current.scheduledAt
        ? current
        : buildInitialScheduleState(initialData.studyContinuation)
    );
  }

  function handleScheduleNextSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const continuation = initialData.studyContinuation;

    if (!continuation) {
      return;
    }

    if (!scheduleNextState.scheduledAt) {
      setFeedback({
        kind: "error",
        message: "Укажите дату и время следующей встречи."
      });
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(
        `/api/sessions/${continuation.sessionId}/schedule-next`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            scheduledAt: new Date(scheduleNextState.scheduledAt).toISOString(),
            format: scheduleNextState.format,
            notes: scheduleNextState.notes.trim() || undefined
          })
        }
      );

      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message:
            result?.message ?? "Не удалось запланировать следующую StudyBuddy-встречу."
        });
        return;
      }

      setShowScheduleForm(false);
      setFeedback({
        kind: "success",
        message: "Следующая StudyBuddy-встреча запланирована."
      });
      router.refresh();
    });
  }

  function handleFindNewPartner() {
    if (!initialData.studyContinuation?.requestId) {
      setFeedback({
        kind: "error",
        message:
          "Для перезапуска поиска нужен активный StudyBuddy-запрос на вашей стороне."
      });
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(
        `/api/requests/${initialData.studyContinuation?.requestId}/find-new-partner`,
        {
          method: "POST"
        }
      );

      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "Не удалось запустить поиск нового напарника."
        });
        return;
      }

      setFeedback({
        kind: "success",
        message: "Поиск нового StudyBuddy запущен заново."
      });
      router.refresh();
    });
  }

  function handleStopSearching() {
    if (!initialData.studyContinuation?.requestId) {
      setFeedback({
        kind: "error",
        message:
          "Остановить поиск можно только для активного StudyBuddy-запроса."
      });
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(
        `/api/requests/${initialData.studyContinuation?.requestId}/stop-searching`,
        {
          method: "POST"
        }
      );

      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "Не удалось остановить поиск."
        });
        return;
      }

      setFeedback({
        kind: "success",
        message: "Поиск по StudyBuddy остановлен."
      });
      router.refresh();
    });
  }

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <h2 className="screen-title">
          {showWelcomeSelector
            ? "Профиль готов. Для чего ищем напарника?"
            : "Главная"}
        </h2>
        <p className="screen-description">
          Здесь видны активные запросы, подходящие люди, текущие чаты и ближайшая
          StudyBuddy-встреча.
        </p>
      </div>

      {feedback ? (
        <div
          className={
            feedback.kind === "error"
              ? "feedback-box error-box"
              : "feedback-box success-box"
          }
        >
          <p className="feedback-title">{feedback.message}</p>
        </div>
      ) : null}

      {showWelcomeSelector ? (
        <Card eyebrow="После регистрации" title="Выберите цель поиска">
          <div className="screen-stack">
            <label className="field-stack">
              <span className="field-label">Для чего нужен напарник</span>
              <select
                className="field-input field-select"
                onChange={(event) =>
                  setSelectedGoalValue(event.target.value as PartnerGoalValue)
                }
                value={selectedGoalValue}
              >
                {partnerGoalOptions.map((goal) => (
                  <option key={goal.value} value={goal.value}>
                    {goal.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="quick-goal-preview" data-tone={selectedGoal.tone}>
              <span
                className="accent-icon-badge"
                data-tone={selectedGoal.tone}
                aria-hidden="true"
              >
                {selectedGoal.label.slice(0, 2)}
              </span>
              <div className="special-card-copy">
                <strong>{selectedGoal.label}</strong>
                <p className="helper-text">{selectedGoal.description}</p>
              </div>
            </div>

            <Link
              className={buttonClassName({ fullWidth: true })}
              href={selectedGoal.href}
            >
              {selectedGoal.actionLabel}
            </Link>
          </div>
        </Card>
      ) : null}

      <Card eyebrow="Главное действие" title={initialData.primaryCta.label}>
        <div className="screen-stack">
          <p className="card-body-copy">
            Aperly работает вокруг коротких структурированных запросов. Новый
            сценарий можно открыть в пару шагов.
          </p>
          <Link
            className={buttonClassName({ fullWidth: true })}
            href={initialData.primaryCta.href}
          >
            {initialData.primaryCta.label}
          </Link>
        </div>
      </Card>

      {initialData.upcomingStudySession ? (
        <Card eyebrow="StudyBuddy" title="Ближайшая встреча">
          <div className="screen-stack">
            <div className="dashboard-row-copy">
              <div className="dashboard-row-head">
                <strong>{initialData.upcomingStudySession.subjectName}</strong>
                <span
                  className="tone-pill"
                  data-tone={
                    studyStatusToneByValue[initialData.upcomingStudySession.status]
                  }
                >
                  {
                    studyStatusLabelByValue[
                      initialData.upcomingStudySession.status
                    ]
                  }
                </span>
              </div>
              <p className="helper-text">
                С напарником {initialData.upcomingStudySession.partnerName}
              </p>
              <p className="card-body-copy">
                {formatDateTime(initialData.upcomingStudySession.scheduledFor)} •{" "}
                {
                  formatLabelByValue[initialData.upcomingStudySession.format]
                }
              </p>
              {initialData.upcomingStudySession.notes ? (
                <p className="helper-text">
                  Заметка: {initialData.upcomingStudySession.notes}
                </p>
              ) : null}
            </div>

            <div className="card-actions-row card-actions-row-inline">
              <Link
                className={buttonClassName({ variant: "secondary" })}
                href={buildChatsHref(initialData.upcomingStudySession.chatId)}
              >
                Открыть чат
              </Link>
              <button
                className={buttonClassName({ variant: "ghost" })}
                onClick={handleToggleScheduleForm}
                type="button"
              >
                Запланировать следующую
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {initialData.studyContinuation && continuationCopy ? (
        <Card eyebrow="StudyBuddy" title="Что дальше по совместной учёбе">
          <div className="screen-stack">
            <div className="dashboard-row-copy">
              <div className="dashboard-row-head">
                <strong>{continuationCopy.title}</strong>
                <span className="status-pill">
                  Сессия #{initialData.studyContinuation.sequenceNumber}
                </span>
              </div>
              <p className="helper-text">
                {initialData.studyContinuation.subjectName} •{" "}
                {initialData.studyContinuation.partnerName}
              </p>
              <p className="card-body-copy">{continuationCopy.description}</p>
            </div>

            <div className="dashboard-action-grid">
              <Button disabled={isPending} onClick={handleToggleScheduleForm}>
                Запланировать следующую встречу
              </Button>
              <Button
                disabled={
                  isPending || !initialData.studyContinuation.canFindNewPartner
                }
                onClick={handleFindNewPartner}
                variant="secondary"
              >
                Найти нового партнера
              </Button>
              <Button
                disabled={isPending || !initialData.studyContinuation.canStopSearching}
                onClick={handleStopSearching}
                variant="ghost"
              >
                Остановить поиск
              </Button>
            </div>

            {showScheduleForm ? (
              <form className="screen-stack" onSubmit={handleScheduleNextSession}>
                <div className="form-grid">
                  <label className="field-stack">
                    <span className="field-label">Дата и время</span>
                    <input
                      className="field-input"
                      onChange={(event) =>
                        setScheduleNextState((current) => ({
                          ...current,
                          scheduledAt: event.target.value
                        }))
                      }
                      type="datetime-local"
                      value={scheduleNextState.scheduledAt}
                    />
                  </label>

                  <label className="field-stack">
                    <span className="field-label">Формат</span>
                    <select
                      className="field-input field-select"
                      onChange={(event) =>
                        setScheduleNextState((current) => ({
                          ...current,
                          format: event.target.value as
                            | "ONLINE"
                            | "OFFLINE"
                            | "HYBRID"
                        }))
                      }
                      value={scheduleNextState.format}
                    >
                      {formatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field-stack">
                  <span className="field-label">Комментарий</span>
                  <textarea
                    className="field-input field-textarea"
                    onChange={(event) =>
                      setScheduleNextState((current) => ({
                        ...current,
                        notes: event.target.value
                      }))
                    }
                    placeholder="Например: повторить темы перед семинаром"
                    rows={3}
                    value={scheduleNextState.notes}
                  />
                </label>

                <div className="card-actions-row card-actions-row-inline">
                  <Button disabled={isPending} type="submit">
                    {isPending ? "Сохраняем..." : "Сохранить следующую встречу"}
                  </Button>
                  <Button
                    disabled={isPending}
                    onClick={handleToggleScheduleForm}
                    type="button"
                    variant="ghost"
                  >
                    Свернуть
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card eyebrow="Ваши сценарии" title="Активные запросы">
        {initialData.activeRequests.length === 0 ? (
          <div className="screen-stack">
            <p className="card-body-copy">
              Пока нет активных запросов. Начните с одного короткого сценария, и
              Home превратится в рабочий экран с матчами и чатами.
            </p>
            <Link
              className={buttonClassName({ fullWidth: true })}
              href={initialData.primaryCta.href}
            >
              {initialData.primaryCta.label}
            </Link>
          </div>
        ) : (
          <div className="dashboard-list">
            {initialData.activeRequests.map((request) => (
              <div key={request.id} className="dashboard-row">
                <div className="dashboard-row-copy">
                  <div className="dashboard-row-head">
                    <strong>{request.title}</strong>
                    <span
                      className="tone-pill"
                      data-tone={requestStatusTone[request.status]}
                    >
                      {requestStatusLabels[request.status]}
                    </span>
                  </div>
                  <p className="helper-text">
                    {scenarioLabelByValue[request.scenario]} • {request.subtitle}
                  </p>
                  <p className="card-body-copy">
                    До {formatRequestDate(request.expiresAt)}
                    {request.lastMatchedAt
                      ? ` • обновлялся ${formatRequestDate(request.lastMatchedAt)}`
                      : " • подбор еще не запускался"}
                  </p>
                </div>

                <div className="request-card-actions">
                  <Link
                    className={buttonClassName({ variant: "secondary" })}
                    href={buildMatchesHref(request.id)}
                  >
                    Открыть подбор
                  </Link>
                  <button
                    className={buttonClassName({ variant: "ghost" })}
                    disabled={isPending}
                    onClick={() => handleRefreshMatches(request.id)}
                    type="button"
                  >
                    Обновить мэтчи ({request.activeMatchCount})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card eyebrow="Подбор" title="Последние мэтчи">
        {initialData.latestMatches.length === 0 ? (
          <p className="card-body-copy">
            Как только по активным запросам появятся результаты, они сразу
            появятся здесь.
          </p>
        ) : (
          <div className="dashboard-list">
            {initialData.latestMatches.map((match) => (
              <div key={match.id} className="dashboard-row">
                <div className="dashboard-row-copy">
                  <div className="dashboard-row-head">
                    <strong>{match.candidateName}</strong>
                    <span className="score-pill">{match.score}/100</span>
                  </div>
                  <p className="helper-text">
                    {scenarioLabelByValue[match.requestScenario]} • {match.requestTitle}
                  </p>
                  <p className="card-body-copy">{match.reasonSummary}</p>
                  <p className="helper-text">
                    {chatReadinessLabels[match.chatReadiness]} •{" "}
                    {formatDateTime(match.computedAt)}
                  </p>
                </div>

                <div className="request-card-actions">
                  <button
                    className={buttonClassName({ variant: "secondary" })}
                    disabled={isPending}
                    onClick={() => handleOpenMatchChat(match.id)}
                    type="button"
                  >
                    {match.chatReadiness === "READY_FOR_CHAT"
                      ? "Перейти в чат"
                      : "Отправить приглашение"}
                  </button>
                  <Link
                    className={buttonClassName({ variant: "ghost" })}
                    href={buildMatchesHref(match.requestId, match.id)}
                  >
                    Открыть в мэтчах
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card eyebrow="Чаты" title="Активные диалоги">
        {initialData.activeChats.length === 0 ? (
          <p className="card-body-copy">
            Активных чатов пока нет. Сначала откройте мэтч или отправьте
            приглашение из подбора.
          </p>
        ) : (
          <div className="dashboard-list">
            {initialData.activeChats.map((chat) => (
              <div key={chat.id} className="dashboard-row">
                <div className="dashboard-row-copy">
                  <div className="dashboard-row-head">
                    <strong>{chat.otherUser.displayName}</strong>
                    <span
                      className="tone-pill"
                      data-tone={chat.status === "STALE" ? "warning" : "success"}
                    >
                      {chatStatusLabelByValue[chat.status]}
                    </span>
                  </div>
                  <p className="helper-text">
                    {scenarioLabelByValue[chat.scenario]} •{" "}
                    {chat.lastMessageAt
                      ? `последнее сообщение ${formatDateTime(chat.lastMessageAt)}`
                      : "диалог только открылся"}
                  </p>
                  <p className="card-body-copy">
                    {chat.lastMessagePreview ?? "Пока без сообщений, но чат уже готов."}
                  </p>
                </div>

                <div className="request-card-actions">
                  <Link
                    className={buttonClassName({ variant: "secondary" })}
                    href={buildChatsHref(chat.id)}
                  >
                    Открыть чат
                  </Link>
                  {chat.canSendReminder ? (
                    <span className="status-pill" data-source="dev">
                      Ожидает ответа
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
