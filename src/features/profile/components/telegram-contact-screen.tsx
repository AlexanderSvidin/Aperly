"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type TelegramContactScreenProps = {
  username: string | null;
};

type FeedbackState = {
  kind: "success" | "error";
  message: string;
};

export function TelegramContactScreen({ username }: TelegramContactScreenProps) {
  const hasUsername = Boolean(username);
  const [isVisible, setIsVisible] = useState<boolean>(hasUsername);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const telegramLink = hasUsername ? `https://t.me/${username}` : null;

  function handleCheckLink() {
    if (!telegramLink) {
      return;
    }
    window.open(telegramLink, "_blank", "noopener,noreferrer");
  }

  function handleOpenTelegramSettings() {
    window.open("https://t.me/settings", "_blank", "noopener,noreferrer");
  }

  function handleSave() {
    setIsSaving(true);
    setFeedback(null);
    window.setTimeout(() => {
      setIsSaving(false);
      setFeedback({ kind: "success", message: "Настройки сохранены." });
    }, 300);
  }

  return (
    <section className="screen-stack">
      <Link className="back-link" href="/profile/edit" aria-label="Назад">
        ←
      </Link>

      <div className="screen-copy">
        <h1 className="page-title">Telegram-контакт</h1>
      </div>

      <section className="surface-card screen-stack telegram-contact-card">
        <div className="telegram-contact-block">
          <p className="card-eyebrow">Telegram</p>
          {hasUsername ? (
            <>
              <p className="telegram-username">@{username}</p>
              <p className="telegram-status telegram-status-connected">
                Подключён
              </p>
            </>
          ) : (
            <>
              <p className="telegram-username telegram-username-empty">
                Username не найден
              </p>
              <p className="helper-text">
                Добавьте username в настройках Telegram, чтобы другие могли
                написать вам после принятия связи.
              </p>
            </>
          )}
        </div>

        <label className="switch-row">
          <span className="switch-row-label">
            Показывать после принятия связи
          </span>
          <span className="switch-control">
            <input
              type="checkbox"
              checked={isVisible}
              disabled={!hasUsername}
              onChange={(event) => setIsVisible(event.target.checked)}
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
          </span>
        </label>

        <p className="helper-text">
          Ваш Telegram будет доступен только после взаимного согласия.
        </p>

        <div className="telegram-actions">
          <button
            type="button"
            className="telegram-action-row"
            onClick={handleCheckLink}
            disabled={!hasUsername}
          >
            <span>Проверить ссылку</span>
            <span aria-hidden="true">›</span>
          </button>
          <button
            type="button"
            className="telegram-action-row"
            onClick={handleOpenTelegramSettings}
          >
            <span>Изменить в Telegram</span>
            <span aria-hidden="true">›</span>
          </button>
        </div>

        {feedback ? (
          <div
            className={
              feedback.kind === "success"
                ? "feedback-box success-box"
                : "feedback-box error-box"
            }
          >
            <p className="feedback-title">{feedback.message}</p>
          </div>
        ) : null}

        <Button
          fullWidth
          type="button"
          onClick={handleSave}
          isLoading={isSaving}
          loadingLabel="Сохраняем..."
        >
          Сохранить
        </Button>
      </section>
    </section>
  );
}
