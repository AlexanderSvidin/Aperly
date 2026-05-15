"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import type {
  SerializedHomeFeedData,
  SerializedHomeOpportunity
} from "@/features/home/lib/home-types";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import { formatRequestDate } from "@/features/requests/lib/request-options";
import type { RequestScenario } from "@/features/requests/lib/request-schema";
import type { ActionState } from "@/lib/ui/action-state";
import { idleActionState, isActionLoading } from "@/lib/ui/action-state";

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
  { value: "CASE", label: "Кейсы" },
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
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(
    {}
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

  function getActionState(requestId: string) {
    return actionStates[requestId] ?? idleActionState;
  }

  function respondFromCard(opportunity: SerializedHomeOpportunity) {
    if (opportunity.responseState.status !== "NONE") {
      return;
    }

    void (async () => {
      setActionStates((current) => ({
        ...current,
        [opportunity.id]: {
          status: "loading",
          message: "Отправляем отклик..."
        }
      }));

      const response = await fetch(`/api/opportunities/${opportunity.id}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Хочу откликнуться на запрос: ${opportunity.title}.`
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
          }
        | null;

      setActionStates((current) => ({
        ...current,
        [opportunity.id]: response.ok
          ? {
              status: "success",
              message: "Отклик отправлен. Ждём ответ."
            }
          : {
              status: "error",
              message: payload?.message ?? "Не удалось отправить отклик."
            }
      }));

      if (response.ok) {
        router.refresh();
      }
    })();
  }

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
          {visibleOpportunities.map((opportunity) => {
            const actionState = getActionState(opportunity.id);
            const isBusy = isActionLoading(actionState);

            return (
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
              {opportunity.responseState.status === "NONE" ? (
                <Button
                  disabled={isBusy}
                  fullWidth
                  isLoading={isBusy}
                  loadingLabel="Отправляем..."
                  onClick={() => respondFromCard(opportunity)}
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
                  {opportunity.responseState.label}
                </Button>
              )}
              <Link
                className={buttonClassName({ fullWidth: true })}
                href={buildOpportunityHref(opportunity)}
              >
                Открыть запрос
              </Link>
            </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
