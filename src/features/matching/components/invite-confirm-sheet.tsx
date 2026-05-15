"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

const INVITE_MESSAGE_MAX_LENGTH = 300;
const DEFAULT_INVITE_MESSAGE = "Привет! Мне интересно подключиться.";

type InviteConfirmSheetProps = {
  isOpen: boolean;
  invite: {
    matchId: string;
    candidateName: string;
    requestTitle: string;
    requestType: string;
    role: string | null;
    format: string | null;
  } | null;
  onClose: () => void;
  onSuccess: (matchId: string) => void;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
};

export function InviteConfirmSheet({
  invite,
  isOpen,
  onClose,
  onSuccess
}: InviteConfirmSheetProps) {
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !invite) {
    return null;
  }

  const activeInvite = invite;
  const trimmedMessage = message.trim();

  function handleCancel() {
    if (isPending) {
      return;
    }

    setMessage("");
    setFeedback(null);
    onClose();
  }

  function handleSubmit() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/matches/${activeInvite.matchId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmedMessage || DEFAULT_INVITE_MESSAGE
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            interaction?: unknown;
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.interaction) {
        setFeedback({
          kind: "error",
          message:
            payload?.message ??
            "Не удалось отправить приглашение. Попробуйте ещё раз."
        });
        return;
      }

      setMessage("");
      setFeedback(null);
      onSuccess(activeInvite.matchId);
      onClose();
    });
  }

  return (
    <div className="bottom-sheet-backdrop" role="presentation">
      <div
        aria-labelledby="invite-sheet-title"
        aria-modal="true"
        className="bottom-sheet"
        role="dialog"
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="screen-copy">
          <p className="card-eyebrow">Подтверждение</p>
          <h2 className="card-title" id="invite-sheet-title">
            Пригласить {invite.candidateName}?
          </h2>
        </div>

        <div className="match-context-card">
          <p className="feedback-title">{invite.requestTitle}</p>
          <p className="helper-text">
            {[invite.requestType, invite.role, invite.format]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>

        <label className="field-stack">
          <span className="field-label">Сообщение</span>
          <textarea
            className="field-textarea"
            maxLength={INVITE_MESSAGE_MAX_LENGTH}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={DEFAULT_INVITE_MESSAGE}
            rows={4}
            value={message}
          />
          <span className="helper-text">
            {trimmedMessage.length}/{INVITE_MESSAGE_MAX_LENGTH}
          </span>
        </label>

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
            Отправить приглашение
          </Button>
          <Button disabled={isPending} onClick={handleCancel} variant="secondary">
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}
