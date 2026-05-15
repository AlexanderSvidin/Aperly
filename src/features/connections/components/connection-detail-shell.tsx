"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import type { SerializedConnectionDetail } from "@/features/connections/lib/connection-types";
import type { ActionState } from "@/lib/ui/action-state";
import { idleActionState, isActionLoading } from "@/lib/ui/action-state";

type ConnectionDetailShellProps = {
  connection: SerializedConnectionDetail;
};

export function ConnectionDetailShell({
  connection
}: ConnectionDetailShellProps) {
  const router = useRouter();
  const [actionState, setActionState] = useState<ActionState>(idleActionState);
  const isBusy = isActionLoading(actionState);

  function endConnection() {
    if (isBusy || !connection.canEnd) {
      return;
    }

    void (async () => {
      setActionState({
        status: "loading",
        message: "Завершаем связь..."
      });

      const response = await fetch(`/api/connections/${connection.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "END" })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
          }
        | null;

      if (!response.ok) {
        setActionState({
          status: "error",
          message: payload?.message ?? "Не удалось завершить связь."
        });
        return;
      }

      setActionState({
        status: "success",
        message: "Связь завершена и останется в архиве."
      });
      router.refresh();
    })();
  }

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Активная связь</p>
          <h1 className="screen-title">{connection.title}</h1>
          <p className="screen-description">{connection.otherUserName}</p>
        </div>

        <div className="match-badge-row">
          <span className="status-pill">
            {scenarioLabelByValue[connection.scenario]}
          </span>
          <span
            className="tone-pill"
            data-tone={connection.status === "ACTIVE" ? "success" : "neutral"}
          >
            {connection.status === "ACTIVE" ? "Активна" : "Завершена"}
          </span>
        </div>
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Telegram handoff</p>
          <h2 className="card-title">
            {connection.canOpenTelegram && connection.telegramUrl
              ? "Написать в Telegram"
              : connection.canOpenTelegram
                ? "Username не найден"
                : "Связь уже не активна"}
          </h2>
          <p className="card-body-copy">
            {connection.canOpenTelegram && connection.telegramUrl
              ? "Откроем личный чат в Telegram."
              : connection.canOpenTelegram
                ? "Чтобы открыть личный чат, пользователю нужен username в Telegram."
                : "Контакт был доступен только в активной связи."}
          </p>
        </div>

        {connection.canOpenTelegram && !connection.telegramUrl ? (
          <div className="feedback-box">
            <p className="feedback-title">Username не найден</p>
            <p className="helper-text">
              Чтобы открыть личный чат, пользователю нужен username в Telegram.
            </p>
          </div>
        ) : null}

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
          {connection.canOpenTelegram && connection.telegramUrl ? (
            <a
              className={buttonClassName()}
              href={connection.telegramUrl}
              rel="noreferrer"
              target="_blank"
            >
              Написать в Telegram
            </a>
          ) : null}
          {connection.canOpenTelegram && !connection.telegramUrl ? (
            <Link
              className={buttonClassName({ variant: "secondary" })}
              href="/connections"
            >
              Понятно
            </Link>
          ) : null}
          {connection.canEnd ? (
            <Button
              disabled={isBusy}
              isLoading={isBusy}
              loadingLabel="Завершаем..."
              onClick={endConnection}
              variant="ghost"
            >
              Завершить связь
            </Button>
          ) : null}
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href="/connections"
          >
            К связям
          </Link>
        </div>
      </section>
    </section>
  );
}
