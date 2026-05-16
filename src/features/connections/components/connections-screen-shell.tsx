"use client";

import { useMemo, useState } from "react";

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

function buildInteractionKind(interaction: SerializedInteractionSummary) {
  if (interaction.direction === "OUTGOING") {
    return interaction.type === "RESPONSE" ? "Мой отклик" : "Моё приглашение";
  }

  return interaction.type === "RESPONSE" ? "Входящий" : "Приглашение";
}

function InteractionCard({
  interaction
}: {
  interaction: SerializedInteractionSummary;
}) {
  const title =
    interaction.direction === "INCOMING"
      ? interaction.personName
      : interaction.title;
  const subtitle =
    interaction.direction === "INCOMING"
      ? interaction.title
      : interaction.personName;

  return (
    <article className="match-card connection-card">
      <div className="match-card-head">
        <div className="screen-copy">
          <div className="match-badge-row">
            <span className="status-pill">
              {buildInteractionKind(interaction)}
            </span>
            <span className="tone-pill" data-tone="warning">
              {buildInteractionLabel(interaction)}
            </span>
          </div>
          <h3 className="card-title">{title}</h3>
          <p className="card-body-copy">{subtitle}</p>
          <p className="helper-text">
            {scenarioLabelByValue[interaction.scenario]} ·{" "}
            {interaction.subtitle}
          </p>
        </div>
        {interaction.direction === "INCOMING" ? (
          <Link
            className={buttonClassName({ fullWidth: true })}
            href={buildIncomingHref(interaction)}
          >
            Ответить
          </Link>
        ) : null}
      </div>
      {interaction.message ? (
        <p className="card-body-copy">{interaction.message}</p>
      ) : null}
      <p className="helper-text">
        {interaction.expiresAt
          ? `Доступно до ${formatRequestDate(interaction.expiresAt)}`
          : `Создано ${formatRequestDate(interaction.createdAt)}`}
      </p>
    </article>
  );
}

function ConnectionCard({
  connection
}: {
  connection: SerializedConnectionSummary;
}) {
  return (
    <article className="match-card connection-card">
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
          className={buttonClassName({ fullWidth: true })}
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
  const visibleItems = useMemo(() => {
    const items: (
      | { id: string; type: "interaction"; value: SerializedInteractionSummary }
      | { id: string; type: "connection"; value: SerializedConnectionSummary }
    )[] = [];

    if (showIncoming) {
      items.push(
        ...initialData.incoming.map((value) => ({
          id: `incoming-${value.id}`,
          type: "interaction" as const,
          value
        }))
      );
    }

    if (showOutgoing) {
      items.push(
        ...initialData.outgoing.map((value) => ({
          id: `outgoing-${value.id}`,
          type: "interaction" as const,
          value
        }))
      );
    }

    if (showActive) {
      items.push(
        ...initialData.active.map((value) => ({
          id: `active-${value.id}`,
          type: "connection" as const,
          value
        }))
      );
    }

    return items;
  }, [initialData, showActive, showIncoming, showOutgoing]);

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <p className="screen-description">Люди и отклики</p>
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

      {visibleItems.length > 0 ? (
        <div className="match-list">
          {visibleItems.map((item) =>
            item.type === "interaction" ? (
              <InteractionCard interaction={item.value} key={item.id} />
            ) : (
              <ConnectionCard connection={item.value} key={item.id} />
            )
          )}
        </div>
      ) : (
        <section className="surface-card screen-stack">
          <EmptyState
            actionHref="/opportunities"
            actionLabel="Смотреть возможности"
            title="Здесь пока пусто"
            text="Откликнитесь на запрос или пригласите подходящего человека."
          />
        </section>
      )}
    </section>
  );
}
