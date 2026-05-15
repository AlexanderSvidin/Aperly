"use client";

import { useState } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import { RespondSheet } from "@/features/opportunities/components/respond-sheet";
import type { SerializedOpportunityDetail } from "@/features/opportunities/lib/opportunity-types";
import { formatRequestDate } from "@/features/requests/lib/request-options";

type OpportunityDetailShellProps = {
  opportunity: SerializedOpportunityDetail;
};

export function OpportunityDetailShell({
  opportunity
}: OpportunityDetailShellProps) {
  const router = useRouter();
  const [isRespondSheetOpen, setIsRespondSheetOpen] = useState(false);
  const [hasJustResponded, setHasJustResponded] = useState(false);
  const canRespond = opportunity.canRespond && !hasJustResponded;
  const passiveCtaLabel = hasJustResponded
    ? "Ждём ответ"
    : opportunity.isOwnRequest
      ? "Это ваш запрос"
      : !opportunity.isAvailable
        ? "Недоступно"
        : opportunity.responseState.status !== "NONE"
          ? opportunity.responseState.label
          : "Недоступно";

  function handleRespondSuccess() {
    setHasJustResponded(true);
    router.refresh();
  }

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <Link className={buttonClassName({ variant: "ghost" })} href="/opportunities">
          ←
        </Link>
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

        <Link
          className={buttonClassName({ variant: "secondary" })}
          href={`/users/${opportunity.author.userId}/preview` as Route}
        >
          Профиль автора
        </Link>
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Следующий шаг</p>
          <h2 className="card-title">Действие</h2>
          <p className="card-body-copy">
            Отклик отправится автору запроса. Активная связь появится только
            после принятия.
          </p>
        </div>

        {!canRespond && (hasJustResponded || opportunity.responseState.status !== "NONE") ? (
          <div className="feedback-box">
            <p className="feedback-title">{passiveCtaLabel}</p>
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

        <div className="card-actions-row card-actions-row-inline">
          {canRespond ? (
            <Button onClick={() => setIsRespondSheetOpen(true)}>
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
          {!canRespond && !opportunity.responseState.connectionId ? (
            <Button disabled variant="secondary">
              {passiveCtaLabel}
            </Button>
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
      <RespondSheet
        isOpen={isRespondSheetOpen}
        onClose={() => setIsRespondSheetOpen(false)}
        onSuccess={handleRespondSuccess}
        request={{
          id: opportunity.id,
          type: scenarioLabelByValue[opportunity.scenario],
          title: opportunity.title,
          meta: opportunity.meta,
          format: opportunity.format,
          time: null
        }}
      />
    </section>
  );
}
