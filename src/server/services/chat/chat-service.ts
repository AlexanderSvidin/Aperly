import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { analyticsService } from "@/server/services/analytics/analytics-service";
import { studySessionService } from "@/server/services/study-sessions/study-session-service";
import { tryNotifyRecipient } from "@/server/services/notifications/telegram-notifications";
import type {
  ContactExchangeResult,
  ContactExchangeState,
  ContactExchangeStatusValue,
  OpenChatResult,
  RespondResult,
  RevealedContacts,
  SerializedChatListItem,
  SerializedChatMessages,
  SerializedChatMetadata,
  SerializedMessage,
  SentMessageResult,
  SerializedPendingInvite,
  UserChatList
} from "@/features/chat/lib/chat-types";

const STALE_THRESHOLD_MS = 72 * 60 * 60 * 1000;
const CHAT_SOFT_LIMIT = 12;
const MESSAGES_INITIAL_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Prisma includes
// ---------------------------------------------------------------------------

const participantSelect = {
  id: true,
  firstName: true,
  lastName: true,
  status: true,
  blockedAt: true,
  deletedAt: true,
  profile: {
    select: {
      fullName: true,
      telegramUsername: true,
      phone: true
    }
  }
} as const;

const chatListInclude = {
  match: {
    select: {
      id: true,
      scenario: true,
      mode: true,
      status: true
    }
  },
  userA: { select: participantSelect },
  userB: { select: participantSelect },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      type: true,
      text: true,
      createdAt: true
    }
  }
} as const;

const chatMetadataInclude = {
  match: {
    select: {
      id: true,
      scenario: true,
      mode: true,
      status: true
    }
  },
  userA: { select: participantSelect },
  userB: { select: participantSelect },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      type: true,
      text: true,
      createdAt: true
    }
  }
} as const;

const matchForOpenChatInclude = {
  sourceRequest: {
    select: {
      id: true,
      ownerId: true,
      scenario: true
    }
  },
  candidateRequest: {
    select: {
      id: true,
      ownerId: true
    }
  },
  candidateProfile: {
    select: {
      id: true,
      userId: true
    }
  },
  chat: {
    select: {
      id: true
    }
  }
} as const;

const matchForRespondInclude = {
  sourceRequest: {
    select: {
      id: true,
      ownerId: true,
      scenario: true
    }
  },
  candidateProfile: {
    select: {
      id: true,
      userId: true
    }
  },
  chat: {
    select: {
      id: true
    }
  }
} as const;

type ChatListRecord = Prisma.ChatGetPayload<{ include: typeof chatListInclude }>;
type ChatMetadataRecord = Prisma.ChatGetPayload<{ include: typeof chatMetadataInclude }>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStaleAfterAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + STALE_THRESHOLD_MS);
}

function isStaleByTime(chat: { staleAfterAt: Date | null }): boolean {
  return chat.staleAfterAt !== null && chat.staleAfterAt <= new Date();
}

function buildPersonDisplayName(user: {
  firstName: string;
  lastName: string | null;
  profile: { fullName: string } | null;
}): string {
  return (
    user.profile?.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Неизвестно"
  );
}

function getOtherUser(
  chat: ChatListRecord | ChatMetadataRecord,
  userId: string
): ChatListRecord["userA"] {
  return chat.userAId === userId ? chat.userB : chat.userA;
}

function isChatParticipant(chat: { userAId: string; userBId: string }, userId: string): boolean {
  return chat.userAId === userId || chat.userBId === userId;
}

function computeContactExchangeStatus(
  raw: string
): ContactExchangeStatusValue {
  return raw as ContactExchangeStatusValue;
}

function buildRevealedContacts(
  chat: ChatMetadataRecord,
  userId: string
): RevealedContacts | null {
  if (chat.contactExchangeStatus !== "MUTUAL_CONSENT") {
    return null;
  }
  const other = getOtherUser(chat, userId);
  return {
    telegramUsername: other.profile?.telegramUsername ?? null,
    phone: other.profile?.phone ?? null
  };
}

function serializeMessage(msg: {
  id: string;
  senderId: string | null;
  type: string;
  text: string;
  createdAt: Date;
}): SerializedMessage {
  return {
    id: msg.id,
    senderId: msg.senderId,
    type: msg.type as SerializedMessage["type"],
    text: msg.text,
    createdAt: msg.createdAt.toISOString()
  };
}

function buildChatListItem(
  chat: ChatListRecord | ChatMetadataRecord,
  userId: string
): SerializedChatListItem {
  const stale = isStaleByTime(chat);
  const resolvedStatus = stale && chat.status === "ACTIVE" ? "STALE" : chat.status;
  const otherUser = getOtherUser(chat, userId);
  const lastMsg = (chat.messages as Array<{ id: string; type: string; text: string; createdAt: Date }>)[0] ?? null;

  return {
    id: chat.id,
    matchId: chat.matchId,
    scenario: chat.match.scenario as SerializedChatListItem["scenario"],
    otherUser: {
      id: otherUser.id,
      displayName: buildPersonDisplayName(otherUser)
    },
    status: resolvedStatus as SerializedChatListItem["status"],
    staleStatus: stale ? "AWAITING_REPLY" : "FRESH",
    contactExchangeStatus: computeContactExchangeStatus(chat.contactExchangeStatus),
    lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
    staleAfterAt: chat.staleAfterAt?.toISOString() ?? null,
    canSendReminder:
      stale &&
      resolvedStatus !== "CLOSED" &&
      resolvedStatus !== "BLOCKED",
    lastMessagePreview: lastMsg?.type === "USER" ? lastMsg.text.slice(0, 120) : null
  };
}

async function syncStaleStatus(chatId: string): Promise<void> {
  await prisma.chat.updateMany({
    where: {
      id: chatId,
      status: "ACTIVE",
      staleAfterAt: { lte: new Date() }
    },
    data: { status: "STALE" }
  });
}

async function countActiveChatsForUser(userId: string): Promise<number> {
  return prisma.chat.count({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      status: { in: ["ACTIVE", "STALE"] }
    }
  });
}

async function assertChatLimitNotReached(userId: string): Promise<void> {
  const count = await countActiveChatsForUser(userId);
  if (count >= CHAT_SOFT_LIMIT) {
    throw new ChatDomainError({
      code: "chat_limit_reached",
      message:
        "Достигнут лимит активных чатов (12). Завершите один из текущих диалогов, чтобы открыть новый.",
      status: 409
    });
  }
}

async function assertChatAccess(
  chat: { userAId: string; userBId: string } | null | undefined,
  userId: string
): Promise<void> {
  if (!chat) {
    throw new ChatDomainError({
      code: "chat_not_found",
      message: "Чат не найден.",
      status: 404
    });
  }
  if (!isChatParticipant(chat, userId)) {
    throw new ChatDomainError({
      code: "chat_forbidden",
      message: "Доступ к чату запрещён.",
      status: 403
    });
  }
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ChatDomainError extends Error {
  code: string;
  status: number;

  constructor(params: { code: string; message: string; status: number }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
  }
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface ChatService {
  openFromMatch(userId: string, matchId: string): Promise<OpenChatResult>;
  respondToFallbackInvite(
    userId: string,
    matchId: string,
    decision: "ACCEPT" | "DECLINE"
  ): Promise<RespondResult>;
  listForUser(userId: string): Promise<UserChatList>;
  getChatMetadata(userId: string, chatId: string): Promise<SerializedChatMetadata>;
  getMessages(
    userId: string,
    chatId: string,
    cursor?: string
  ): Promise<SerializedChatMessages>;
  sendMessage(
    userId: string,
    chatId: string,
    text: string
  ): Promise<SentMessageResult>;
  sendReminder(userId: string, chatId: string): Promise<SentMessageResult>;
  requestContactExchange(userId: string, chatId: string): Promise<ContactExchangeState>;
  respondToContactExchange(
    userId: string,
    chatId: string,
    decision: "ACCEPT" | "DECLINE"
  ): Promise<ContactExchangeResult>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const chatService: ChatService = {
  // -------------------------------------------------------------------------
  // openFromMatch
  // -------------------------------------------------------------------------
  async openFromMatch(userId, matchId) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: matchForOpenChatInclude
    });

    if (!match) {
      throw new ChatDomainError({
        code: "match_not_found",
        message: "Матч не найден.",
        status: 404
      });
    }

    // If a chat already exists for this match, return it directly.
    if (match.chat) {
      if (
        match.sourceRequest.ownerId !== userId &&
        match.candidateRequest?.ownerId !== userId &&
        match.candidateProfile?.userId !== userId
      ) {
        throw new ChatDomainError({
          code: "chat_forbidden",
          message: "Доступ запрещён.",
          status: 403
        });
      }
      return { status: "CHAT_READY", chatId: match.chat.id };
    }

    // Guard against terminal match states.
    if (
      match.status === "EXPIRED" ||
      match.status === "CLOSED" ||
      match.status === "DECLINED"
    ) {
      throw new ChatDomainError({
        code: "match_not_active",
        message: "Матч недоступен для открытия чата.",
        status: 409
      });
    }

    // REQUEST_TO_REQUEST: open chat immediately.
    if (match.mode === "REQUEST_TO_REQUEST" && match.status === "READY") {
      const sourceOwnerId = match.sourceRequest.ownerId;
      const candidateOwnerId = match.candidateRequest?.ownerId;

      if (userId !== sourceOwnerId && userId !== candidateOwnerId) {
        throw new ChatDomainError({
          code: "match_forbidden",
          message: "Этот чат уже существует.",
          status: 403
        });
      }

      const otherId = userId === sourceOwnerId ? candidateOwnerId! : sourceOwnerId;

      await assertChatLimitNotReached(userId);
      await assertChatLimitNotReached(otherId);

      const now = new Date();
      // Deterministic userA/userB assignment: lexicographically smaller ID = userA.
      const [userAId, userBId] = [userId, otherId].sort();

      const chat = await prisma.chat.create({
        data: {
          matchId: match.id,
          userAId,
          userBId,
          status: "ACTIVE",
          lastMessageAt: now,
          staleAfterAt: buildStaleAfterAt(now)
        }
      });

      await prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: null,
          type: "SYSTEM",
          text: "Чат открыт. Можно начать разговор."
        }
      });

      await analyticsService.track("open_chat", {
        chatId: chat.id,
        matchId: match.id,
        scenario: match.sourceRequest.scenario,
        userId
      });

      return { status: "CHAT_READY", chatId: chat.id };
    }

    // REQUEST_TO_PROFILE: source request owner sends invite.
    if (
      match.mode === "REQUEST_TO_PROFILE" &&
      match.status === "PENDING_RECIPIENT_ACCEPTANCE"
    ) {
      if (match.sourceRequest.ownerId !== userId) {
        throw new ChatDomainError({
          code: "match_forbidden",
          message:
            "Новый чат откроется после принятия приглашения. Используйте действие ответа.",
          status: 403
        });
      }
      // No state change needed: match is already PENDING_RECIPIENT_ACCEPTANCE.
      return { status: "INVITE_SENT", matchId: match.id };
    }

    throw new ChatDomainError({
      code: "match_state_invalid",
      message: "Приглашение отправлено. Чат появится после принятия.",
      status: 409
    });
  },

  // -------------------------------------------------------------------------
  // respondToFallbackInvite
  // -------------------------------------------------------------------------
  async respondToFallbackInvite(userId, matchId, decision) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: matchForRespondInclude
    });

    if (!match) {
      throw new ChatDomainError({
        code: "match_not_found",
        message: "Матч не найден.",
        status: 404
      });
    }

    if (match.mode !== "REQUEST_TO_PROFILE") {
      throw new ChatDomainError({
        code: "respond_not_applicable",
        message: "Матч требует приглашения и пока не готов к чату.",
        status: 409
      });
    }

    if (match.status !== "PENDING_RECIPIENT_ACCEPTANCE") {
      throw new ChatDomainError({
        code: "match_not_pending",
        message: "Приглашение уже было обработано.",
        status: 409
      });
    }

    if (match.candidateProfile?.userId !== userId) {
      throw new ChatDomainError({
        code: "respond_forbidden",
        message: "Ответить на приглашение может только получатель.",
        status: 403
      });
    }

    // If a chat somehow already exists, return it.
    if (match.chat) {
      if (decision === "ACCEPT") {
        return { status: "ACCEPTED", chatId: match.chat.id };
      }
    }

    if (decision === "DECLINE") {
      await prisma.match.update({
        where: { id: matchId },
        data: { status: "DECLINED" }
      });
      return { status: "DECLINED", matchId };
    }

    // ACCEPT
    const sourceOwnerId = match.sourceRequest.ownerId;
    await assertChatLimitNotReached(sourceOwnerId);
    await assertChatLimitNotReached(userId);

    const now = new Date();
    const [userAId, userBId] = [sourceOwnerId, userId].sort();

    const chat = await prisma.$transaction(async (tx) => {
      const created = await tx.chat.create({
        data: {
          matchId: match.id,
          userAId,
          userBId,
          status: "ACTIVE",
          lastMessageAt: now,
          staleAfterAt: buildStaleAfterAt(now)
        }
      });

      await tx.match.update({
        where: { id: matchId },
        data: { status: "READY" }
      });

      await tx.message.create({
        data: {
          chatId: created.id,
          senderId: null,
          type: "SYSTEM",
          text: "Приглашение принято. Чат открыт."
        }
      });

      return created;
    });

    await analyticsService.track("open_chat", {
      chatId: chat.id,
      matchId: match.id,
      scenario: match.sourceRequest.scenario,
      userId
    });

    return { status: "ACCEPTED", chatId: chat.id };
  },

  // -------------------------------------------------------------------------
  // listForUser
  // -------------------------------------------------------------------------
  async listForUser(userId) {
    const [rawChats, pendingInviteMatches] = await Promise.all([
      prisma.chat.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: { in: ["ACTIVE", "STALE"] }
        },
        include: chatListInclude,
        orderBy: { lastMessageAt: "desc" }
      }),
      // Pending R2P invites where current user is the recipient.
      prisma.match.findMany({
        where: {
          mode: "REQUEST_TO_PROFILE",
          status: "PENDING_RECIPIENT_ACCEPTANCE",
          candidateProfile: {
            is: { userId }
          }
        },
        select: {
          id: true,
          scenario: true,
          score: true,
          reasonSummary: true,
          sourceRequest: {
            select: {
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profile: {
                    select: { fullName: true }
                  }
                }
              }
            }
          }
        }
      })
    ]);

    // Sync stale status for all loaded chats (fire-and-forget bulk update).
    const staleIds = rawChats
      .filter((c) => isStaleByTime(c) && c.status === "ACTIVE")
      .map((c) => c.id);
    if (staleIds.length > 0) {
      await prisma.chat.updateMany({
        where: { id: { in: staleIds } },
        data: { status: "STALE" }
      });
    }

    const chats: SerializedChatListItem[] = rawChats.map((chat) =>
      buildChatListItem(chat, userId)
    );

    const pendingInvites: SerializedPendingInvite[] = pendingInviteMatches.map((match) => {
      const owner = match.sourceRequest.owner;
      return {
        matchId: match.id,
        mode: "REQUEST_TO_PROFILE",
        status: "PENDING_RECIPIENT_ACCEPTANCE",
        scenario: match.scenario as SerializedPendingInvite["scenario"],
        initiatorDisplayName:
          owner.profile?.fullName ||
          [owner.firstName].filter(Boolean).join(" ") ||
          "Неизвестно",
        reasonSummary: match.reasonSummary,
        score: match.score
      };
    });

    return { chats, pendingInvites };
  },

  // -------------------------------------------------------------------------
  // getChatMetadata
  // -------------------------------------------------------------------------
  async getChatMetadata(userId, chatId) {
    await syncStaleStatus(chatId);

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: chatMetadataInclude
    });

    await assertChatAccess(chat, userId);

    const base = buildChatListItem(chat!, userId);
    const revealedContacts = buildRevealedContacts(chat!, userId);
    const studySessionPanel = await studySessionService.getChatPanelForUser(
      userId,
      chatId
    );

    return {
      ...base,
      contactExchangeRequestedByMe:
        chat!.contactExchangeStatus === "REQUESTED_ONE_SIDED" &&
        chat!.contactRequestedByUserId === userId,
      revealedContacts,
      studySessionPanel
    };
  },

  // -------------------------------------------------------------------------
  // getMessages
  // -------------------------------------------------------------------------
  async getMessages(userId, chatId, cursor) {
    // Validate access with a lightweight query.
    const chatAccess = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { userAId: true, userBId: true }
    });
    await assertChatAccess(chatAccess, userId);

    if (cursor) {
      const cursorMsg = await prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true }
      });

      if (!cursorMsg) {
        throw new ChatDomainError({
          code: "cursor_not_found",
        message: "Сообщение не найдено.",
          status: 400
        });
      }

      const messages = await prisma.message.findMany({
        where: {
          chatId,
          createdAt: { gt: cursorMsg.createdAt }
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          senderId: true,
          type: true,
          text: true,
          createdAt: true
        }
      });

      const nextCursor =
        messages.length > 0 ? messages[messages.length - 1].id : cursor;

      return {
        messages: messages.map(serializeMessage),
        nextCursor,
        transport: "POLLING" as const
      };
    }

    // Initial load: return last N messages in chronological order.
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: MESSAGES_INITIAL_PAGE_SIZE,
      select: {
        id: true,
        senderId: true,
        type: true,
        text: true,
        createdAt: true
      }
    });

    messages.reverse();

    const nextCursor =
      messages.length > 0 ? messages[messages.length - 1].id : null;

    return {
      messages: messages.map(serializeMessage),
      nextCursor,
      transport: "POLLING" as const
    };
  },

  // -------------------------------------------------------------------------
  // sendMessage
  // -------------------------------------------------------------------------
  async sendMessage(userId, chatId, text) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        userAId: true,
        userBId: true,
        status: true,
        matchId: true
      }
    });

    await assertChatAccess(chat, userId);

    if (chat!.status === "CLOSED" || chat!.status === "BLOCKED") {
      throw new ChatDomainError({
        code: "chat_not_writable",
        message: "Отправка сообщений в этот чат недоступна.",
        status: 409
      });
    }

    // Check whether this will be the first USER message.
    const existingUserMsgCount = await prisma.message.count({
      where: { chatId, type: "USER" }
    });

    const now = new Date();

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          chatId,
          senderId: userId,
          type: "USER",
          text
        },
        select: {
          id: true,
          senderId: true,
          type: true,
          text: true,
          createdAt: true
        }
      }),
      prisma.chat.update({
        where: { id: chatId },
        data: {
          lastMessageAt: now,
          staleAfterAt: buildStaleAfterAt(now),
          status: "ACTIVE"
        }
      })
    ]);

    if (existingUserMsgCount === 0) {
      await analyticsService.track("send_first_message", {
        chatId,
        matchId: chat!.matchId,
        userId
      });
    }

    // Fire-and-forget push notification to the other participant.
    // tryNotifyRecipient never throws — failure is swallowed internally.
    void tryNotifyRecipient(userId, chatId, chat!.userAId, chat!.userBId);

    return { message: serializeMessage(message) };
  },

  // -------------------------------------------------------------------------
  // sendReminder
  // -------------------------------------------------------------------------
  async sendReminder(userId, chatId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        userAId: true,
        userBId: true,
        status: true,
        staleAfterAt: true,
        matchId: true
      }
    });

    await assertChatAccess(chat, userId);

    if (!isStaleByTime(chat!)) {
      throw new ChatDomainError({
        code: "chat_not_stale",
        message: "Напоминание можно отправить только в ожидающий ответ чат.",
        status: 409
      });
    }

    if (chat!.status === "CLOSED" || chat!.status === "BLOCKED") {
      throw new ChatDomainError({
        code: "chat_not_writable",
        message: "Отправка напоминания в этот чат недоступна.",
        status: 409
      });
    }

    const now = new Date();

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          chatId,
          senderId: userId,
          type: "REMINDER",
          text: "Напоминание о себе отправлено. Ждём ответ собеседника."
        },
        select: {
          id: true,
          senderId: true,
          type: true,
          text: true,
          createdAt: true
        }
      }),
      prisma.chat.update({
        where: { id: chatId },
        data: {
          lastMessageAt: now,
          staleAfterAt: buildStaleAfterAt(now),
          status: "ACTIVE"
        }
      })
    ]);

    return { message: serializeMessage(message) };
  },

  // -------------------------------------------------------------------------
  // requestContactExchange
  // -------------------------------------------------------------------------
  async requestContactExchange(userId, chatId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        userAId: true,
        userBId: true,
        status: true,
        contactExchangeStatus: true,
        contactRequestedByUserId: true,
        matchId: true
      }
    });

    await assertChatAccess(chat, userId);

    if (chat!.status === "CLOSED" || chat!.status === "BLOCKED") {
      throw new ChatDomainError({
        code: "chat_not_writable",
        message: "Обмен контактами в этом чате недоступен.",
        status: 409
      });
    }

    if (chat!.contactExchangeStatus !== "NOT_REQUESTED") {
      throw new ChatDomainError({
        code: "contact_exchange_already_initiated",
        message:
          chat!.contactExchangeStatus === "REQUESTED_ONE_SIDED"
            ? "Запрос на обмен контактами уже отправлен. Дождитесь ответа."
            : "Запрос на обмен контактами отправлен.",
        status: 409
      });
    }

    const isUserA = chat!.userAId === userId;
    const now = new Date();

    await prisma.$transaction([
      prisma.chat.update({
        where: { id: chatId },
        data: {
          contactExchangeStatus: "REQUESTED_ONE_SIDED",
          contactRequestedByUserId: userId,
          ...(isUserA
            ? { userAContactAcceptedAt: now }
            : { userBContactAcceptedAt: now })
        }
      }),
      prisma.message.create({
        data: {
          chatId,
          senderId: null,
          type: "SYSTEM",
          text: "Один из участников запросил обмен контактами."
        }
      })
    ]);

    await analyticsService.track("exchange_contacts", {
      chatId,
      matchId: chat!.matchId,
      action: "requested",
      userId
    });

    return { contactExchangeStatus: "REQUESTED_ONE_SIDED" as const };
  },

  // -------------------------------------------------------------------------
  // respondToContactExchange
  // -------------------------------------------------------------------------
  async respondToContactExchange(userId, chatId, decision) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        userAId: true,
        userBId: true,
        status: true,
        contactExchangeStatus: true,
        contactRequestedByUserId: true,
        matchId: true,
        match: {
          select: {
            scenario: true
          }
        }
      }
    });

    await assertChatAccess(chat, userId);

    if (chat!.contactExchangeStatus !== "REQUESTED_ONE_SIDED") {
      throw new ChatDomainError({
        code: "contact_exchange_not_pending",
        message:
          chat!.contactExchangeStatus === "MUTUAL_CONSENT"
            ? "Контакты уже открыты."
            : "Нет активного запроса на обмен контактами.",
        status: 409
      });
    }

    if (chat!.contactRequestedByUserId === userId) {
      throw new ChatDomainError({
        code: "contact_exchange_self_respond",
        message: "Вы не можете ответить на собственный запрос.",
        status: 409
      });
    }

    const isUserA = chat!.userAId === userId;
    const now = new Date();

    if (decision === "DECLINE") {
      await prisma.$transaction([
        prisma.chat.update({
          where: { id: chatId },
          data: {
            contactExchangeStatus: "DECLINED",
            contactSharedAt: null
          }
        }),
        prisma.message.create({
          data: {
            chatId,
            senderId: null,
            type: "SYSTEM",
            text: "Обмен контактами отклонен. Контакты не открыты."
          }
        })
      ]);

      await analyticsService.track("exchange_contacts", {
        chatId,
        matchId: chat!.matchId,
        action: "declined",
        userId
      });

      return { status: "DECLINED" as const, revealedContacts: null };
    }

    // ACCEPT: reach mutual consent.
    await prisma.$transaction([
      prisma.chat.update({
        where: { id: chatId },
        data: {
          contactExchangeStatus: "MUTUAL_CONSENT",
          contactSharedAt: now,
          ...(isUserA
            ? { userAContactAcceptedAt: now }
            : { userBContactAcceptedAt: now })
        }
      }),
      prisma.message.create({
        data: {
          chatId,
          senderId: null,
          type: "SYSTEM",
          text: "Ваш собеседник подтвердил обмен контактами. Контакты открыты."
        }
      })
    ]);

    // Load the other participant's profile for contact reveal.
    const otherUserId = isUserA ? chat!.userBId : chat!.userAId;
    const otherProfile = await prisma.profile.findUnique({
      where: { userId: otherUserId },
      select: { telegramUsername: true, phone: true }
    });

    const scenario = chat!.match?.scenario;
    if (scenario === "CASE") {
      await analyticsService.track("case_team_formed", {
        chatId,
        matchId: chat!.matchId,
        userId
      });
    } else if (scenario === "PROJECT") {
      await analyticsService.track("project_connection_confirmed", {
        chatId,
        matchId: chat!.matchId,
        userId
      });
    }
    // STUDY: no CASE/PROJECT event, only the earlier exchange_contacts event.

    return {
      status: "MUTUAL_CONSENT_REACHED" as const,
      revealedContacts: {
        telegramUsername: otherProfile?.telegramUsername ?? null,
        phone: otherProfile?.phone ?? null
      }
    };
  }
};
