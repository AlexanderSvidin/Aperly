"use client";

import { useState } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { buttonClassName, Button } from "@/components/ui/button";
import {
  getMatchUiStatus,
  matchModeLabels,
  scenarioLabelByValue
} from "@/features/matching/lib/match-options";
import type {
  SerializedMatchListItem,
  SerializedMatchesScreenData,
  SerializedRequestMatches
} from "@/features/matching/lib/match-types";
import { formatOptions } from "@/features/profile/lib/profile-options";
import {
  formatRequestDate,
  requestStatusLabels,
  requestStatusTone
} from "@/features/requests/lib/request-options";
import { getUserErrorMessage } from "@/lib/ui/error-messages";
import type { ActionState } from "@/lib/ui/action-state";
import { idleActionState, isActionLoading } from "@/lib/ui/action-state";

type MatchesScreenShellProps = {
  creationNotice?: boolean;
  initialData: SerializedMatchesScreenData;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
};

const formatLabelByValue = Object.fromEntries(
  formatOptions.map((option) => [option.value, option.label])
) as Record<(typeof formatOptions)[number]["value"], string>;

function buildMatchesHref(
  requestId?: string | null,
  matchId?: string | null
): Route {
  const searchParams = new URLSearchParams();

  if (matchId) {
    searchParams.set("matchId", matchId);
  }

  const queryString = searchParams.toString();

  if (requestId) {
    return (queryString
      ? `/requests/${requestId}/matches?${queryString}`
      : `/requests/${requestId}/matches`) as Route;
  }

  return "/connections" as Route;
}

function formatProfileMeta(match: SerializedMatchListItem) {
  const parts = [
    match.candidateProfile.program,
    match.candidateProfile.courseYear
      ? `${match.candidateProfile.courseYear} курс`
      : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Профиль нуждается в уточнении";
}

function renderInfoChips(values: string[], limit: number) {
  return values.slice(0, limit).map((value) => (
    <span key={value} className="info-chip">
      {value}
    </span>
  ));
}

export function MatchesScreenShell({
  creationNotice = false,
  initialData
}: MatchesScreenShellProps) {
  const router = useRouter();
  const [refreshedCollection, setRefreshedCollection] =
    useState<SerializedRequestMatches | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [introMessage, setIntroMessage] = useState("");
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {}
  );

  const requests =
    refreshedCollection && refreshedCollection.requestId === initialData.selectedRequestId
      ? initialData.requests.map((request) =>
          request.id === refreshedCollection.requestId
            ? {
                ...request,
                activeMatchCount: refreshedCollection.matches.length,
                fallbackUsed: refreshedCollection.fallbackUsed,
                lastMatchedAt: refreshedCollection.lastMatchedAt
              }
            : request
        )
      : initialData.requests;
  const selectedCollection =
    refreshedCollection &&
    refreshedCollection.requestId === initialData.selectedRequestMatches?.requestId
      ? refreshedCollection
      : initialData.selectedRequestMatches;

  const selectedRequest = requests.find(
    (request) => request.id === initialData.selectedRequestId
  );
  const selectedMatch =
    selectedCollection?.matches.find(
      (match) => match.id === initialData.selectedMatchId
    ) ?? null;

  function getActionState(actionKey: string) {
    return actionStates[actionKey] ?? idleActionState;
  }

  function setActionStatus(actionKey: string, state: ActionState) {
    setActionStates((currentStates) => ({
      ...currentStates,
      [actionKey]: state
    }));
  }

  function isActionBusy(actionKey: string) {
    return isActionLoading(getActionState(actionKey));
  }

  function handleRefresh() {
    if (!selectedCollection || selectedCollection.requestStatus !== "ACTIVE") {
      return;
    }

    const actionKey = `refresh:${selectedCollection.requestId}`;

    if (isActionBusy(actionKey)) {
      return;
    }

    void (async () => {
      setFeedback(null);
      setActionStatus(actionKey, {
        status: "loading",
        message: "Обновляем подборку..."
      });

      const response = await fetch(
        `/api/requests/${selectedCollection.requestId}/matches/refresh`,
        {
          method: "POST"
        }
      );

      const result = (await response.json().catch(() => null)) as
        | {
            code?: string;
            message?: string;
            matchCount?: number;
            newMatchCount?: number;
            collection?: SerializedMatchesScreenData["selectedRequestMatches"];
          }
        | null;

      if (!response.ok) {
        const message = getUserErrorMessage(
          result,
          "Не удалось обновить подборку. Попробуйте ещё раз."
        );
        setActionStatus(actionKey, {
          status: "error",
          message
        });
        setFeedback({
          kind: "error",
          message
        });
        return;
      }

      const message =
        typeof result?.newMatchCount === "number" && result.newMatchCount > 0
          ? `Найдено ${result.newMatchCount} новых совпадений.`
          : typeof result?.matchCount === "number" && result.matchCount > 0
            ? "Подборка обновлена."
            : "Пока новых совпадений нет.";

      const refreshedCollection = result?.collection;

      if (refreshedCollection) {
        setRefreshedCollection(refreshedCollection);
      }

      setActionStatus(actionKey, {
        status: "success",
        message
      });
      setFeedback({
        kind: "success",
        message
      });

      router.refresh();
    })();
  }

  function handleOpenChat() {
    if (!selectedMatch) {
      return;
    }

    if (!selectedMatch.invitationState.canAct) {
      return;
    }

    const text = introMessage.trim();

    if (text.length < 10) {
      setFeedback({
        kind: "error",
        message: "Коротко напишите, почему хотите присоединиться."
      });
      return;
    }

    const actionKey = `match:${selectedMatch.id}`;

    if (isActionBusy(actionKey)) {
      return;
    }

    void (async () => {
      setFeedback(null);
      setActionStatus(actionKey, {
        status: "loading",
        message: "Готовим следующий шаг..."
      });

      const response = await fetch(`/api/matches/${selectedMatch.id}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: text })
      });

      const result = (await response.json().catch(() => null)) as
        | {
            code?: string;
            status?: "CHAT_READY" | "INVITE_SENT" | "RESPONSE_SENT";
            chatId?: string;
            interaction?: unknown;
            message?: string;
          }
        | null;

      if (!response.ok || !result?.interaction) {
        const message = getUserErrorMessage(
          result,
          "Не удалось перейти к следующему шагу. Попробуйте ещё раз."
        );
        setActionStatus(actionKey, {
          status: "error",
          message
        });
        setFeedback({
          kind: "error",
          message
        });
        return;
      }

      if (result.status === "CHAT_READY" && result.chatId) {
        setActionStatus(actionKey, {
          status: "success",
          message: "Связь уже открыта."
        });
        router.refresh();
        return;
      }

      setActionStatus(actionKey, {
        status: "success",
        message: "Отклик отправлен. Автор запроса сможет ответить."
      });
      setFeedback({
        kind: "success",
        message: "Отклик отправлен. Автор запроса сможет ответить."
      });
      setIntroMessage("");
      router.refresh();
    })();
  }

  function handleRespondToResponse(decision: "ACCEPT" | "DECLINE") {
    if (!selectedMatch) {
      return;
    }

    const actionKey = `response:${decision.toLowerCase()}:${selectedMatch.id}`;

    if (isActionBusy(actionKey)) {
      return;
    }

    void (async () => {
      setFeedback(null);
      setActionStatus(actionKey, {
        status: "loading",
        message: decision === "ACCEPT" ? "Принимаем отклик..." : "Отклоняем отклик..."
      });

      const response = await fetch(`/api/matches/${selectedMatch.id}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ decision })
      });
      const result = (await response.json().catch(() => null)) as
        | {
            code?: string;
            status?: "ACCEPTED" | "DECLINED";
            telegramUrl?: string | null;
            contactHint?: string;
            message?: string;
          }
        | null;

      if (!response.ok || !result?.status) {
        const message = getUserErrorMessage(
          result,
          "Не удалось ответить на отклик. Попробуйте ещё раз."
        );
        setActionStatus(actionKey, {
          status: "error",
          message
        });
        setFeedback({
          kind: "error",
          message
        });
        return;
      }

      const message =
        result.status === "ACCEPTED"
          ? result.telegramUrl
            ? "Отклик принят. Теперь можно написать в Telegram."
            : (result.contactHint ?? "Отклик принят, но контакт недоступен.")
          : "Отклик отклонён.";

      setActionStatus(actionKey, {
        status: "success",
        message
      });
      setFeedback({
        kind: "success",
        message
      });
      router.refresh();
    })();
  }

  return (
    <div className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Отклики</p>
          <h2 className="screen-title">Подходящие люди по вашим запросам</h2>
          <p className="screen-description">
            Выберите свой запрос и посмотрите, кто подходит, кто ждёт ответа и
            какой следующий шаг доступен.
          </p>
        </div>

        {creationNotice ? (
          <div className="feedback-box success-box">
            <p className="feedback-title">
              Запрос опубликован. Теперь люди смогут откликнуться.
            </p>
          </div>
        ) : null}

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

        {requests.length === 0 ? (
          <div className="screen-stack">
            <p className="screen-description">
              Создайте короткий запрос, чтобы получать отклики и подходящих
              людей под конкретную цель.
            </p>
            <Link
              className={buttonClassName({
                fullWidth: true
              })}
              href="/create"
            >
              Создать запрос
            </Link>
          </div>
        ) : (
          <div className="request-selector-grid">
            {requests.map((request) => (
              <Link
                key={request.id}
                className="request-selector-card"
                data-active={request.id === initialData.selectedRequestId}
                href={buildMatchesHref(request.id)}
              >
                <div className="request-selector-head">
                  <div className="request-selector-copy">
                    <p className="card-eyebrow">
                      {scenarioLabelByValue[request.scenario]}
                    </p>
                    <h3 className="card-title">{request.title}</h3>
                    <p className="card-body-copy">{request.subtitle}</p>
                  </div>
                  <div className="match-badge-row">
                    <span
                      className="tone-pill"
                      data-tone={requestStatusTone[request.status]}
                    >
                      {requestStatusLabels[request.status]}
                    </span>
                    <span className="score-pill">
                      {request.activeMatchCount} совп.
                    </span>
                  </div>
                </div>

                <p className="helper-text">
                  До {formatRequestDate(request.expiresAt)}
                  {request.lastMatchedAt
                    ? ` • обновлено ${formatRequestDate(request.lastMatchedAt)}`
                    : " • ещё не пересчитывался"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {selectedCollection && selectedRequest ? (
        <section className="surface-card screen-stack">
          <div className="request-collection-head">
            <div className="screen-copy">
              <div className="match-badge-row">
                <span
                  className="tone-pill"
                  data-tone={requestStatusTone[selectedCollection.requestStatus]}
                >
                  {requestStatusLabels[selectedCollection.requestStatus]}
                </span>
                {selectedCollection.fallbackUsed ? (
                  <span className="status-pill">Резервный подбор</span>
                ) : null}
              </div>
              <h2 className="screen-title">{selectedCollection.requestTitle}</h2>
              <p className="screen-description">
                {scenarioLabelByValue[selectedCollection.requestScenario]} •
                активен до {formatRequestDate(selectedCollection.requestExpiresAt)}
              </p>
            </div>

            <div className="card-actions-row">
              <Button
                disabled={
                  isActionBusy(`refresh:${selectedCollection.requestId}`) ||
                  selectedCollection.requestStatus !== "ACTIVE"
                }
                fullWidth
                isLoading={isActionBusy(`refresh:${selectedCollection.requestId}`)}
                loadingLabel="Обновляем..."
                onClick={handleRefresh}
                variant="secondary"
              >
                Обновить подборку
              </Button>
              <Link
                className={buttonClassName({
                  fullWidth: true,
                  variant: "ghost"
                })}
                href="/create"
              >
                Изменить запрос
              </Link>
            </div>
          </div>

          {selectedCollection.emptyState ? (
            <div className="screen-stack">
              {selectedCollection.emptyState.keepRequestOpen ? (
                <span className="tone-pill" data-tone="warning">
                  Запрос остаётся активным
                </span>
              ) : null}
              <div className="screen-copy">
                <h3 className="card-title">{selectedCollection.emptyState.title}</h3>
                <p className="card-body-copy">
                  {selectedCollection.emptyState.description}
                </p>
              </div>
              <ul className="bullet-list">
                {selectedCollection.emptyState.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
              <div className="card-actions-row card-actions-row-inline">
                {selectedCollection.requestStatus === "ACTIVE" ? (
                  <Button
                    disabled={isActionBusy(`refresh:${selectedCollection.requestId}`)}
                    isLoading={isActionBusy(`refresh:${selectedCollection.requestId}`)}
                    loadingLabel="Ищем..."
                    onClick={handleRefresh}
                    variant="secondary"
                  >
                    Найти снова
                  </Button>
                ) : null}
                <Link
                  className={buttonClassName({
                    variant: "ghost"
                  })}
                  href="/profile"
                >
                  Улучшить профиль
                </Link>
              </div>
            </div>
          ) : (
            <div className="match-list">
              {selectedCollection.matches.map((match) => {
                const isSelected = match.id === initialData.selectedMatchId;
                const uiStatus = getMatchUiStatus(match);

                return (
                  <article key={match.id} className="match-card">
                    <div className="match-card-head">
                      <div className="screen-copy">
                        <div className="match-badge-row">
                          <span
                            className="tone-pill"
                            data-tone={uiStatus.tone}
                          >
                            {uiStatus.label}
                          </span>
                          <span className="status-pill">
                            {matchModeLabels[match.mode]}
                          </span>
                        </div>
                        <h3 className="card-title">{match.candidateProfile.fullName}</h3>
                        <p className="card-body-copy">Почему подходит</p>
                        <div className="chip-row">
                          {match.reasons.length > 0
                            ? renderInfoChips(match.reasons, 4)
                            : renderInfoChips([match.reasonSummary], 1)}
                        </div>
                      </div>

                      <Link
                        className={buttonClassName({
                          variant: isSelected ? "ghost" : "secondary"
                        })}
                        href={
                          isSelected
                            ? buildMatchesHref(selectedCollection.requestId)
                            : buildMatchesHref(selectedCollection.requestId, match.id)
                        }
                      >
                        {isSelected ? "Скрыть детали" : "Подробнее"}
                      </Link>
                    </div>

                    {match.candidateRequest ? (
                      <div className="match-context-card">
                        <p className="card-eyebrow">
                          {scenarioLabelByValue[match.candidateRequest.scenario]}
                        </p>
                        <p className="feedback-title">
                          {match.candidateRequest.title}
                        </p>
                        <p className="card-body-copy">
                          {match.candidateRequest.subtitle}
                        </p>
                        <p className="helper-text">
                          Формат:{" "}
                          {match.candidateRequest.preferredFormat
                            ? formatLabelByValue[match.candidateRequest.preferredFormat]
                            : "не указан"}
                        </p>
                      </div>
                    ) : null}

                    <div className="screen-stack">
                      <p className="helper-text">{formatProfileMeta(match)}</p>
                      {match.candidateProfile.bio ? (
                        <p className="card-body-copy">{match.candidateProfile.bio}</p>
                      ) : null}
                      <div className="chip-row">
                        {renderInfoChips(match.candidateProfile.skillNames, 3)}
                        {renderInfoChips(match.candidateProfile.subjectNames, 2)}
                      </div>
                      {match.candidateProfile.availabilityLabels.length > 0 ? (
                        <p className="helper-text">
                          Время:{" "}
                          {match.candidateProfile.availabilityLabels
                            .slice(0, 2)
                            .join(" • ")}
                        </p>
                      ) : null}
                      <p className="helper-text">{uiStatus.nextAction}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {selectedMatch && selectedCollection ? (
        <section className="surface-card screen-stack">
          <div className="screen-copy">
            <p className="card-eyebrow">Детали совпадения</p>
            <h2 className="screen-title">{selectedMatch.candidateProfile.fullName}</h2>
            <p className="screen-description">Почему подходит</p>
          </div>

          <div className="match-dimension-list">
            <div className="chip-row">
              {selectedMatch.reasons.length > 0
                ? renderInfoChips(selectedMatch.reasons, 4)
                : renderInfoChips([selectedMatch.reasonSummary], 1)}
            </div>
            {selectedMatch.dimensions.length > 0 ? (
              <p className="helper-text">
                Детали подбора вторичны: важнее конкретные причины выше.
              </p>
            ) : null}
          </div>

          <div className="match-context-card">
            <p className="card-eyebrow">Следующий шаг</p>
            <p className="feedback-title">
              {getMatchUiStatus(selectedMatch).label}
            </p>
            {selectedMatch.response.introMessage ? (
              <div className="quick-goal-preview">
                <span className="accent-icon-badge" aria-hidden="true">
                  TG
                </span>
                <div className="special-card-copy">
                  <strong>
                    {selectedMatch.response.sentByMe
                      ? "Ваш отклик"
                      : "Отклик участника"}
                  </strong>
                  <p className="helper-text">{selectedMatch.response.introMessage}</p>
                </div>
              </div>
            ) : (
              <p className="card-body-copy">
                Напишите коротко, кто вы, почему подходите и что предлагаете
                сделать дальше.
              </p>
            )}

            {selectedMatch.invitationState.status === "NONE" ? (
              <label className="field-stack">
                <span className="field-label">Отклик</span>
                <textarea
                  className="field-textarea"
                  onChange={(event) => setIntroMessage(event.target.value)}
                  placeholder="Коротко напишите, почему хотите присоединиться"
                  rows={4}
                  value={introMessage}
                />
                <span className="helper-text">
                  {introMessage.trim().length} символов
                </span>
              </label>
            ) : null}

            {selectedMatch.response.status === "ACCEPTED" && false ? (
              <p className="card-body-copy">{selectedMatch!.response.contactHint}</p>
            ) : null}
          </div>

          <div className="card-actions-row card-actions-row-inline">
            {selectedMatch.response.status === "ACCEPTED" &&
            false &&
            selectedMatch!.response.telegramUrl ? (
              <a
                className={buttonClassName()}
                href={selectedMatch!.response.telegramUrl ?? undefined}
                rel="noreferrer"
                target="_blank"
              >
                Написать в Telegram
              </a>
            ) : null}

            {selectedMatch.response.canAccept && false ? (
              <>
                <Button
                  disabled={
                    isActionBusy(`response:accept:${selectedMatch!.id}`) ||
                    isActionBusy(`response:decline:${selectedMatch!.id}`)
                  }
                  isLoading={isActionBusy(`response:accept:${selectedMatch!.id}`)}
                  loadingLabel="Принимаем..."
                  onClick={() => handleRespondToResponse("ACCEPT")}
                >
                  Принять отклик
                </Button>
                <Button
                  disabled={
                    isActionBusy(`response:accept:${selectedMatch!.id}`) ||
                    isActionBusy(`response:decline:${selectedMatch!.id}`)
                  }
                  isLoading={isActionBusy(`response:decline:${selectedMatch!.id}`)}
                  loadingLabel="Отклоняем..."
                  onClick={() => handleRespondToResponse("DECLINE")}
                  variant="ghost"
                >
                  Отклонить
                </Button>
              </>
            ) : null}

            {selectedMatch.invitationState.status === "NONE" ? (
              <Button
                disabled={
                  !selectedMatch.invitationState.canAct ||
                  introMessage.trim().length < 10 ||
                  isActionBusy(`match:${selectedMatch.id}`)
                }
                isLoading={isActionBusy(`match:${selectedMatch.id}`)}
                loadingLabel="Отправляем..."
                onClick={handleOpenChat}
              >
                Пригласить
              </Button>
            ) : null}
            {selectedMatch.invitationState.status === "ACCEPTED" &&
            selectedMatch.invitationState.connectionId ? (
              <Link
                className={buttonClassName()}
                href={`/connections/${selectedMatch.invitationState.connectionId}` as Route}
              >
                {selectedMatch.invitationState.label}
              </Link>
            ) : null}
            {selectedMatch.invitationState.status !== "NONE" &&
            selectedMatch.invitationState.status !== "ACCEPTED" ? (
              <Button disabled variant="secondary">
                {selectedMatch.invitationState.label}
              </Button>
            ) : null}
            <Link
              className={buttonClassName({
                variant: "secondary"
              })}
              href={buildMatchesHref(selectedCollection.requestId)}
            >
              Вернуться к списку
            </Link>
            <Link
              className={buttonClassName({
                variant: "ghost"
              })}
              href="/profile"
            >
              Улучшить профиль
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
