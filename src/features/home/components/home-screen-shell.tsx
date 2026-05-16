"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScenarioIconBadge } from "@/components/ui/scenario-icon";
import type {
  SerializedHomeFeedData,
  SerializedHomeOpportunity
} from "@/features/home/lib/home-types";
import { RespondSheet } from "@/features/opportunities/components/respond-sheet";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
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

  const preferredScenario = activeFilter === "ALL" ? undefined : activeFilter;

  function handleRespondSuccess(requestId: string) {
    setRespondedRequestIds((current) =>
      current.includes(requestId) ? current : [...current, requestId]
    );
    router.refresh();
  }

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <p className="screen-description">
          {showWelcomeSelector
            ? `Привет, ${viewerName}. Открытые запросы студентов уже здесь.`
            : "Открытые запросы студентов"}
        </p>
      </div>

      <div
        className="home-feed-tabs"
        role="tablist"
        aria-label="Фильтр возможностей"
      >
        {feedTabs.map((tab) => (
          <button
            key={tab.value}
            aria-selected={activeFilter === tab.value}
            className="filter-chip"
            data-selected={activeFilter === tab.value}
            onClick={() => setActiveFilter(tab.value)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

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
            const hasJustResponded = respondedRequestIds.includes(
              opportunity.id
            );
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
                  <div className="opportunity-card-head">
                    <span className="scenario-tag">
                      <ScenarioIconBadge
                        scenario={opportunity.scenario}
                        variant="inline"
                      />
                      {scenarioLabelByValue[opportunity.scenario]}
                    </span>
                  </div>

                  <div className="screen-copy">
                    <h2 className="opportunity-title">{opportunity.title}</h2>
                    <p className="opportunity-subtitle">{opportunity.goal}</p>
                  </div>

                  <div className="opportunity-meta-row">
                    {opportunity.time ? (
                      <span className="meta-chip">
                        <CalendarIcon /> {opportunity.time}
                      </span>
                    ) : opportunity.meta ? (
                      <span className="meta-chip">
                        <CalendarIcon /> {opportunity.meta}
                      </span>
                    ) : null}
                    {opportunity.format ? (
                      <span className="meta-chip-soft">
                        {opportunity.format}
                      </span>
                    ) : null}
                  </div>
                </Link>

                {isRespondable ? (
                  <Button
                    fullWidth
                    onClick={() => setSelectedOpportunity(opportunity)}
                  >
                    Откликнуться
                  </Button>
                ) : opportunity.responseState.connectionId ? (
                  <Link
                    className={buttonClassName({ fullWidth: true })}
                    href={
                      `/connections/${opportunity.responseState.connectionId}` as Route
                    }
                  >
                    {opportunity.responseState.label}
                  </Link>
                ) : (
                  <div className="opportunity-pending-state">
                    <Button disabled fullWidth variant="secondary">
                      {statusLabel}
                    </Button>
                    {statusLabel === "Ждём ответ" ? (
                      <p className="helper-text">Отклик отправлен</p>
                    ) : null}
                  </div>
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

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}
