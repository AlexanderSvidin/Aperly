"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import type { SerializedInteractionDetail } from "@/features/connections/lib/connection-types";
import type { ActionState } from "@/lib/ui/action-state";
import { idleActionState, isActionLoading } from "@/lib/ui/action-state";

type IncomingInteractionShellProps = {
  interaction: SerializedInteractionDetail;
};

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
            connection?: { id: string } | null;
            message?: string;
          }
        | null;

      if (!response.ok) {
        setActionState({
          status: "error",
          message: payload?.message ?? "Не удалось ответить на входящее."
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

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">
            {interaction.type === "RESPONSE" ? "Отклик" : "Приглашение"}
          </p>
          <h1 className="screen-title">{title}</h1>
          <p className="screen-description">{description}</p>
        </div>

        <div className="match-badge-row">
          <span className="status-pill">
            {scenarioLabelByValue[interaction.scenario]}
          </span>
          <span className="tone-pill" data-tone="warning">
            Входящее
          </span>
        </div>
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">От кого</p>
          <h2 className="card-title">{interaction.personName}</h2>
          <p className="card-body-copy">{interaction.message}</p>
          <p className="helper-text">
            Telegram контакт будет открыт только после принятия.
          </p>
        </div>

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
