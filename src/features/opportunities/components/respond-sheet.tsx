"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getUserErrorMessage } from "@/lib/ui/error-messages";

const DEFAULT_RESPONSE_MESSAGE = "Привет! Мне интересно подключиться.";

const quickPhrases = [
  "Привет! Мне интересно",
  "Могу подключиться",
  "Тоже готовлюсь",
  "Готов обсудить"
];

type RespondSheetProps = {
  isOpen: boolean;
  request: {
    id: string;
    type: string;
    title: string;
    meta: string;
    format: string | null;
    time: string | null;
  } | null;
  onClose: () => void;
  onSuccess: (requestId: string) => void;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
};

export function RespondSheet({
  isOpen,
  onClose,
  onSuccess,
  request
}: RespondSheetProps) {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !request) {
    return null;
  }

  const trimmedMessage = message.trim();

  function addQuickPhrase(phrase: string) {
    setMessage((current) => {
      const next = current.trim() ? `${current.trim()} ${phrase}` : phrase;

      return next;
    });
  }

  function handleCancel() {
    if (isPending) {
      return;
    }

    setMessage("");
    setFeedback(null);
    onClose();
  }

  function handleSubmit() {
    if (isPending || !request) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/opportunities/${request.id}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmedMessage || DEFAULT_RESPONSE_MESSAGE
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            code?: string;
            interaction?: unknown;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.interaction) {
        setFeedback({
          kind: "error",
          message: getUserErrorMessage(
            payload,
            "Не удалось отправить отклик. Попробуйте ещё раз."
          )
        });
        return;
      }

      setMessage("");
      setFeedback(null);
      onSuccess(request.id);
      onClose();
    });
  }

  return (
    <div className="bottom-sheet-backdrop" role="presentation">
      <div
        aria-labelledby="respond-sheet-title"
        aria-modal="true"
        className="bottom-sheet"
        role="dialog"
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="screen-copy">
          <p className="card-eyebrow">{request.type}</p>
          <h2 className="card-title" id="respond-sheet-title">
            Откликнуться
          </h2>
        </div>

        <div className="match-context-card">
          <p className="feedback-title">{request.title}</p>
          <p className="helper-text">
            {[request.meta, request.format, request.time].filter(Boolean).join(" • ")}
          </p>
        </div>

        <label className="field-stack">
          <span className="field-label">Сообщение</span>
          <textarea
            className="field-textarea"
            onChange={(event) => setMessage(event.target.value)}
            placeholder={DEFAULT_RESPONSE_MESSAGE}
            rows={4}
            value={message}
          />
          <span className="helper-text">
            {trimmedMessage.length} символов
          </span>
        </label>

        <div className="chip-row" aria-label="Быстрые фразы">
          {quickPhrases.map((phrase) => (
            <button
              className="toggle-chip"
              key={phrase}
              onClick={() => addQuickPhrase(phrase)}
              type="button"
            >
              {phrase}
            </button>
          ))}
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

        <div className="card-actions-row card-actions-row-inline">
          <Button
            disabled={isPending}
            isLoading={isPending}
            loadingLabel="Отправляем..."
            onClick={handleSubmit}
          >
            Отправить отклик
          </Button>
          <Button disabled={isPending} onClick={handleCancel} variant="secondary">
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}
