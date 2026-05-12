"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import type { Route } from "next";

import { buttonClassName } from "@/components/ui/button";
import type {
  SerializedHomeFeedData,
  SerializedHomeOpportunity
} from "@/features/home/lib/home-types";
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
  { value: "PROJECT", label: "Проекты" },
  { value: "CASE", label: "Кейсы" }
];

function buildCreateHref(scenario?: RequestScenario): Route {
  return (scenario ? `/requests/new?scenario=${scenario}` : "/requests/new") as Route;
}

function buildOpportunityHref(opportunity: SerializedHomeOpportunity): Route {
  return opportunity.ctaHref as Route;
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
  const [activeFilter, setActiveFilter] = useState<FeedFilter>(
    initialData.selectedScenario
  );

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

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Главная</p>
          <h1 className="screen-title">Открытые возможности</h1>
          <p className="screen-description">
            {showWelcomeSelector
              ? `Привет, ${viewerName}. Посмотрите, кто уже ищет команду, проектного партнёра или StudyBuddy.`
              : "Здесь видны активные запросы других студентов. Чтобы откликнуться, создайте свой запрос в похожем сценарии."}
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
          <div className="screen-copy">
            <p className="card-eyebrow">Пока тихо</p>
            <h2 className="card-title">Нет открытых запросов</h2>
            <p className="card-body-copy">
              Пока нет открытых запросов. Создайте свой — и другие смогут
              откликнуться.
            </p>
          </div>
          <Link
            className={buttonClassName({ fullWidth: true })}
            href={buildCreateHref(preferredScenario)}
          >
            Создать запрос
          </Link>
        </section>
      ) : (
        <div className="opportunity-list">
          {visibleOpportunities.map((opportunity) => (
            <article key={opportunity.id} className="opportunity-card">
              <div className="opportunity-card-main">
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
              </div>

              <Link
                className={buttonClassName({ fullWidth: true })}
                href={buildOpportunityHref(opportunity)}
              >
                {opportunity.ctaLabel}
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
