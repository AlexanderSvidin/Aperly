"use client";

import {
  type FormEvent,
  useEffect,
  useEffectEvent,
  useState,
  useTransition
} from "react";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { buttonClassName, Button } from "@/components/ui/button";
import {
  chatScenarioLabels,
  chatStatusLabels,
  chatStatusTone,
  contactExchangeStatusLabels,
  staleStatusLabels
} from "@/features/chat/lib/chat-options";
import { formatOptions } from "@/features/profile/lib/profile-options";
import type {
  ScheduleSessionInput,
  SerializedStudyChatPanel,
  SessionAction
} from "@/features/study-sessions/lib/study-session-types";
import type {
  ContactExchangeResult,
  ContactExchangeState,
  SerializedChatListItem,
  SerializedChatMetadata,
  SerializedChatMessages,
  SerializedChatScreenData,
  SerializedMessage,
  SentMessageResult
} from "@/features/chat/lib/chat-types";

type ChatsScreenShellProps = {
  initialData: SerializedChatScreenData;
  viewerUserId: string;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
};

type StudyFormMode = "FIRST" | "RESCHEDULE" | "NEXT" | null;

const formatLabelByValue = Object.fromEntries(
  formatOptions.map((option) => [option.value, option.label])
) as Record<(typeof formatOptions)[number]["value"], string>;

const studySessionStatusLabels = {
  PROPOSED: "Нуждается в подтверждении",
  CONFIRMED: "Подтверждена",
  COMPLETED: "Проведена",
  CANCELLED: "Отменена",
  MISSED: "Пропущена"
} as const;

const studySessionStatusTone = {
  PROPOSED: "warning",
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
  MISSED: "warning"
} as const;

function buildChatsHref(chatId?: string | null): Route {
  const searchParams = new URLSearchParams();

  if (chatId) {
    searchParams.set("chatId", chatId);
  }

  const queryString = searchParams.toString();

  return (queryString ? `/chats?${queryString}` : "/chats") as Route;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "без активности";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toLocalDateTimeInputValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function buildStudyDraft(panel: SerializedStudyChatPanel | null): ScheduleSessionInput & {
  scheduledAt: string;
} {
  const sourceDate = panel?.latestSession?.scheduledFor
    ? new Date(panel.latestSession.scheduledFor)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (panel?.latestSession?.status === "COMPLETED") {
    sourceDate.setDate(sourceDate.getDate() + 7);
  }

  return {
    scheduledAt: toLocalDateTimeInputValue(sourceDate.toISOString()),
    format: panel?.latestSession?.format ?? "ONLINE",
    notes: panel?.latestSession?.notes ?? ""
  };
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
}

function isSentMessagePayload(payload: unknown): payload is SentMessageResult {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "message" in payload &&
      payload.message &&
      typeof payload.message === "object" &&
      "id" in payload.message
  );
}

function mergeMessages(
  existing: SerializedMessage[],
  incoming: SerializedMessage[]
) {
  const uniqueMessages = new Map<string, SerializedMessage>();

  for (const message of [...existing, ...incoming]) {
    uniqueMessages.set(message.id, message);
  }

  return [...uniqueMessages.values()].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function upsertChatPreview(
  chats: SerializedChatListItem[],
  nextChat: SerializedChatListItem
) {
  return [nextChat, ...chats.filter((chat) => chat.id !== nextChat.id)].sort(
    (left, right) =>
      new Date(right.lastMessageAt ?? 0).getTime() -
      new Date(left.lastMessageAt ?? 0).getTime()
  );
}

export function ChatsScreenShell({
  initialData,
  viewerUserId
}: ChatsScreenShellProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [composerText, setComposerText] = useState("");
  const [chatList, setChatList] = useState(initialData.chats);
  const [pendingInvites, setPendingInvites] = useState(initialData.pendingInvites);
  const [selectedChat, setSelectedChat] = useState(initialData.selectedChat);
  const [selectedMessages, setSelectedMessages] = useState(
    initialData.selectedMessages?.messages ?? []
  );
  const [selectedMessagesCursor, setSelectedMessagesCursor] = useState(
    initialData.selectedMessages?.nextCursor ?? null
  );
  const [studyFormMode, setStudyFormMode] = useState<StudyFormMode>(null);
  const [studyDraft, setStudyDraft] = useState(() =>
    buildStudyDraft(initialData.selectedChat?.studySessionPanel ?? null)
  );

  const selectedChatId = selectedChat?.id ?? null;
  const isThreadWritable =
    selectedChat?.status !== "BLOCKED" && selectedChat?.status !== "CLOSED";
  const selectedStudyPanel = selectedChat?.studySessionPanel ?? null;
  const selectedStudySession = selectedStudyPanel?.latestSession ?? null;

  async function refreshSelectedChatMetadata() {
    if (!selectedChatId) {
      return;
    }

    const response = await fetch(`/api/chats/${selectedChatId}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const nextMetadata = (await response.json()) as SerializedChatMetadata;

    setSelectedChat(nextMetadata);
    setChatList((currentChats) => upsertChatPreview(currentChats, nextMetadata));
  }

  const pollSelectedChat = useEffectEvent(async () => {
    if (!selectedChatId) {
      return;
    }

    try {
      const metadataPromise = fetch(`/api/chats/${selectedChatId}`, {
        cache: "no-store"
      });

      const messagesUrl = new URL(
        `/api/chats/${selectedChatId}/messages`,
        window.location.origin
      );

      if (selectedMessagesCursor) {
        messagesUrl.searchParams.set("cursor", selectedMessagesCursor);
      }

      const messagesPromise = fetch(messagesUrl.toString(), {
        cache: "no-store"
      });

      const [metadataResponse, messagesResponse] = await Promise.all([
        metadataPromise,
        messagesPromise
      ]);

      if (metadataResponse.ok) {
        const nextMetadata =
          (await metadataResponse.json()) as SerializedChatMetadata;

        setSelectedChat(nextMetadata);
        setChatList((currentChats) =>
          upsertChatPreview(currentChats, nextMetadata)
        );
      }

      if (messagesResponse.ok) {
        const nextMessages =
          (await messagesResponse.json()) as SerializedChatMessages;

        setSelectedMessages((currentMessages) =>
          mergeMessages(currentMessages, nextMessages.messages)
        );
        setSelectedMessagesCursor(nextMessages.nextCursor);
      }
    } catch {
      // Keep polling silent. The next cycle or manual user action will retry.
    }
  });

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollSelectedChat();
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedChatId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setStudyFormMode(null);
      setStudyDraft(buildStudyDraft(selectedChat?.studySessionPanel ?? null));
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedChatId, selectedChat?.studySessionPanel]);

  function handleSendMessage() {
    const text = composerText.trim();

    if (!selectedChatId || !text || !isThreadWritable) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/chats/${selectedChatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      const payload = (await response.json().catch(() => null)) as
        | SentMessageResult
        | { message?: string }
        | null;

      if (!response.ok || !isSentMessagePayload(payload)) {
        setFeedback({
          kind: "error",
          message: extractErrorMessage(
            payload,
            "Не удалось отправить сообщение."
          )
        });
        return;
      }

      const nextMessage = payload.message;

      setComposerText("");
      setSelectedMessages((currentMessages) =>
        mergeMessages(currentMessages, [nextMessage])
      );
      setSelectedMessagesCursor(nextMessage.id);

      if (selectedChat) {
        const nextChat: SerializedChatMetadata = {
          ...selectedChat,
          status: "ACTIVE",
          staleStatus: "FRESH",
          canSendReminder: false,
          lastMessageAt: nextMessage.createdAt,
          lastMessagePreview: nextMessage.text.slice(0, 120)
        };

        setSelectedChat(nextChat);
        setChatList((currentChats) =>
          upsertChatPreview(currentChats, nextChat)
        );
      }
    });
  }

  function handleRespondInvite(
    matchId: string,
    decision: "ACCEPT" | "DECLINE"
  ) {
    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/matches/${matchId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ decision })
      });

      const payload = (await response.json().catch(() => null)) as
        | { status: "ACCEPTED"; chatId: string }
        | { status: "DECLINED"; matchId: string }
        | { message?: string }
        | null;

      if (!response.ok || !payload || !("status" in payload)) {
        setFeedback({
          kind: "error",
          message: extractErrorMessage(
            payload,
            "Не удалось ответить на приглашение."
          )
        });
        return;
      }

      if (payload.status === "ACCEPTED") {
        router.push(buildChatsHref(payload.chatId));
        router.refresh();
        return;
      }

      setPendingInvites((currentInvites) =>
        currentInvites.filter((invite) => invite.matchId !== matchId)
      );
      setFeedback({
        kind: "success",
        message: "Приглашение отклонено."
      });
      router.refresh();
    });
  }

  function handleSendReminder() {
    if (!selectedChatId || !selectedChat?.canSendReminder) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/chats/${selectedChatId}/reminder`, {
        method: "POST"
      });

      const payload = (await response.json().catch(() => null)) as
        | SentMessageResult
        | { message?: string }
        | null;

      if (!response.ok || !isSentMessagePayload(payload)) {
        setFeedback({
          kind: "error",
          message: extractErrorMessage(
            payload,
            "Не удалось отправить напоминание."
          )
        });
        return;
      }

      setSelectedMessages((currentMessages) =>
        mergeMessages(currentMessages, [payload.message])
      );
      setSelectedMessagesCursor(payload.message.id);

      if (selectedChat) {
        const nextChat: SerializedChatMetadata = {
          ...selectedChat,
          status: "ACTIVE",
          staleStatus: "FRESH",
          canSendReminder: false,
          lastMessageAt: payload.message.createdAt,
          lastMessagePreview: null
        };

        setSelectedChat(nextChat);
        setChatList((currentChats) =>
          upsertChatPreview(currentChats, nextChat)
        );
      }

      setFeedback({
        kind: "success",
        message: "Напоминание отправлено."
      });
    });
  }

  function handleRequestContacts() {
    if (!selectedChatId) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(
        `/api/chats/${selectedChatId}/contact-exchange/request`,
        {
          method: "POST"
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | ContactExchangeState
        | { message?: string }
        | null;

      if (
        !response.ok ||
        !payload ||
        !("contactExchangeStatus" in payload)
      ) {
        setFeedback({
          kind: "error",
          message: extractErrorMessage(
            payload,
            "Не удалось запросить обмен контактами."
          )
        });
        return;
      }

      if (selectedChat) {
        setSelectedChat({
          ...selectedChat,
          contactExchangeStatus: payload.contactExchangeStatus,
          contactExchangeRequestedByMe: true
        });
      }

      setFeedback({
        kind: "success",
        message: "Запрос на обмен контактами отправлен."
      });
      router.refresh();
    });
  }

  function handleRespondToContactExchange(decision: "ACCEPT" | "DECLINE") {
    if (!selectedChatId) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(
        `/api/chats/${selectedChatId}/contact-exchange/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ decision })
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | ContactExchangeResult
        | { message?: string }
        | null;

      if (!response.ok || !payload || !("status" in payload)) {
        setFeedback({
          kind: "error",
          message: extractErrorMessage(
            payload,
            "Не удалось ответить на обмен контактами."
          )
        });
        return;
      }

      if (selectedChat) {
        setSelectedChat({
          ...selectedChat,
          contactExchangeStatus:
            payload.status === "MUTUAL_CONSENT_REACHED"
              ? "MUTUAL_CONSENT"
              : "DECLINED",
          contactExchangeRequestedByMe: false,
          revealedContacts: payload.revealedContacts
        });
      }

      setFeedback({
        kind: "success",
        message:
          payload.status === "MUTUAL_CONSENT_REACHED"
            ? "Контакты открыты для обеих сторон."
            : "Запрос на обмен контактами отклонён."
      });
      router.refresh();
    });
  }

  function openStudyForm(mode: Exclude<StudyFormMode, null>) {
    setStudyFormMode(mode);
    setStudyDraft(buildStudyDraft(selectedStudyPanel));
  }

  function handleSaveStudySession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedChat || !selectedStudyPanel || !studyFormMode) {
      return;
    }

    if (!studyDraft.scheduledAt) {
      setFeedback({
        kind: "error",
        message: "Укажите дату и время StudyBuddy-встречи."
      });
      return;
    }

    const scheduledAt = new Date(studyDraft.scheduledAt);

    if (Number.isNaN(scheduledAt.getTime())) {
      setFeedback({
        kind: "error",
        message: "Проверьте дату и время StudyBuddy-встречи."
      });
      return;
    }

    const notes = studyDraft.notes?.trim() || undefined;
    const payload =
      studyFormMode === "RESCHEDULE"
        ? {
            action: "RESCHEDULE" as const,
            scheduledAt: scheduledAt.toISOString(),
            notes
          }
        : {
            scheduledAt: scheduledAt.toISOString(),
            format: studyDraft.format,
            notes
          };

    const endpoint =
      studyFormMode === "FIRST"
        ? `/api/matches/${selectedChat.matchId}/session`
        : studyFormMode === "NEXT" && selectedStudySession
          ? `/api/sessions/${selectedStudySession.id}/schedule-next`
          : selectedStudySession
            ? `/api/sessions/${selectedStudySession.id}`
            : null;

    if (!endpoint) {
      setFeedback({
        kind: "error",
        message: "Не удалось определить StudyBuddy-встречу для изменения."
      });
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(endpoint, {
        method: studyFormMode === "RESCHEDULE" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: extractErrorMessage(
            result,
            "Не удалось сохранить StudyBuddy-встречу."
          )
        });
        return;
      }

      setStudyFormMode(null);
      setFeedback({
        kind: "success",
        message:
          studyFormMode === "RESCHEDULE"
            ? "StudyBuddy-встреча перенесена."
            : "StudyBuddy-встреча запланирована."
      });
      await refreshSelectedChatMetadata();
      router.refresh();
    });
  }

  function handleStudySessionAction(action: Exclude<SessionAction, "RESCHEDULE">) {
    if (!selectedStudySession) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(`/api/sessions/${selectedStudySession.id}`, {
        method: "PATCH",
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
          message: extractErrorMessage(
            result,
            "Не удалось обновить StudyBuddy-встречу."
          )
        });
        return;
      }

      setFeedback({
        kind: "success",
        message: "StudyBuddy-встреча обновлена."
      });
      await refreshSelectedChatMetadata();
      router.refresh();
    });
  }

  function handleStudyRequestAction(action: "FIND_NEW_PARTNER" | "STOP_SEARCHING") {
    const requestId = selectedStudyPanel?.requestId;

    if (!requestId) {
      setFeedback({
        kind: "error",
        message: "Для этого действия нужен активный StudyBuddy-запрос."
      });
      return;
    }

    const endpoint =
      action === "FIND_NEW_PARTNER"
        ? `/api/requests/${requestId}/find-new-partner`
        : `/api/requests/${requestId}/stop-searching`;

    startTransition(async () => {
      setFeedback(null);

      const response = await fetch(endpoint, {
        method: "POST"
      });

      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: extractErrorMessage(
            result,
            action === "FIND_NEW_PARTNER"
              ? "Не удалось запустить поиск нового StudyBuddy."
              : "Не удалось остановить StudyBuddy-поиск."
          )
        });
        return;
      }

      setFeedback({
        kind: "success",
        message:
          action === "FIND_NEW_PARTNER"
            ? "Поиск нового StudyBuddy запущен."
            : "StudyBuddy-поиск остановлен."
      });
      await refreshSelectedChatMetadata();
      router.refresh();
    });
  }

  return (
    <div className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Диалоги</p>
          <h2 className="screen-title">Чаты и приглашения</h2>
          <p className="screen-description">
            Разговоры после мэтча помогают принять решение: можно принять приглашение
            из резервного подбора, написать первое сообщение, напомнить о себе и открыть
            контакты только по взаимному согласию.
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

        {chatList.length === 0 && pendingInvites.length === 0 ? (
          <div className="screen-stack">
            <p className="screen-description">
              Откройте мэтчи и начните разговор с подходящим человеком.
              Первый чат станет центром решения: роли, время, контакты.
            </p>
            <Link
              className={buttonClassName({
                fullWidth: true
              })}
              href="/matches"
            >
              Перейти к мэтчам
            </Link>
          </div>
        ) : null}
      </section>

      {pendingInvites.length > 0 ? (
        <section className="surface-card screen-stack">
          <div className="screen-copy">
            <p className="card-eyebrow">Нужно решение</p>
            <h2 className="card-title">Входящие приглашения</h2>
            <p className="card-body-copy">
              Это резервный подбор по открытому профилю: сначала вы решаете, готовы ли открыть чат.
            </p>
          </div>

          <div className="invite-list">
            {pendingInvites.map((invite) => (
              <article key={invite.matchId} className="invite-card">
                <div className="screen-copy">
                  <div className="match-badge-row">
                    <span className="status-pill">
                      {chatScenarioLabels[invite.scenario]}
                    </span>
                    <span className="score-pill">{invite.score}/100</span>
                  </div>
                  <h3 className="card-title">{invite.initiatorDisplayName}</h3>
                  <p className="card-body-copy">{invite.reasonSummary}</p>
                </div>

                <div className="card-actions-row card-actions-row-inline">
                  <Button
                    disabled={isPending}
                    onClick={() => handleRespondInvite(invite.matchId, "ACCEPT")}
                  >
                    Принять
                  </Button>
                  <Button
                    disabled={isPending}
                    onClick={() => handleRespondInvite(invite.matchId, "DECLINE")}
                    variant="ghost"
                  >
                    Отклонить
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {chatList.length > 0 ? (
        <div className="chat-layout">
          <section className="surface-card screen-stack">
            <div className="screen-copy">
              <p className="card-eyebrow">Активные чаты</p>
              <h2 className="card-title">Продолжить разговор</h2>
            </div>

            <div className="chat-list">
              {chatList.map((chat) => {
                const isActive = chat.id === selectedChatId;

                return (
                  <Link
                    key={chat.id}
                    className="chat-list-card"
                    data-active={isActive}
                    href={buildChatsHref(chat.id)}
                  >
                    <div className="chat-list-head">
                      <div className="screen-copy">
                        <div className="match-badge-row">
                          <span
                            className="tone-pill"
                            data-tone={chatStatusTone[chat.status]}
                          >
                            {chatStatusLabels[chat.status]}
                          </span>
                          <span className="status-pill">
                            {chatScenarioLabels[chat.scenario]}
                          </span>
                        </div>
                        <h3 className="card-title">{chat.otherUser.displayName}</h3>
                      </div>
                      {isActive ? (
                        <span className="status-pill">Открыт</span>
                      ) : null}
                    </div>

                    <p className="helper-text">
                      {chat.lastMessagePreview ?? "Системное сообщение или новый этап"}
                    </p>
                    <div className="chat-list-meta">
                      <span>{staleStatusLabels[chat.staleStatus]}</span>
                      <span>{formatDateTime(chat.lastMessageAt)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="surface-card screen-stack">
            {selectedChat ? (
              <>
                <div className="chat-thread-header">
                  <div className="screen-copy">
                    <div className="match-badge-row">
                      <span
                        className="tone-pill"
                        data-tone={chatStatusTone[selectedChat.status]}
                      >
                        {chatStatusLabels[selectedChat.status]}
                      </span>
                      <span className="status-pill">
                        {chatScenarioLabels[selectedChat.scenario]}
                      </span>
                    </div>
                    <h2 className="screen-title">
                      {selectedChat.otherUser.displayName}
                    </h2>
                    <p className="screen-description">
                      {staleStatusLabels[selectedChat.staleStatus]}. Последняя
                      активность {formatDateTime(selectedChat.lastMessageAt)}.
                    </p>
                  </div>

                  {selectedChat.canSendReminder ? (
                    <Button
                      disabled={isPending}
                      onClick={handleSendReminder}
                      variant="secondary"
                    >
                      Напомнить
                    </Button>
                  ) : null}
                </div>

                <div className="match-context-card chat-contact-box">
                  <p className="card-eyebrow">Контакты</p>
                  <p className="feedback-title">
                    {
                      contactExchangeStatusLabels[
                        selectedChat.contactExchangeStatus
                      ]
                    }
                  </p>

                  {selectedChat.contactExchangeStatus === "MUTUAL_CONSENT" ? (
                    <div className="chat-contact-list">
                      <p className="helper-text">
                        Telegram:{" "}
                        {selectedChat.revealedContacts?.telegramUsername ??
                          "не указан"}
                      </p>
                      <p className="helper-text">
                        Телефон:{" "}
                        {selectedChat.revealedContacts?.phone ?? "не указан"}
                      </p>
                    </div>
                  ) : null}

                  {selectedChat.contactExchangeStatus === "NOT_REQUESTED" ? (
                    <div className="card-actions-row card-actions-row-inline">
                      <Button
                        disabled={isPending || !isThreadWritable}
                        onClick={handleRequestContacts}
                      >
                        Запросить контакты
                      </Button>
                    </div>
                  ) : null}

                  {selectedChat.contactExchangeStatus ===
                    "REQUESTED_ONE_SIDED" && selectedChat.contactExchangeRequestedByMe ? (
                    <p className="helper-text">
                      Вы уже запросили обмен контактами. Ждём ответ собеседника.
                    </p>
                  ) : null}

                  {selectedChat.contactExchangeStatus ===
                    "REQUESTED_ONE_SIDED" && !selectedChat.contactExchangeRequestedByMe ? (
                    <div className="card-actions-row card-actions-row-inline">
                      <Button
                        disabled={isPending}
                        onClick={() => handleRespondToContactExchange("ACCEPT")}
                      >
                        Открыть контакты
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => handleRespondToContactExchange("DECLINE")}
                        variant="ghost"
                      >
                        Отказать
                      </Button>
                    </div>
                  ) : null}

                  {selectedChat.contactExchangeStatus === "DECLINED" ? (
                    <p className="helper-text">
                      Контакты не были открыты, но диалог остаётся доступным
                      внутри приложения.
                    </p>
                  ) : null}
                </div>

                {selectedStudyPanel ? (
                  <div className="match-context-card study-chat-panel">
                    <div className="screen-copy">
                      <p className="card-eyebrow">StudyBuddy</p>
                      <h3 className="card-title">
                        {selectedStudyPanel.subjectName}
                      </h3>
                      <p className="card-body-copy">
                        Сценарий совместной учёбы с{" "}
                        {selectedStudyPanel.partnerName}. Встречи фиксируются в чате,
                        чтобы после чата был понятный следующий шаг.
                      </p>
                    </div>

                    {selectedStudySession ? (
                      <div className="quick-goal-preview" data-tone="mint">
                        <span
                          className="accent-icon-badge"
                          data-tone="mint"
                          aria-hidden="true"
                        >
                          ST
                        </span>
                        <div className="special-card-copy">
                          <div className="dashboard-row-head">
                            <strong>
                              Встреча #{selectedStudySession.sequenceNumber}
                            </strong>
                            <span
                              className="tone-pill"
                              data-tone={
                                studySessionStatusTone[
                                  selectedStudySession.status
                                ]
                              }
                            >
                              {
                                studySessionStatusLabels[
                                  selectedStudySession.status
                                ]
                              }
                            </span>
                          </div>
                          <p className="helper-text">
                            {formatDateTime(selectedStudySession.scheduledFor)}
                            {" · "}
                            {formatLabelByValue[selectedStudySession.format]}
                          </p>
                          {selectedStudySession.notes ? (
                            <p className="helper-text">
                              {selectedStudySession.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="helper-text">
                        Встреча ещё не назначена. Предложите время после первого
                        короткого обсуждения в чате.
                      </p>
                    )}

                    <div className="dashboard-action-grid">
                      {selectedStudyPanel.canScheduleFirst ? (
                        <Button
                          disabled={isPending || !isThreadWritable}
                          onClick={() => openStudyForm("FIRST")}
                          type="button"
                        >
                          Назначить встречу
                        </Button>
                      ) : null}

                      {selectedStudySession?.status === "PROPOSED" ? (
                        <Button
                          disabled={isPending || !isThreadWritable}
                          onClick={() => handleStudySessionAction("CONFIRM")}
                          type="button"
                          variant="secondary"
                        >
                          Подтвердить
                        </Button>
                      ) : null}

                      {selectedStudySession &&
                      (selectedStudySession.status === "PROPOSED" ||
                        selectedStudySession.status === "CONFIRMED") ? (
                        <>
                          <Button
                            disabled={isPending || !isThreadWritable}
                            onClick={() => openStudyForm("RESCHEDULE")}
                            type="button"
                            variant="secondary"
                          >
                            Перенести
                          </Button>
                          <Button
                            disabled={isPending || !isThreadWritable}
                            onClick={() =>
                              handleStudySessionAction("MARK_COMPLETED")
                            }
                            type="button"
                            variant="secondary"
                          >
                            Завершить
                          </Button>
                          <Button
                            disabled={isPending || !isThreadWritable}
                            onClick={() =>
                              handleStudySessionAction("MARK_MISSED")
                            }
                            type="button"
                            variant="ghost"
                          >
                            Не состоялась
                          </Button>
                        </>
                      ) : null}

                      {selectedStudyPanel.canScheduleNext ? (
                        <Button
                          disabled={isPending || !isThreadWritable}
                          onClick={() => openStudyForm("NEXT")}
                          type="button"
                        >
                          Повторить встречу
                        </Button>
                      ) : null}

                      {selectedStudyPanel.canFindNewPartner ? (
                        <Button
                          disabled={isPending}
                          onClick={() => handleStudyRequestAction("FIND_NEW_PARTNER")}
                          type="button"
                          variant="secondary"
                        >
                          Найти нового партнёра
                        </Button>
                      ) : null}

                      {selectedStudyPanel.canStopSearching ? (
                        <Button
                          disabled={isPending}
                          onClick={() => handleStudyRequestAction("STOP_SEARCHING")}
                          type="button"
                          variant="ghost"
                        >
                          Остановить поиск
                        </Button>
                      ) : null}
                    </div>

                    {studyFormMode ? (
                      <form className="screen-stack" onSubmit={handleSaveStudySession}>
                        <div className="form-grid">
                          <label className="field-stack">
                            <span className="field-label">Дата и время</span>
                            <input
                              className="field-input"
                              onChange={(event) =>
                                setStudyDraft((current) => ({
                                  ...current,
                                  scheduledAt: event.target.value
                                }))
                              }
                              type="datetime-local"
                              value={studyDraft.scheduledAt}
                            />
                          </label>

                          <label className="field-stack">
                            <span className="field-label">Формат</span>
                            <select
                              className="field-input field-select"
                              disabled={studyFormMode === "RESCHEDULE"}
                              onChange={(event) =>
                                setStudyDraft((current) => ({
                                  ...current,
                                  format: event.target
                                    .value as ScheduleSessionInput["format"]
                                }))
                              }
                              value={studyDraft.format}
                            >
                              {formatOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="field-stack">
                          <span className="field-label">Комментарий</span>
                          <textarea
                            className="field-input field-textarea"
                            maxLength={500}
                            onChange={(event) =>
                              setStudyDraft((current) => ({
                                ...current,
                                notes: event.target.value
                              }))
                            }
                            placeholder="Например: разобрать задачи к семинару или созвониться онлайн"
                            rows={3}
                            value={studyDraft.notes ?? ""}
                          />
                        </label>

                        <div className="card-actions-row card-actions-row-inline">
                          <Button disabled={isPending} type="submit">
                            Сохранить встречу
                          </Button>
                          <Button
                            disabled={isPending}
                            onClick={() => setStudyFormMode(null)}
                            type="button"
                            variant="ghost"
                          >
                            Отмена
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ) : null}

                <div className="chat-message-list">
                  {selectedMessages.length === 0 ? (
                    <div className="chat-empty-state">
                      <p className="helper-text">
                        Начните разговор первым сообщением: цель, роли, удобное
                        время и следующий шаг.
                      </p>
                    </div>
                  ) : (
                    selectedMessages.map((message) => {
                      const isOwnMessage = message.senderId === viewerUserId;
                      const bubbleKind =
                        message.type === "SYSTEM"
                          ? "system"
                          : message.type === "REMINDER"
                            ? "reminder"
                            : isOwnMessage
                              ? "own"
                              : "other";

                      return (
                        <div
                          key={message.id}
                          className="chat-message-row"
                          data-own={isOwnMessage && message.type === "USER"}
                        >
                          <div className="chat-bubble" data-kind={bubbleKind}>
                            <p className="chat-message-text">{message.text}</p>
                            <span className="chat-message-time">
                              {formatMessageTime(message.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form
                  className="chat-compose-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSendMessage();
                  }}
                >
                  <label className="field-stack">
                    <span className="field-label">Сообщение</span>
                    <textarea
                      className="field-textarea chat-compose-input"
                      disabled={!isThreadWritable || isPending}
                      maxLength={4000}
                      onChange={(event) => setComposerText(event.target.value)}
                      placeholder="Напишите, что вы ищете, как вам удобно работать и что хотите обсудить первым."
                      rows={4}
                      value={composerText}
                    />
                  </label>
                  <div className="card-actions-row card-actions-row-inline">
                    <Button
                      disabled={
                        isPending || !isThreadWritable || !composerText.trim()
                      }
                      type="submit"
                    >
                      Отправить
                    </Button>
                    {!isThreadWritable ? (
                      <p className="helper-text">
                        В этот чат сейчас нельзя писать.
                      </p>
                    ) : null}
                  </div>
                </form>
              </>
            ) : (
              <div className="chat-empty-state">
                <p className="screen-description">
                  Выберите чат слева, чтобы увидеть историю и продолжить
                  разговор.
                </p>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
