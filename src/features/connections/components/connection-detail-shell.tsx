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
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

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
      <section className="surface-card connection-hero-card">
        <div className="screen-copy">
          <p className="card-eyebrow">
            {scenarioLabelByValue[connection.scenario]}
          </p>
          <h1 className="screen-title">{connection.otherUserName}</h1>
          <p className="screen-description">{connection.title}</p>
          <p className="card-body-copy">{connection.subtitle}</p>
        </div>

        <span className="connection-active-status">
          {connection.status === "ACTIVE" ? "Связь активна" : "Связь завершена"}
        </span>

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

        <div className="connection-actions">
          {connection.canOpenTelegram && connection.telegramUrl ? (
            <a
              className={buttonClassName({ fullWidth: true })}
              href={connection.telegramUrl}
              rel="noreferrer"
              target="_blank"
            >
              Написать в Telegram
            </a>
          ) : null}
          {connection.canOpenTelegram && connection.telegramUrl ? (
            <p className="connection-telegram-caption">
              Откроем личный чат в Telegram
            </p>
          ) : null}
          {connection.canOpenTelegram && !connection.telegramUrl ? (
            <Link
              className={buttonClassName({
                fullWidth: true,
                variant: "secondary"
              })}
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
        </div>
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Мой запрос</p>
          <p className="card-body-copy">{connection.title}</p>
          <p className="card-body-copy">{connection.subtitle}</p>
        </div>
      </section>
    </section>
  );
}
