"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClassName } from "@/components/ui/button";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import {
  collaborationRoleOptions,
  formatRequestDate
} from "@/features/requests/lib/request-options";
import { formatOptions } from "@/features/profile/lib/profile-options";
import type { SerializedInteractionDetail } from "@/features/connections/lib/connection-types";
import type { ActionState } from "@/lib/ui/action-state";
import { idleActionState, isActionLoading } from "@/lib/ui/action-state";
import { getUserErrorMessage } from "@/lib/ui/error-messages";

type IncomingInteractionShellProps = {
  interaction: SerializedInteractionDetail;
};

const roleLabelByValue = Object.fromEntries(
  collaborationRoleOptions.map((option) => [option.value, option.label])
) as Record<string, string>;

const formatLabelByValue = Object.fromEntries(
  formatOptions.map((option) => [option.value, option.label])
) as Record<string, string>;

export function IncomingInteractionShell({
  interaction
}: IncomingInteractionShellProps) {
  const router = useRouter();
  const [actionState, setActionState] = useState<ActionState>(idleActionState);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const isBusy = isActionLoading(actionState);
  const isResponse = interaction.type === "RESPONSE";
  const title = isResponse ? "Отклик на ваш запрос" : "Вас пригласили";
  const description = isResponse
    ? `${interaction.personName} откликнулся на ваш запрос`
    : `${interaction.personName} приглашает вас`;

  function respond(decision: "ACCEPT" | "DECLINE") {
    if (isBusy || (!interaction.canAccept && decision === "ACCEPT")) {
      return;
    }

    void (async () => {
      setActionState({
        status: "loading",
        message: decision === "ACCEPT" ? "Создаём связь..." : "Отклоняем..."
      });

      const response = await fetch(
        `/api/connections/interactions/${interaction.id}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ decision })
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            code?: string;
            connection?: { id: string } | null;
            message?: string;
          }
        | null;

      if (!response.ok) {
        setActionState({
          status: "error",
          message: getUserErrorMessage(
            payload,
            "Не удалось ответить на входящее. Попробуйте ещё раз."
          )
        });
        return;
      }

      if (decision === "ACCEPT" && payload?.connection?.id) {
        setConnectionId(payload.connection.id);
        router.push(`/connections/${payload.connection.id}`);
        setActionState({
          status: "success",
          message: "Связь активна. Теперь можно перейти в Telegram."
        });
      } else {
        setActionState({
          status: "success",
          message: "Входящее отклонено и отправлено в архив."
        });
      }

      router.refresh();
    })();
  }

  const requestSummary = interaction.requestSummary;
  const otherProfile = interaction.otherProfile;

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <h1 className="page-title">{title}</h1>
        <p className="screen-description">{description}</p>
      </div>

      <section className="surface-card screen-stack">
        <div className="user-preview-head">
          <Avatar name={otherProfile?.name ?? interaction.personName} size="md" />
          <div className="screen-copy">
            <h2 className="card-title">
              {otherProfile?.name ?? interaction.personName}
            </h2>
            {otherProfile?.courseInfo ? (
              <p className="helper-text">{otherProfile.courseInfo}</p>
            ) : null}
          </div>
        </div>

        <p className="card-body-copy">{interaction.message}</p>

        {otherProfile && otherProfile.skills.length > 0 ? (
          <div className="labeled-section">
            <h3 className="labeled-section-title">Умеет</h3>
            <div className="chip-row">
              {otherProfile.skills.map((skill) => (
                <span className="info-chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {requestSummary ? (
        <section className="surface-card screen-stack">
          <div className="labeled-section">
            <h3 className="labeled-section-title">
              {isResponse ? "Ваш запрос" : "Запрос"}
            </h3>
            <div className="match-badge-row">
              <span className="status-pill">
                {scenarioLabelByValue[requestSummary.scenario]}
              </span>
            </div>
            <h2 className="card-title">{requestSummary.title}</h2>
            <div className="chip-row">
              {requestSummary.format ? (
                <span className="info-chip">
                  {formatLabelByValue[requestSummary.format] ?? requestSummary.format}
                </span>
              ) : null}
              {requestSummary.expiresAt ? (
                <span className="info-chip">
                  до {formatRequestDate(requestSummary.expiresAt)}
                </span>
              ) : null}
            </div>
            {requestSummary.roles.length > 0 ? (
              <div className="chip-row">
                {requestSummary.roles.map((role) => (
                  <span className="info-chip" key={role}>
                    {roleLabelByValue[role] ?? role}
                  </span>
                ))}
              </div>
            ) : null}
            {requestSummary.comment ? (
              <p className="card-body-copy">{requestSummary.comment}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="surface-card screen-stack">
        <p className="helper-text">
          Telegram-контакт будет открыт только после принятия.
        </p>

        {actionState.status !== "idle" ? (
          <div
            className={
              actionState.status === "error"
                ? "feedback-box error-box"
                : "feedback-box success-box"
            }
          >
            <p className="feedback-title">{actionState.message}</p>
          </div>
        ) : null}

        <div className="card-actions-row card-actions-row-inline">
          {connectionId ? (
            <Link
              className={buttonClassName()}
              href={`/connections/${connectionId}`}
            >
              Открыть связь
            </Link>
          ) : null}
          {interaction.canAccept && !connectionId ? (
            <Button
              disabled={isBusy}
              isLoading={isBusy}
              loadingLabel="Принимаем..."
              onClick={() => respond("ACCEPT")}
            >
              Принять
            </Button>
          ) : null}
          {interaction.canDecline && !connectionId ? (
            <Button
              disabled={isBusy}
              isLoading={isBusy}
              loadingLabel="Отклоняем..."
              onClick={() => respond("DECLINE")}
              variant="ghost"
            >
              Отклонить
            </Button>
          ) : null}
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href="/connections"
          >
            Назад к связям
          </Link>
        </div>
      </section>
    </section>
  );
}
