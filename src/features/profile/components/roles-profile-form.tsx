"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { collaborationRoleOptions } from "@/features/requests/lib/request-options";
import { getUserErrorMessage } from "@/lib/ui/error-messages";

type RoleValue = (typeof collaborationRoleOptions)[number]["value"];

type RolesProfileFormProps = {
  initialRoles: RoleValue[];
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
};

export function RolesProfileForm({ initialRoles }: RolesProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [primaryRole, setPrimaryRole] = useState<RoleValue | "">(
    initialRoles[0] ?? ""
  );
  const [additionalRoles, setAdditionalRoles] = useState<RoleValue[]>(
    initialRoles.slice(1)
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  function toggleAdditional(role: RoleValue) {
    if (role === primaryRole) {
      return;
    }
    setAdditionalRoles((current) =>
      current.includes(role)
        ? current.filter((value) => value !== role)
        : [...current, role]
    );
  }

  function removeAdditional(role: RoleValue) {
    setAdditionalRoles((current) => current.filter((value) => value !== role));
  }

  function handlePrimaryChange(value: RoleValue | "") {
    setPrimaryRole(value);
    if (value) {
      setAdditionalRoles((current) =>
        current.filter((role) => role !== value)
      );
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setFeedback(null);
      const response = await fetch("/api/profile/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryRole: primaryRole || null,
          additionalRoles
        })
      });
      const result = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: getUserErrorMessage(
            result,
            "Не удалось сохранить роли. Попробуйте ещё раз."
          )
        });
        return;
      }
      setFeedback({ kind: "success", message: "Сохранено." });
    });
  }

  const labelByValue = Object.fromEntries(
    collaborationRoleOptions.map((option) => [option.value, option.label])
  );

  return (
    <section className="screen-stack">
      <Link className="back-link" href="/profile/edit" aria-label="Назад">
        ←
      </Link>
      <div className="screen-copy">
        <h1 className="page-title">Роли</h1>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
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

        <section className="surface-card screen-stack">
          <label className="field-stack">
            <span className="field-label">Основная роль</span>
            <select
              className="field-input field-select"
              value={primaryRole}
              onChange={(event) =>
                handlePrimaryChange(event.target.value as RoleValue | "")
              }
            >
              <option value="">Не указана</option>
              {collaborationRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="field-stack">
            <span className="field-label">Могу также</span>
            <div className="chip-row">
              {additionalRoles.map((role) => (
                <button
                  type="button"
                  key={role}
                  className="chip-pill"
                  onClick={() => removeAdditional(role)}
                >
                  <span>{labelByValue[role] ?? role}</span>
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <button
                type="button"
                className="chip-pill chip-pill-add"
                onClick={() => setIsPickerOpen(true)}
              >
                + Добавить
              </button>
            </div>
          </div>
        </section>

        <Button
          disabled={isPending}
          fullWidth
          isLoading={isPending}
          loadingLabel="Сохраняем..."
          type="submit"
        >
          Сохранить
        </Button>
      </form>

      {isPickerOpen ? (
        <div
          className="picker-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsPickerOpen(false)}
        >
          <div
            className="picker-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="picker-handle" aria-hidden="true" />
            <div className="picker-header">
              <h3 className="card-title">Добавить роль</h3>
              <button
                type="button"
                className="picker-close"
                onClick={() => setIsPickerOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="picker-body">
              <div className="toggle-grid">
                {collaborationRoleOptions
                  .filter((option) => option.value !== primaryRole)
                  .map((option) => {
                    const selected = additionalRoles.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="toggle-chip"
                        data-selected={selected}
                        onClick={() => toggleAdditional(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
              </div>
              <Button
                type="button"
                fullWidth
                onClick={() => setIsPickerOpen(false)}
              >
                Готово
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
