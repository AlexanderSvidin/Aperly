"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  SerializedHomeFeedData,
  SerializedHomeOpportunity
} from "@/features/home/lib/home-types";
import { RespondSheet } from "@/features/opportunities/components/respond-sheet";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import { formatRequestDate } from "@/features/requests/lib/request-options";
import type { RequestScenario } from "@/features/requests/lib/request-schema";

type HomeScreenShellProps = {
  initialData: SerializedHomeFeedData;
  showWelcomeSelector?: boolean;
  viewerName: string;
};

type FeedFilter = RequestScenario | "ALL";

const feedTabs: { value: FeedFilter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "STUDY", label: "Учёба" },
  { value: "CASE", label: "Команда" },
  { value: "PROJECT", label: "Проект" },
  { value: "ACTIVITY", label: "Активность" }
];

function buildCreateHref(scenario?: RequestScenario): Route {
  return (scenario ? `/create?scenario=${scenario}` : "/create") as Route;
}

function buildOpportunityHref(opportunity: SerializedHomeOpportunity): Route {
  return `/opportunities/${opportunity.id}` as Route;
}

function formatAuthorMeta(opportunity: SerializedHomeOpportunity) {
  const parts = [
    opportunity.author.program,
    opportunity.author.courseYear ? `${opportunity.author.courseYear} курс` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Профиль заполнен частично";
}

export function HomeScreenShell({
  initialData,
  showWelcomeSelector = false,
  viewerName
}: HomeScreenShellProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FeedFilter>(
    initialData.selectedScenario
  );
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<SerializedHomeOpportunity | null>(null);
  const [respondedRequestIds, setRespondedRequestIds] = useState<string[]>([]);

  const visibleOpportunities = useMemo(
    () =>
      activeFilter === "ALL"
        ? initialData.opportunities
        : initialData.opportunities.filter(
            (opportunity) => opportunity.scenario === activeFilter
          ),
    [activeFilter, initialData.opportunities]
  );

  const preferredScenario =
    activeFilter === "ALL" ? undefined : activeFilter;

  function handleRespondSuccess(requestId: string) {
    setRespondedRequestIds((current) =>
      current.includes(requestId) ? current : [...current, requestId]
    );
    router.refresh();
  }

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Aperly | Возможности</p>
          <h1 className="screen-title">Возможности</h1>
          <p className="screen-description">
            {showWelcomeSelector
              ? `Привет, ${viewerName}. Открытые запросы студентов уже здесь.`
              : "Открытые запросы студентов"}
          </p>
        </div>

        <div className="home-feed-tabs" role="tablist" aria-label="Фильтр возможностей">
          {feedTabs.map((tab) => (
            <button
              key={tab.value}
              aria-selected={activeFilter === tab.value}
              className="toggle-chip"
              data-selected={activeFilter === tab.value}
              onClick={() => setActiveFilter(tab.value)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {visibleOpportunities.length === 0 ? (
        <section className="surface-card screen-stack">
          <EmptyState
            actionHref={buildCreateHref(preferredScenario)}
            actionLabel="Создать запрос"
            title="Пока нет открытых возможностей"
            text="Создайте свой запрос или вернитесь позже."
          />
        </section>
      ) : (
        <div className="opportunity-list">
          {visibleOpportunities.map((opportunity) => {
            const hasJustResponded = respondedRequestIds.includes(opportunity.id);
            const isRespondable =
              opportunity.responseState.status === "NONE" && !hasJustResponded;
            const statusLabel = hasJustResponded
              ? "Ждём ответ"
              : opportunity.responseState.label;

            return (
            <article key={opportunity.id} className="opportunity-card">
              <Link
                aria-label={`Открыть запрос ${opportunity.title}`}
                className="opportunity-card-main"
                href={buildOpportunityHref(opportunity)}
              >
                <div className="match-badge-row">
                  <span className="status-pill">
                    {scenarioLabelByValue[opportunity.scenario]}
                  </span>
                  <span className="tone-pill" data-tone="success">
                    {opportunity.trustInfo}
                  </span>
                </div>

                <div className="screen-copy">
                  <h2 className="card-title">{opportunity.title}</h2>
                  <p className="card-body-copy">{opportunity.goal}</p>
                </div>

                <div className="chip-row">
                  <span className="info-chip">{opportunity.meta}</span>
                  {opportunity.format ? (
                    <span className="info-chip">{opportunity.format}</span>
                  ) : null}
                  {opportunity.time ? (
                    <span className="info-chip">{opportunity.time}</span>
                  ) : null}
                </div>

                <div className="opportunity-author">
                  <strong>{opportunity.author.name}</strong>
                  <span>{formatAuthorMeta(opportunity)}</span>
                </div>

                <p className="helper-text">{opportunity.relevanceReason}</p>
                <p className="helper-text">
                  Активно до {formatRequestDate(opportunity.expiresAt)}
                </p>
              </Link>

              {isRespondable ? (
                <Button
                  fullWidth
                  onClick={() => setSelectedOpportunity(opportunity)}
                >
                  {opportunity.responseState.label}
                </Button>
              ) : opportunity.responseState.connectionId ? (
                <Link
                  className={buttonClassName({ fullWidth: true })}
                  href={`/connections/${opportunity.responseState.connectionId}` as Route}
                >
                  {opportunity.responseState.label}
                </Link>
              ) : (
                <Button disabled fullWidth variant="secondary">
                  {statusLabel}
                </Button>
              )}
            </article>
            );
          })}
        </div>
      )}
      <RespondSheet
        isOpen={Boolean(selectedOpportunity)}
        onClose={() => setSelectedOpportunity(null)}
        onSuccess={handleRespondSuccess}
        request={
          selectedOpportunity
            ? {
                id: selectedOpportunity.id,
                type: scenarioLabelByValue[selectedOpportunity.scenario],
                title: selectedOpportunity.title,
                meta: selectedOpportunity.meta,
                format: selectedOpportunity.format,
                time: selectedOpportunity.time
              }
            : null
        }
      />
    </section>
  );
}
