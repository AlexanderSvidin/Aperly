"use client";

import { useMemo, useState, useTransition } from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button, buttonClassName } from "@/components/ui/button";
import {
  commitmentOptions,
  formatRequestDate,
  preferredTimeOptions,
  projectStageOptions,
  requestStatusLabels,
  requestStatusTone,
  studyFrequencyOptions
} from "@/features/requests/lib/request-options";
import type { SerializedRequest } from "@/features/requests/lib/request-schema";
import { getUserErrorMessage } from "@/lib/ui/error-messages";

type ProfileRequestsScreenProps = {
  initialRequests: SerializedRequest[];
};

type RequestFilter = "ACTIVE" | "CLOSED" | "EXPIRED";

const filters: { value: RequestFilter; label: string }[] = [
  { value: "ACTIVE", label: "Активные" },
  { value: "CLOSED", label: "Закрытые" },
  { value: "EXPIRED", label: "Истёкшие" }
];

const projectStageLabelByValue = Object.fromEntries(
  projectStageOptions.map((option) => [option.value, option.label])
) as Record<(typeof projectStageOptions)[number]["value"], string>;

const commitmentLabelByValue = Object.fromEntries(
  commitmentOptions.map((option) => [option.value, option.label])
) as Record<(typeof commitmentOptions)[number]["value"], string>;

const studyFrequencyLabelByValue = Object.fromEntries(
  studyFrequencyOptions.map((option) => [option.value, option.label])
) as Record<(typeof studyFrequencyOptions)[number]["value"], string>;

const preferredTimeLabelByValue = Object.fromEntries(
  preferredTimeOptions.map((option) => [option.value, option.label])
) as Record<(typeof preferredTimeOptions)[number]["value"], string>;

function getRequestTitle(request: SerializedRequest) {
  if (request.details.type === "CASE") {
    return request.details.eventName;
  }

  if (request.details.type === "PROJECT") {
    return request.details.projectTitle;
  }

  if (request.details.type === "ACTIVITY") {
    return request.details.title;
  }

  return request.details.subjects.length > 0
    ? request.details.subjects.map((subject) => subject.name).join(", ")
    : request.details.subjectName;
}

function getRequestSubtitle(request: SerializedRequest) {
  if (request.details.type === "PROJECT") {
    return `${
      projectStageLabelByValue[request.details.stage] ?? request.details.stage
    } • ${
      commitmentLabelByValue[request.details.expectedCommitment] ??
      request.details.expectedCommitment
    }`;
  }

  if (request.details.type === "STUDY") {
    return `${
      studyFrequencyLabelByValue[request.details.desiredFrequency] ??
      request.details.desiredFrequency
    } • ${
      preferredTimeLabelByValue[request.details.preferredTime] ??
      request.details.preferredTime
    }`;
  }

  if (request.details.type === "CASE") {
    return request.details.neededRoles.length > 0
      ? `Роли: ${request.details.neededRoles.join(", ")}`
      : "Командный запрос";
  }

  return request.details.comment ?? "Активность";
}

function filterRequests(requests: SerializedRequest[], filter: RequestFilter) {
  if (filter === "ACTIVE") {
    return requests.filter((request) => request.status === "ACTIVE");
  }

  if (filter === "CLOSED") {
    return requests.filter((request) =>
      ["CLOSED", "ARCHIVED"].includes(request.status)
    );
  }

  return requests.filter((request) => request.status === "EXPIRED");
}

export function ProfileRequestsScreen({
  initialRequests
}: ProfileRequestsScreenProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [activeFilter, setActiveFilter] = useState<RequestFilter>("ACTIVE");
  const [requestToClose, setRequestToClose] = useState<SerializedRequest | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleRequests = useMemo(
    () => filterRequests(requests, activeFilter),
    [activeFilter, requests]
  );

  function closeRequest() {
    if (!requestToClose || isPending) {
      return;
    }

    startTransition(async () => {
      setErrorMessage(null);

      const response = await fetch(`/api/requests/${requestToClose.id}/close`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            code?: string;
            request?: SerializedRequest;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.request) {
        setErrorMessage(
          getUserErrorMessage(
            payload,
            "Не удалось закрыть запрос. Попробуйте ещё раз."
          )
        );
        return;
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === payload.request?.id ? payload.request : request
        )
      );
      setRequestToClose(null);
      router.refresh();
    });
  }

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <Link className={buttonClassName({ variant: "ghost" })} href="/profile">
          ←
        </Link>
        <div className="screen-copy">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="screen-title">Мои запросы</h1>
        </div>
        <div className="home-feed-tabs" role="tablist" aria-label="Фильтр запросов">
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
        <Link className={buttonClassName({ fullWidth: true })} href="/create">
          Создать новый
        </Link>
      </section>

      {visibleRequests.length > 0 ? (
        <div className="match-list">
          {visibleRequests.map((request) => (
            <article className="match-card" key={request.id}>
              <div className="match-card-head">
                <div className="screen-copy">
                  <div className="match-badge-row">
                    <span
                      className="tone-pill"
                      data-tone={requestStatusTone[request.status]}
                    >
                      {requestStatusLabels[request.status]}
                    </span>
                    <span className="status-pill">
                      до {formatRequestDate(request.expiresAt)}
                    </span>
                  </div>
                  <h2 className="card-title">{getRequestTitle(request)}</h2>
                  <p className="card-body-copy">{getRequestSubtitle(request)}</p>
                </div>
              </div>

              <div className="card-actions-row card-actions-row-inline">
                <Link
                  className={buttonClassName({ variant: "secondary" })}
                  href={`/requests/${request.id}/matches` as Route}
                >
                  Открыть
                </Link>
                {request.status === "ACTIVE" ? (
                  <>
                    <Link
                      className={buttonClassName({ variant: "ghost" })}
                      href={`/requests/${request.id}/edit` as Route}
                    >
                      Изменить
                    </Link>
                    <Button
                      onClick={() => setRequestToClose(request)}
                      variant="ghost"
                    >
                      Закрыть набор
                    </Button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="surface-card screen-stack">
          <div className="feedback-box">
            <p className="feedback-title">Запросов в этом разделе пока нет.</p>
          </div>
        </section>
      )}

      {requestToClose ? (
        <div className="bottom-sheet-backdrop" role="presentation">
          <div
            aria-labelledby="close-request-title"
            aria-modal="true"
            className="confirm-modal"
            role="dialog"
          >
            <div className="screen-copy">
              <h2 className="card-title" id="close-request-title">
                Закрыть запрос?
              </h2>
              <p className="card-body-copy">
                Новые отклики будут невозможны. Активные связи сохранятся.
              </p>
            </div>
            {errorMessage ? (
              <div className="feedback-box error-box">
                <p className="feedback-title">{errorMessage}</p>
              </div>
            ) : null}
            <div className="card-actions-row card-actions-row-inline">
              <Button
                disabled={isPending}
                isLoading={isPending}
                loadingLabel="Закрываем..."
                onClick={closeRequest}
              >
                Закрыть запрос
              </Button>
              <Button
                disabled={isPending}
                onClick={() => setRequestToClose(null)}
                variant="secondary"
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
