"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { buttonClassName, Button } from "@/components/ui/button";
import {
  chatReadinessLabels,
  matchModeLabels,
  matchStatusLabels,
  matchStatusTone,
  scenarioLabelByValue
} from "@/features/matching/lib/match-options";
import type {
  SerializedMatchListItem,
  SerializedMatchesScreenData
} from "@/features/matching/lib/match-types";
import { formatOptions } from "@/features/profile/lib/profile-options";
import {
  formatRequestDate,
  requestStatusLabels,
  requestStatusTone
} from "@/features/requests/lib/request-options";

type MatchesScreenShellProps = {
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

  if (requestId) {
    searchParams.set("requestId", requestId);
  }

  if (matchId) {
    searchParams.set("matchId", matchId);
  }

  const queryString = searchParams.toString();

  return (queryString ? `/matches?${queryString}` : "/matches") as Route;
}

function buildChatsHref(chatId?: string | null): Route {
  const searchParams = new URLSearchParams();

  if (chatId) {
    searchParams.set("chatId", chatId);
  }

  const queryString = searchParams.toString();

  return (queryString ? `/chats?${queryString}` : "/chats") as Route;
}

function formatProfileMeta(match: SerializedMatchListItem) {
  const parts = [
    match.candidateProfile.program,
    match.candidateProfile.courseYear
      ? `${match.candidateProfile.courseYear} ����`
      : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "������� �������� ������";
}

function renderInfoChips(values: string[], limit: number) {
  return values.slice(0, limit).map((value) => (
    <span key={value} className="info-chip">
      {value}
    </span>
  ));
}

export function MatchesScreenShell({ initialData }: MatchesScreenShellProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRequest = initialData.requests.find(
    (request) => request.id === initialData.selectedRequestId
  );
  const selectedCollection = initialData.selectedRequestMatches;
  const selectedMatch =
    selectedCollection?.matches.find(
      (match) => match.id === initialData.selectedMatchId
    ) ?? null;

  function handleRefresh() {
    if (!selectedCollection || selectedCollection.requestStatus !== "ACTIVE") {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(
        `/api/requests/${selectedCollection.requestId}/matches/refresh`,
        {
          method: "POST"
        }
      );

      const result = (await response.json().catch(() => null)) as
        | {
            message?: string;
            matchCount?: number;
          }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "�� ������� �������� �������."
        });
        return;
      }

      setFeedback({
        kind: "success",
        message:
          typeof result?.matchCount === "number"
            ? `������� ���������: ${result.matchCount} ����������.`
            : "������� ���������."
      });

      router.refresh();
    });
  }

  function handleOpenChat() {
    if (!selectedMatch) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/matches/${selectedMatch.id}/open-chat`, {
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
          message:
            result?.message ?? "Не удалось перейти к следующему шагу по мэтчу."
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

  return (
    <div className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">������</p>
          <h2 className="screen-title">������� �� �������� ��������</h2>
          <p className="screen-description">
            Aperly ������� ���� ���������� ����� ���������, � �������� ������ ��
            �������� �������� ���������� ������ �����, ����� ���������� ��������
            ������� ����.
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

        {initialData.requests.length === 0 ? (
          <div className="screen-stack">
            <p className="screen-description">
              �������� �������� ���� ���. ������� �������� ������, ����� ��������
              ����������������� ������.
            </p>
            <Link
              className={buttonClassName({
                fullWidth: true
              })}
              href="/requests/new"
            >
              ������� ������
            </Link>
          </div>
        ) : (
          <div className="request-selector-grid">
            {initialData.requests.map((request) => (
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
                      {request.activeMatchCount} ����.
                    </span>
                  </div>
                </div>

                <p className="helper-text">
                  �� {formatRequestDate(request.expiresAt)}
                  {request.lastMatchedAt
                    ? ` � ��������� ${formatRequestDate(request.lastMatchedAt)}`
                    : " � ��� �� ���������������"}
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
                  <span className="status-pill">���� �������� ������</span>
                ) : null}
              </div>
              <h2 className="screen-title">{selectedCollection.requestTitle}</h2>
              <p className="screen-description">
                {scenarioLabelByValue[selectedCollection.requestScenario]} �
                ��������� �� {formatRequestDate(selectedCollection.requestExpiresAt)}
              </p>
            </div>

            <div className="card-actions-row">
              <Button
                disabled={
                  isPending || selectedCollection.requestStatus !== "ACTIVE"
                }
                fullWidth
                onClick={handleRefresh}
                variant="secondary"
              >
                {isPending ? "���������..." : "�������� �������"}
              </Button>
              <Link
                className={buttonClassName({
                  fullWidth: true,
                  variant: "ghost"
                })}
                href="/requests/new"
              >
                ��������� ��������
              </Link>
            </div>
          </div>

          {selectedCollection.emptyState ? (
            <div className="screen-stack">
              {selectedCollection.emptyState.keepRequestOpen ? (
                <span className="tone-pill" data-tone="warning">
                  ������ ������� ��������
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
                    disabled={isPending}
                    onClick={handleRefresh}
                    variant="secondary"
                  >
                    �������� �����
                  </Button>
                ) : null}
                <Link
                  className={buttonClassName({
                    variant: "ghost"
                  })}
                  href="/profile"
                >
                  �������� �������
                </Link>
              </div>
            </div>
          ) : (
            <div className="match-list">
              {selectedCollection.matches.map((match) => {
                const isSelected = match.id === initialData.selectedMatchId;

                return (
                  <article key={match.id} className="match-card">
                    <div className="match-card-head">
                      <div className="screen-copy">
                        <div className="match-badge-row">
                          <span className="score-pill">{match.score}/100</span>
                          <span
                            className="tone-pill"
                            data-tone={matchStatusTone[match.status]}
                          >
                            {matchStatusLabels[match.status]}
                          </span>
                          <span className="status-pill">
                            {matchModeLabels[match.mode]}
                          </span>
                        </div>
                        <h3 className="card-title">{match.candidateProfile.fullName}</h3>
                        <p className="card-body-copy">{match.reasonSummary}</p>
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
                        {isSelected ? "������ ������" : "���������"}
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
                          ������:{" "}
                          {match.candidateRequest.preferredFormat
                            ? formatLabelByValue[match.candidateRequest.preferredFormat]
                            : "�� ������"}
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
                          �����:{" "}
                          {match.candidateProfile.availabilityLabels
                            .slice(0, 2)
                            .join(" � ")}
                        </p>
                      ) : null}
                      <p className="helper-text">
                        {chatReadinessLabels[match.chatReadiness]}
                      </p>
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
            <p className="card-eyebrow">������ �����</p>
            <h2 className="screen-title">{selectedMatch.candidateProfile.fullName}</h2>
            <p className="screen-description">{selectedMatch.reasonSummary}</p>
          </div>

          {selectedMatch.dimensions.length > 0 ? (
            <div className="match-dimension-list">
              {selectedMatch.dimensions.map((dimension) => (
                <div key={dimension.key} className="match-dimension-row">
                  <span>{dimension.label}</span>
                  <strong>{dimension.score}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="helper-text">
              ��� ����� ����� �������� ������ ������� ���������� ������� ���
              ����������� ���������.
            </p>
          )}

          <div className="match-context-card">
            <p className="card-eyebrow">��������� ���</p>
            <p className="feedback-title">
              {chatReadinessLabels[selectedMatch.chatReadiness]}
            </p>
            <p className="card-body-copy">
              ���� ���� ��������� ���������� ����������. ��� � ����� ����������
              ����� ���������� ��������, ��� ������������� ������ �������.
            </p>
          </div>

          <div className="card-actions-row card-actions-row-inline">
            <Button
              disabled={isPending}
              onClick={handleOpenChat}
            >
              {selectedMatch.chatReadiness === "READY_FOR_CHAT"
                ? "Перейти в чат"
                : "Отправить приглашение"}
            </Button>
            <Link
              className={buttonClassName({
                variant: "secondary"
              })}
              href={buildMatchesHref(selectedCollection.requestId)}
            >
              ��������� � ������
            </Link>
            <Link
              className={buttonClassName({
                variant: "ghost"
              })}
              href="/profile"
            >
              �������� �������
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
