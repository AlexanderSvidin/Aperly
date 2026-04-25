"use client";

import { useState, useTransition } from "react";

import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  ModerationUserAction,
  SerializedAdminDashboardData
} from "@/features/admin/lib/admin-types";
import { useRouter } from "next/navigation";

type AdminScreenShellProps = {
  initialData: SerializedAdminDashboardData;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
};

const userStatusLabelByValue = {
  ACTIVE: "Активен",
  INACTIVE: "Отключен",
  BLOCKED: "Заблокирован",
  DELETED: "Удален"
} as const;

const userStatusToneByValue = {
  ACTIVE: "success",
  INACTIVE: "warning",
  BLOCKED: "warning",
  DELETED: "neutral"
} as const;

const reportStatusLabelByValue = {
  OPEN: "Открыт",
  IN_REVIEW: "В работе",
  RESOLVED: "Решен",
  DISMISSED: "Отклонен"
} as const;

const reportStatusToneByValue = {
  OPEN: "warning",
  IN_REVIEW: "warning",
  RESOLVED: "success",
  DISMISSED: "neutral"
} as const;

const actionLabelByValue = {
  BLOCK_USER: "Блокировка пользователя",
  DISABLE_USER: "Отключение пользователя",
  UNBLOCK_USER: "Разблокировка пользователя",
  RESOLVE_REPORT: "Решение репорта"
} as const;

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

export function AdminScreenShell({ initialData }: AdminScreenShellProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUserAction(userId: string, action: ModerationUserAction) {
    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "Не удалось обновить статус пользователя."
        });
        return;
      }

      setFeedback({
        kind: "success",
        message: "Статус пользователя обновлен."
      });
      router.refresh();
    });
  }

  function handleResolveReport(reportId: string) {
    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "Не удалось закрыть репорт."
        });
        return;
      }

      setFeedback({
        kind: "success",
        message: "Репорт переведен в resolved."
      });
      router.refresh();
    });
  }

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <h2 className="screen-title">Moderation</h2>
        <p className="screen-description">
          Базовая админская панель MVP: пользователи, запросы, репорты и журнал
          действий без отдельного backoffice.
        </p>
      </div>

      {feedback ? (
        <div
          className={
            feedback.kind === "error"
              ? "feedback-box error-box"
              : "feedback-box success-box"
          }
        >
          <p className="feedback-title">{feedback.message}</p>
        </div>
      ) : null}

      <div className="screen-grid">
        <Card eyebrow="Пользователи" title={String(initialData.overview.totalUsers)}>
          <p className="card-body-copy">Всего аккаунтов в системе.</p>
        </Card>
        <Card eyebrow="Блокировки" title={String(initialData.overview.blockedUsers)}>
          <p className="card-body-copy">Пользователи со статусом `BLOCKED`.</p>
        </Card>
        <Card eyebrow="Репорты" title={String(initialData.overview.openReports)}>
          <p className="card-body-copy">Открытые и требующие внимания кейсы.</p>
        </Card>
        <Card eyebrow="Запросы" title={String(initialData.overview.activeRequests)}>
          <p className="card-body-copy">Активные сценарии поиска в MVP.</p>
        </Card>
      </div>

      <Card eyebrow="Сигналы" title="Открытые репорты">
        {initialData.reports.length === 0 ? (
          <p className="card-body-copy">Открытых репортов сейчас нет.</p>
        ) : (
          <div className="dashboard-list">
            {initialData.reports.map((report) => (
              <div key={report.id} className="dashboard-row">
                <div className="dashboard-row-copy">
                  <div className="dashboard-row-head">
                    <strong>{report.reasonCode}</strong>
                    <span
                      className="tone-pill"
                      data-tone={reportStatusToneByValue[report.status]}
                    >
                      {reportStatusLabelByValue[report.status]}
                    </span>
                  </div>
                  <p className="helper-text">
                    От {report.reporterDisplayName}
                    {report.targetUserDisplayName
                      ? ` • на ${report.targetUserDisplayName}`
                      : ""}
                  </p>
                  {report.contextLabel ? (
                    <p className="helper-text">{report.contextLabel}</p>
                  ) : null}
                  {report.details ? (
                    <p className="card-body-copy">{report.details}</p>
                  ) : null}
                  <p className="helper-text">
                    Создан {formatDateTime(report.createdAt)}
                    {report.resolvedAt
                      ? ` • решен ${formatDateTime(report.resolvedAt)}`
                      : ""}
                  </p>
                </div>

                <div className="request-card-actions">
                  {report.status === "OPEN" || report.status === "IN_REVIEW" ? (
                    <Button
                      disabled={isPending}
                      onClick={() => handleResolveReport(report.id)}
                      variant="secondary"
                    >
                      Resolve
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card eyebrow="Пользователи" title="Moderation users">
        {initialData.users.length === 0 ? (
          <p className="card-body-copy">Пользователей для moderation не найдено.</p>
        ) : (
          <div className="dashboard-list">
            {initialData.users.map((user) => (
              <div key={user.id} className="dashboard-row">
                <div className="dashboard-row-copy">
                  <div className="dashboard-row-head">
                    <strong>{user.displayName}</strong>
                    <span
                      className="tone-pill"
                      data-tone={userStatusToneByValue[user.status]}
                    >
                      {userStatusLabelByValue[user.status]}
                    </span>
                  </div>
                  <p className="helper-text">
                    {user.role}
                    {user.username ? ` • @${user.username}` : ""}
                    {user.program ? ` • ${user.program}` : ""}
                  </p>
                  <p className="card-body-copy">
                    Активных запросов: {user.activeRequestCount} • открытых репортов
                    на пользователя: {user.openReportCount}
                  </p>
                  <p className="helper-text">
                    Создан {formatDateTime(user.createdAt)}
                    {user.blockedAt
                      ? ` • заблокирован ${formatDateTime(user.blockedAt)}`
                      : ""}
                  </p>
                </div>

                <div className="request-card-actions">
                  {user.status !== "BLOCKED" ? (
                    <button
                      className={buttonClassName({ variant: "secondary" })}
                      disabled={isPending}
                      onClick={() => handleUserAction(user.id, "BLOCK")}
                      type="button"
                    >
                      Заблокировать
                    </button>
                  ) : null}
                  {user.status !== "INACTIVE" ? (
                    <button
                      className={buttonClassName({ variant: "ghost" })}
                      disabled={isPending}
                      onClick={() => handleUserAction(user.id, "DISABLE")}
                      type="button"
                    >
                      Отключить
                    </button>
                  ) : null}
                  {user.status !== "ACTIVE" ? (
                    <button
                      className={buttonClassName({ variant: "ghost" })}
                      disabled={isPending}
                      onClick={() => handleUserAction(user.id, "UNBLOCK")}
                      type="button"
                    >
                      Вернуть доступ
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card eyebrow="Запросы" title="Последние сценарии">
        {initialData.requests.length === 0 ? (
          <p className="card-body-copy">Запросов для просмотра пока нет.</p>
        ) : (
          <div className="dashboard-list">
            {initialData.requests.map((request) => (
              <div key={request.id} className="dashboard-row">
                <div className="dashboard-row-copy">
                  <div className="dashboard-row-head">
                    <strong>{request.title}</strong>
                    <span className="status-pill">{request.scenario}</span>
                  </div>
                  <p className="helper-text">{request.ownerDisplayName}</p>
                  <p className="card-body-copy">
                    Статус: {request.status} • до {formatDateTime(request.expiresAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card eyebrow="Audit Log" title="Последние admin actions">
        {initialData.actions.length === 0 ? (
          <p className="card-body-copy">Журнал пока пуст.</p>
        ) : (
          <div className="dashboard-list">
            {initialData.actions.map((action) => (
              <div key={action.id} className="dashboard-row">
                <div className="dashboard-row-copy">
                  <div className="dashboard-row-head">
                    <strong>{actionLabelByValue[action.actionType]}</strong>
                    <span className="status-pill">{formatDateTime(action.createdAt)}</span>
                  </div>
                  <p className="helper-text">{action.adminDisplayName}</p>
                  <p className="card-body-copy">
                    {action.targetUserDisplayName ?? action.requestTitle ?? action.reportId}
                  </p>
                  {action.notes ? <p className="helper-text">{action.notes}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
