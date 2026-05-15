"use client";

import { useState } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InviteConfirmSheet } from "@/features/matching/components/invite-confirm-sheet";
import type {
  SerializedMatchListItem,
  SerializedMatchesScreenData
} from "@/features/matching/lib/match-types";
import { formatOptions } from "@/features/profile/lib/profile-options";
import {
  formatRequestDate,
  requestStatusLabels
} from "@/features/requests/lib/request-options";
import type { ActionState } from "@/lib/ui/action-state";
import { idleActionState } from "@/lib/ui/action-state";

type RequestMatchesScreenProps = {
  creationNotice?: boolean;
  initialData: SerializedMatchesScreenData;
};

type ScenarioLabel = "Учёба" | "Команда" | "Проект" | "Активность";

const scenarioShortLabels: Record<string, ScenarioLabel> = {
  STUDY: "Учёба",
  CASE: "Команда",
  PROJECT: "Проект",
  ACTIVITY: "Активность"
};

const formatLabelByValue = Object.fromEntries(
  formatOptions.map((option) => [option.value, option.label])
) as Record<(typeof formatOptions)[number]["value"], string>;

const reasonLabelByKey: Record<string, string> = {
  availability_overlap: "совпадает время",
  format_fit: "подходит формат",
  role_fit: "роль совпадает",
  skill_fit: "есть нужные навыки"
};

function formatProfileMeta(match: SerializedMatchListItem) {
  const parts = [
    match.candidateProfile.program,
    match.candidateProfile.courseYear
      ? `${match.candidateProfile.courseYear} курс`
      : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Профиль заполнен частично";
}

function getExplainableReasons(match: SerializedMatchListItem) {
  const fromDimensions = match.dimensions
    .filter((dimension) => dimension.score > 0 && reasonLabelByKey[dimension.key])
    .sort((left, right) => right.score - left.score)
    .map((dimension) => reasonLabelByKey[dimension.key]!);

  return [...new Set(fromDimensions.length > 0 ? fromDimensions : match.reasons)].slice(0, 4);
}

function CandidateCard({
  match,
  onInvite,
  state
}: {
  match: SerializedMatchListItem;
  onInvite: (match: SerializedMatchListItem) => void;
  state: ActionState;
}) {
  const isJustInvited = state.status === "success";
  const invitationState = match.invitationState;
  const statusLabel = isJustInvited ? "Ждём ответ" : invitationState.label;

  return (
    <article className="match-card">
      <div className="match-card-head">
        <div className="screen-copy">
          <h3 className="card-title">{match.candidateProfile.fullName}</h3>
          <p className="card-body-copy">{formatProfileMeta(match)}</p>
        </div>
        <Link
          className={buttonClassName({ variant: "secondary" })}
          href={
            `/users/${match.candidateProfile.userId}/preview?matchId=${match.id}` as Route
          }
        >
          Профиль
        </Link>
      </div>

      <div className="chip-row">
        {match.candidateProfile.skillNames.slice(0, 3).map((skill) => (
          <span className="info-chip" key={skill}>
            {skill}
          </span>
        ))}
        {match.candidateRequest?.preferredFormat ? (
          <span className="info-chip">
            {formatLabelByValue[match.candidateRequest.preferredFormat]}
          </span>
        ) : null}
      </div>

      <div className="chip-row">
        {getExplainableReasons(match).map((reason) => (
          <span className="status-pill" key={reason}>
            {reason}
          </span>
        ))}
      </div>

      {state.status === "error" ? (
        <div className="feedback-box error-box">
          <p className="feedback-title">{state.message}</p>
        </div>
      ) : null}

      <div className="card-actions-row card-actions-row-inline">
        {invitationState.status === "NONE" && !isJustInvited ? (
          <Button
            disabled={!invitationState.canAct}
            onClick={() => onInvite(match)}
          >
            Пригласить
          </Button>
        ) : invitationState.status === "ACCEPTED" &&
          invitationState.connectionId ? (
          <Link
            className={buttonClassName()}
            href={`/connections/${invitationState.connectionId}` as Route}
          >
            Перейти в связь
          </Link>
        ) : (
          <Button disabled variant="secondary">
            {statusLabel}
          </Button>
        )}
      </div>
    </article>
  );
}

function EmptyMatches({ requestId }: { requestId: string }) {
  return (
    <section className="surface-card screen-stack">
      <EmptyState
        actionHref={`/requests/${requestId}/edit`}
        actionLabel="Изменить запрос"
        title="Пока нет подходящих людей"
        text="Попробуйте изменить запрос или вернитесь позже."
      />
    </section>
  );
}

export function RequestMatchesScreen({
  creationNotice = false,
  initialData
}: RequestMatchesScreenProps) {
  const router = useRouter();
  const collection = initialData.selectedRequestMatches;
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {}
  );
  const [selectedInvite, setSelectedInvite] =
    useState<SerializedMatchListItem | null>(null);

  function getActionState(matchId: string) {
    return actionStates[matchId] ?? idleActionState;
  }

  function setActionState(matchId: string, state: ActionState) {
    setActionStates((current) => ({
      ...current,
      [matchId]: state
    }));
  }

  function invite(match: SerializedMatchListItem) {
    setSelectedInvite(match);
  }

  function handleInviteSuccess(matchId: string) {
    setActionState(matchId, {
      status: "success",
      message: "Ждём ответ."
    });
    router.refresh();
  }

  if (!collection) {
    return <EmptyMatches requestId={initialData.selectedRequestId ?? ""} />;
  }

  const requestSummary = initialData.requests.find(
    (request) => request.id === collection.requestId
  );

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <Link className={buttonClassName({ variant: "ghost" })} href="/profile/requests">
          ←
        </Link>
        <div className="screen-copy">
          <p className="card-eyebrow">
            {scenarioShortLabels[collection.requestScenario]}
          </p>
          <h1 className="screen-title">Подходящие люди</h1>
          <p className="screen-description">
            {collection.matches.length} человек под запрос
          </p>
        </div>
        {creationNotice ? (
          <div className="feedback-box success-box">
            <p className="feedback-title">
              Запрос опубликован. Теперь можно смотреть кандидатов.
            </p>
          </div>
        ) : null}
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <div className="match-badge-row">
            <span className="tone-pill" data-tone="success">
              {requestStatusLabels[collection.requestStatus]}
            </span>
            {collection.fallbackUsed ? (
              <span className="status-pill">Резервный подбор</span>
            ) : null}
          </div>
          <h2 className="card-title">{collection.requestTitle}</h2>
          <p className="card-body-copy">
            {requestSummary?.subtitle ?? "Параметры запроса"} • до{" "}
            {formatRequestDate(collection.requestExpiresAt)}
          </p>
        </div>
        <Link
          className={buttonClassName({ fullWidth: true, variant: "secondary" })}
          href={`/requests/${collection.requestId}/edit` as Route}
        >
          Изменить
        </Link>
      </section>

      {collection.matches.length === 0 ? (
        <EmptyMatches requestId={collection.requestId} />
      ) : (
        <div className="match-list">
          {collection.matches.map((match) => (
            <CandidateCard
              key={match.id}
              match={match}
              onInvite={invite}
              state={getActionState(match.id)}
            />
          ))}
        </div>
      )}
      <InviteConfirmSheet
        invite={
          selectedInvite && collection
            ? {
                matchId: selectedInvite.id,
                candidateName: selectedInvite.candidateProfile.fullName,
                requestTitle: collection.requestTitle,
                requestType: scenarioShortLabels[collection.requestScenario],
                role: selectedInvite.reasons.find((reason) =>
                  reason.toLowerCase().includes("роль")
                ) ?? null,
                format: selectedInvite.candidateRequest?.preferredFormat
                  ? formatLabelByValue[selectedInvite.candidateRequest.preferredFormat]
                  : null
              }
            : null
        }
        isOpen={Boolean(selectedInvite)}
        onClose={() => setSelectedInvite(null)}
        onSuccess={handleInviteSuccess}
      />
    </section>
  );
}
