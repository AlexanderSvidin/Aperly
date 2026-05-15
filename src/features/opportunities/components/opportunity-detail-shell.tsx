"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import type { SerializedOpportunityDetail } from "@/features/opportunities/lib/opportunity-types";
import { formatRequestDate } from "@/features/requests/lib/request-options";
import type { ActionState } from "@/lib/ui/action-state";
import { idleActionState, isActionLoading } from "@/lib/ui/action-state";

type OpportunityDetailShellProps = {
  opportunity: SerializedOpportunityDetail;
};

const RESPONSE_MESSAGE_MAX_LENGTH = 700;

export function OpportunityDetailShell({
  opportunity
}: OpportunityDetailShellProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [actionState, setActionState] = useState<ActionState>(idleActionState);

  const isBusy = isActionLoading(actionState);
  const trimmedMessage = message.trim();

  function handleRespond() {
    if (trimmedMessage.length < 10 || isBusy || !opportunity.canRespond) {
      return;
    }

    void (async () => {
      setActionState({
        status: "loading",
        message: "Отправляем отклик..."
      });

      const response = await fetch(
        `/api/opportunities/${opportunity.id}/responses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: trimmedMessage
          })
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            interaction?: unknown;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.interaction) {
        setActionState({
          status: "error",
          message:
            payload?.message ??
            "Не удалось отправить отклик. Проверьте запрос и попробуйте ещё раз."
        });
        return;
      }

      setActionState({
        status: "success",
        message:
          "Отклик отправлен. Он ждёт решения автора запроса во входящих связях."
      });
      setMessage("");
      router.refresh();
    })();
  }

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">
            {scenarioLabelByValue[opportunity.scenario]}
          </p>
          <h1 className="screen-title">{opportunity.title}</h1>
          <p className="screen-description">{opportunity.goal}</p>
        </div>

        <div className="chip-row">
          <span className="info-chip">{opportunity.meta}</span>
          {opportunity.format ? (
            <span className="info-chip">{opportunity.format}</span>
          ) : null}
          <span className="info-chip">
            Активно до {formatRequestDate(opportunity.expiresAt)}
          </span>
        </div>
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Автор</p>
          <h2 className="card-title">{opportunity.author.name}</h2>
          <p className="card-body-copy">
            {[opportunity.author.program, opportunity.author.courseYear
              ? `${opportunity.author.courseYear} курс`
              : null]
              .filter(Boolean)
              .join(", ") || "Профиль заполнен частично"}
          </p>
          {opportunity.author.bio ? (
            <p className="card-body-copy">{opportunity.author.bio}</p>
          ) : null}
        </div>

        <div className="chip-row">
          {opportunity.author.skills.slice(0, 6).map((skill) => (
            <span className="info-chip" key={skill}>
              {skill}
            </span>
          ))}
          {opportunity.author.subjects.slice(0, 4).map((subject) => (
            <span className="info-chip" key={subject}>
              {subject}
            </span>
          ))}
        </div>

        <p className="helper-text">
          Telegram контакт скрыт до взаимного согласия и активной связи.
        </p>
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Следующий шаг</p>
          <h2 className="card-title">Откликнуться на запрос</h2>
          <p className="card-body-copy">
            Напишите коротко, почему вы подходите и что предлагаете сделать
            дальше. После принятия отклика появится активная связь.
          </p>
        </div>

        {opportunity.canRespond ? (
          <label className="field-stack">
            <span className="field-label">Отклик</span>
            <textarea
              className="field-textarea"
              maxLength={RESPONSE_MESSAGE_MAX_LENGTH}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Например: могу закрыть роль аналитика, свободен вечером, готов созвониться в Telegram после подтверждения"
              rows={4}
              value={message}
            />
            <span className="helper-text">
              {trimmedMessage.length}/{RESPONSE_MESSAGE_MAX_LENGTH}
            </span>
          </label>
        ) : opportunity.responseState.status !== "NONE" ? (
          <div className="feedback-box">
            <p className="feedback-title">{opportunity.responseState.label}</p>
            <p className="helper-text">
              Статус отклика сохранён. После взаимного согласия здесь появится переход в связь.
            </p>
          </div>
        ) : (
          <div className="feedback-box">
            <p className="feedback-title">На этот запрос нельзя откликнуться.</p>
            <p className="helper-text">
              Он закрыт, истёк или принадлежит вашему аккаунту.
            </p>
          </div>
        )}

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
          {opportunity.canRespond ? (
            <Button
              disabled={trimmedMessage.length < 10 || isBusy}
              isLoading={isBusy}
              loadingLabel="Отправляем..."
              onClick={handleRespond}
            >
              Откликнуться
            </Button>
          ) : null}
          {opportunity.responseState.connectionId ? (
            <Link
              className={buttonClassName()}
              href={`/connections/${opportunity.responseState.connectionId}`}
            >
              {opportunity.responseState.label}
            </Link>
          ) : null}
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href="/opportunities"
          >
            К возможностям
          </Link>
          <Link className={buttonClassName({ variant: "ghost" })} href="/connections">
            Мои связи
          </Link>
        </div>
      </section>
    </section>
  );
}
