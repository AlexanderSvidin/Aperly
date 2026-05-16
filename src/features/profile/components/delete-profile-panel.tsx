"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type DeleteProfileResponse = {
  redirectTo?: string;
};

export function DeleteProfilePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      setErrorMessage(null);

      const response = await fetch("/api/profile", {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setErrorMessage(payload?.message ?? "Не удалось удалить профиль.");
        return;
      }

      const payload = (await response
        .json()
        .catch(() => null)) as DeleteProfileResponse | null;

      window.location.assign(payload?.redirectTo ?? "/onboarding");
    });
  }

  return (
    <section className="surface-card screen-stack">
      <div className="card-header">
        <p className="card-eyebrow">Настройки</p>
        <h2 className="card-title">Удалить профиль</h2>
      </div>
      <p className="card-body-copy">
        Профиль будет скрыт из поиска, активные запросы уйдут в архив, а вы
        сможете заполнить анкету заново.
      </p>

      {isOpen ? (
        <div className="match-context-card screen-stack">
          <p className="feedback-title">Подтвердите удаление</p>
          <p className="helper-text">
            Данные для модерации и безопасности могут сохраниться в обезличенном
            виде.
          </p>
          {errorMessage ? (
            <div className="feedback-box error-box">
              <p className="feedback-title">{errorMessage}</p>
            </div>
          ) : null}
          <div className="card-actions-row card-actions-row-inline">
            <Button
              disabled={isPending}
              isLoading={isPending}
              loadingLabel="Удаляем..."
              onClick={handleDelete}
              variant="ghost"
            >
              Удалить профиль
            </Button>
            <Button
              disabled={isPending}
              onClick={() => setIsOpen(false)}
              variant="secondary"
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setIsOpen(true)} variant="ghost">
          Удалить профиль
        </Button>
      )}
    </section>
  );
}
