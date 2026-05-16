"use client";

import { useState } from "react";

import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import type {
  SerializedConnectionSummary,
  SerializedConnectionsScreenData,
  SerializedInteractionSummary
} from "@/features/connections/lib/connection-types";
import { formatRequestDate } from "@/features/requests/lib/request-options";

type ConnectionsScreenShellProps = {
  initialData: SerializedConnectionsScreenData;
};

type ConnectionFilter = "ALL" | "INCOMING" | "OUTGOING" | "ACTIVE";

const connectionFilters: { value: ConnectionFilter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "INCOMING", label: "Входящие" },
  { value: "OUTGOING", label: "Ожидают" },
  { value: "ACTIVE", label: "Активные" }
];

function buildIncomingHref(interaction: SerializedInteractionSummary) {
  const kind = interaction.type === "RESPONSE" ? "response" : "invitation";

  return `/connections/incoming/${kind}/${interaction.id}` as const;
}

function buildInteractionLabel(interaction: SerializedInteractionSummary) {
  if (interaction.direction === "OUTGOING") {
    return "Ждём ответ";
  }

  return interaction.type === "RESPONSE" ? "Входящий отклик" : "Вас пригласили";
}

function InteractionCard({ interaction }: { interaction: SerializedInteractionSummary }) {
  return (
    <article className="match-card">
      <div className="match-card-head">
        <div className="screen-copy">
          <div className="match-badge-row">
            <span className="status-pill">
              {scenarioLabelByValue[interaction.scenario]}
            </span>
            <span className="tone-pill" data-tone="warning">
              {buildInteractionLabel(interaction)}
            </span>
          </div>
          <h3 className="card-title">{interaction.title}</h3>
          <p className="card-body-copy">{interaction.subtitle}</p>
          <p className="helper-text">{interaction.personName}</p>
        </div>
        {interaction.direction === "INCOMING" ? (
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href={buildIncomingHref(interaction)}
          >
            Ответить
          </Link>
        ) : null}
      </div>
      <p className="card-body-copy">{interaction.message}</p>
      <p className="helper-text">
        {interaction.expiresAt
          ? `Доступно до ${formatRequestDate(interaction.expiresAt)}`
          : `Создано ${formatRequestDate(interaction.createdAt)}`}
      </p>
    </article>
  );
}

function ConnectionCard({ connection }: { connection: SerializedConnectionSummary }) {
  return (
    <article className="match-card">
      <div className="match-card-head">
        <div className="screen-copy">
          <div className="match-badge-row">
            <span className="status-pill">
              {scenarioLabelByValue[connection.scenario]}
            </span>
            <span
              className="tone-pill"
              data-tone={connection.status === "ACTIVE" ? "success" : "neutral"}
            >
              {connection.status === "ACTIVE" ? "Активная связь" : "Завершено"}
            </span>
          </div>
          <h3 className="card-title">{connection.title}</h3>
          <p className="card-body-copy">{connection.otherUserName}</p>
          <p className="helper-text">{connection.subtitle}</p>
        </div>
        <Link
          className={buttonClassName({ variant: "secondary" })}
          href={`/connections/${connection.id}`}
        >
          Открыть
        </Link>
      </div>
    </article>
  );
}

export function ConnectionsScreenShell({
  initialData
}: ConnectionsScreenShellProps) {
  const [activeFilter, setActiveFilter] = useState<ConnectionFilter>("ALL");
  const showIncoming = activeFilter === "ALL" || activeFilter === "INCOMING";
  const showOutgoing = activeFilter === "ALL" || activeFilter === "OUTGOING";
  const showActive = activeFilter === "ALL" || activeFilter === "ACTIVE";

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <h1 className="page-title">Люди и отклики</h1>
        <p className="screen-description">
          Здесь видны отклики и приглашения. Telegram откроется только после
          взаимного согласия.
        </p>
      </div>
      <div className="home-feed-tabs" role="tablist" aria-label="Фильтр связей">
        {connectionFilters.map((filter) => (
          <button
            key={filter.value}
            aria-selected={activeFilter === filter.value}
            className="filter-chip"
            data-selected={activeFilter === filter.value}
            onClick={() => setActiveFilter(filter.value)}
            role="tab"
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      {showIncoming ? (
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Нужно ответить</p>
          <h2 className="card-title">Входящие</h2>
        </div>
        {initialData.incoming.length > 0 ? (
          <div className="match-list">
            {initialData.incoming.map((interaction) => (
              <InteractionCard interaction={interaction} key={interaction.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Входящих пока нет"
            text="Новые отклики и приглашения появятся здесь."
          />
        )}
      </section>
      ) : null}

      {showOutgoing ? (
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Ждём решения</p>
          <h2 className="card-title">Ожидающие</h2>
        </div>
        {initialData.outgoing.length > 0 ? (
          <div className="match-list">
            {initialData.outgoing.map((interaction) => (
              <InteractionCard interaction={interaction} key={interaction.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Ожиданий пока нет"
            text="Отправленные отклики и приглашения появятся здесь."
          />
        )}
      </section>
      ) : null}

      {showActive ? (
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Можно перейти в Telegram</p>
          <h2 className="card-title">Активные</h2>
        </div>
        {initialData.active.length > 0 ? (
          <div className="match-list">
            {initialData.active.map((connection) => (
              <ConnectionCard connection={connection} key={connection.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            actionHref="/opportunities"
            actionLabel="Смотреть возможности"
            title="Связей пока нет"
            text="Откликнитесь на запрос или пригласите подходящего человека."
          />
        )}
      </section>
      ) : null}

    </section>
  );
}

