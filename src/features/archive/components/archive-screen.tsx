"use client";

import { useState } from "react";

import Link from "next/link";
import type { Route } from "next";

import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  ArchiveFilter,
  SerializedArchiveCard,
  SerializedArchiveData
} from "@/features/archive/lib/archive-types";
import { formatRequestDate } from "@/features/requests/lib/request-options";

type ArchiveScreenProps = {
  initialData: SerializedArchiveData;
};

const filters: { value: ArchiveFilter; label: string }[] = [
  { value: "CONNECTIONS", label: "Связи" },
  { value: "REQUESTS", label: "Запросы" },
  { value: "DECLINED", label: "Отклонённые" }
];

function getItems(data: SerializedArchiveData, filter: ArchiveFilter) {
  if (filter === "CONNECTIONS") {
    return data.connections;
  }

  if (filter === "REQUESTS") {
    return data.requests;
  }

  return data.declined;
}

function ArchiveCard({ item }: { item: SerializedArchiveCard }) {
  return (
    <article className="match-card">
      <div className="match-card-head">
        <div className="screen-copy">
          <div className="match-badge-row">
            <span className="status-pill">{item.type}</span>
            <span className="tone-pill">{item.status}</span>
          </div>
          <h2 className="card-title">{item.title}</h2>
          <p className="helper-text">{formatRequestDate(item.date)}</p>
        </div>
        {item.href && item.actionLabel ? (
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href={item.href as Route}
          >
            {item.actionLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function EmptyArchive() {
  return (
    <EmptyState
      title="Здесь пока пусто"
      text="Завершённые связи и закрытые запросы появятся здесь."
    />
  );
}

export function ArchiveScreen({ initialData }: ArchiveScreenProps) {
  const [activeFilter, setActiveFilter] = useState<ArchiveFilter>("CONNECTIONS");
  const items = getItems(initialData, activeFilter);

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <Link className={buttonClassName({ variant: "ghost" })} href="/profile">
          ←
        </Link>
        <div className="screen-copy">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="screen-title">Архив</h1>
        </div>

        <div className="home-feed-tabs" role="tablist" aria-label="Фильтр архива">
          {filters.map((filter) => (
            <button
              key={filter.value}
              aria-selected={activeFilter === filter.value}
              className="toggle-chip"
              data-selected={activeFilter === filter.value}
              onClick={() => setActiveFilter(filter.value)}
              role="tab"
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {items.length > 0 ? (
        <div className="match-list">
          {items.map((item) => (
            <ArchiveCard item={item} key={`${activeFilter}:${item.id}`} />
          ))}
        </div>
      ) : (
        <section className="surface-card screen-stack">
          <EmptyArchive />
        </section>
      )}
    </section>
  );
}
