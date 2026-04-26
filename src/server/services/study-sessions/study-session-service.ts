import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { analyticsService } from "@/server/services/analytics/analytics-service";
import { matchingService } from "@/server/services/matching/matching-service";
import type {
  ScheduleSessionInput,
  SerializedSession,
  SerializedStudyChatPanel,
  SerializedStudyContinuation,
  SerializedStudyHomeSession,
  SerializedStudyHomeState,
  SessionAction
} from "@/features/study-sessions/lib/study-session-types";

// ---------------------------------------------------------------------------
// Prisma includes
// ---------------------------------------------------------------------------

const sessionInclude = {
  chat: {
    select: {
      id: true,
      userAId: true,
      userBId: true,
      status: true,
      matchId: true
    }
  }
} as const;

const homeParticipantSelect = {
  firstName: true,
  lastName: true,
  profile: {
    select: {
      fullName: true
    }
  }
} as const;

const homeSessionInclude = {
  chat: {
    select: {
      id: true,
      userAId: true,
      userBId: true,
      userA: {
        select: homeParticipantSelect
      },
      userB: {
        select: homeParticipantSelect
      }
    }
  },
  match: {
    select: {
      sourceRequest: {
        select: {
          id: true,
          ownerId: true,
          status: true,
          studyDetails: {
            select: {
              subject: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      },
      candidateRequest: {
        select: {
          id: true,
          ownerId: true,
          status: true,
          studyDetails: {
            select: {
              subject: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

const chatPanelInclude = {
  userA: {
    select: homeParticipantSelect
  },
  userB: {
    select: homeParticipantSelect
  },
  match: {
    select: {
      id: true,
      scenario: true,
      sourceRequest: {
        select: {
          id: true,
          ownerId: true,
          status: true,
          studyDetails: {
            select: {
              subject: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      },
      candidateRequest: {
        select: {
          id: true,
          ownerId: true,
          status: true,
          studyDetails: {
            select: {
              subject: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    }
  },
  sessions: {
    orderBy: { updatedAt: "desc" as const, scheduledFor: "desc" as const },
    take: 1
  }
} as const;

const matchForSessionInclude = {
  sourceRequest: {
    select: { id: true, ownerId: true, scenario: true }
  },
  candidateRequest: {
    select: { id: true, ownerId: true }
  },
  candidateProfile: {
    select: { id: true, userId: true }
  },
  chat: {
    select: { id: true, userAId: true, userBId: true, status: true }
  }
} as const;

type HomeSessionRecord = Prisma.SessionGetPayload<{
  include: typeof homeSessionInclude;
}>;
type ChatPanelRecord = Prisma.ChatGetPayload<{
  include: typeof chatPanelInclude;
}>;
type SerializableSessionRecord = {
  id: string;
  chatId: string;
  matchId: string;
  sequenceNumber: number;
  scheduledFor: Date;
  format: string;
  notes: string | null;
  status: string;
  nextAction: string;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class SessionDomainError extends Error {
  code: string;
  status: number;

  constructor(params: { code: string; message: string; status: number }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeSession(session: SerializableSessionRecord): SerializedSession {
  return {
    id: session.id,
    chatId: session.chatId,
    matchId: session.matchId,
    sequenceNumber: session.sequenceNumber,
    scheduledFor: session.scheduledFor.toISOString(),
    format: session.format as SerializedSession["format"],
    notes: session.notes,
    status: session.status as SerializedSession["status"],
    nextAction: session.nextAction as SerializedSession["nextAction"],
    confirmedAt: session.confirmedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    cancelledAt: session.cancelledAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString()
  };
}

function assertChatParticipant(
  chat: { userAId: string; userBId: string },
  userId: string
): void {
  if (chat.userAId !== userId && chat.userBId !== userId) {
    throw new SessionDomainError({
      code: "session_forbidden",
      message: "Доступ к этой сессии запрещён.",
      status: 403
    });
  }
}

function buildParticipantDisplayName(user: {
  firstName: string;
  lastName: string | null;
  profile: { fullName: string | null } | null;
}) {
  return (
    user.profile?.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Партнер"
  );
}

function getOwnedStudyRequestForUser(
  session: HomeSessionRecord,
  userId: string
) {
  if (session.match.sourceRequest.ownerId === userId) {
    return session.match.sourceRequest;
  }

  if (session.match.candidateRequest?.ownerId === userId) {
    return session.match.candidateRequest;
  }

  return null;
}

function getStudySubjectName(session: HomeSessionRecord, userId: string) {
  const ownedRequest = getOwnedStudyRequestForUser(session, userId);

  return (
    ownedRequest?.studyDetails?.subject.name ||
    session.match.sourceRequest.studyDetails?.subject.name ||
    session.match.candidateRequest?.studyDetails?.subject.name ||
    "StudyBuddy"
  );
}

function getStudyPartnerName(session: HomeSessionRecord, userId: string) {
  const otherUser =
    session.chat.userAId === userId ? session.chat.userB : session.chat.userA;

  return buildParticipantDisplayName(otherUser);
}

function resolveRecommendedAction(
  session: Pick<HomeSessionRecord, "status" | "nextAction">
): SerializedStudyContinuation["recommendedAction"] {
  if (session.nextAction !== "NONE") {
    return session.nextAction;
  }

  if (session.status === "COMPLETED") {
    return "SCHEDULE_NEXT";
  }

  if (session.status === "MISSED" || session.status === "CANCELLED") {
    return "FIND_NEW_PARTNER";
  }

  return "NONE";
}

function serializeStudyHomeSession(
  session: HomeSessionRecord,
  userId: string
): SerializedStudyHomeSession {
  const ownedRequest = getOwnedStudyRequestForUser(session, userId);
  const requestStatus =
    (ownedRequest?.status as SerializedStudyHomeSession["requestStatus"]) ?? null;

  return {
    sessionId: session.id,
    chatId: session.chat.id,
    requestId: ownedRequest?.id ?? null,
    subjectName: getStudySubjectName(session, userId),
    partnerName: getStudyPartnerName(session, userId),
    scheduledFor: session.scheduledFor.toISOString(),
    format: session.format as SerializedStudyHomeSession["format"],
    notes: session.notes,
    status: session.status as SerializedStudyHomeSession["status"],
    nextAction: session.nextAction as SerializedStudyHomeSession["nextAction"],
    sequenceNumber: session.sequenceNumber,
    requestStatus,
    canScheduleNext: true,
    canFindNewPartner: requestStatus === "ACTIVE",
    canStopSearching: requestStatus === "ACTIVE"
  };
}

function buildStudyContinuation(
  session: HomeSessionRecord,
  userId: string
): SerializedStudyContinuation {
  const serializedSession = serializeStudyHomeSession(session, userId);

  return {
    ...serializedSession,
    recommendedAction: resolveRecommendedAction(session)
  };
}

function getOwnedStudyRequestFromChat(chat: ChatPanelRecord, userId: string) {
  if (chat.match.sourceRequest.ownerId === userId) {
    return chat.match.sourceRequest;
  }

  if (chat.match.candidateRequest?.ownerId === userId) {
    return chat.match.candidateRequest;
  }

  return null;
}

function serializeStudyChatPanel(
  chat: ChatPanelRecord,
  userId: string
): SerializedStudyChatPanel | null {
  if (chat.match.scenario !== "STUDY") {
    return null;
  }

  const ownedRequest = getOwnedStudyRequestFromChat(chat, userId);
  const latestSession = chat.sessions[0] ?? null;
  const requestStatus =
    (ownedRequest?.status as SerializedStudyChatPanel["requestStatus"]) ?? null;
  const otherUser = chat.userAId === userId ? chat.userB : chat.userA;
  const subjectName =
    ownedRequest?.studyDetails?.subject.name ||
    chat.match.sourceRequest.studyDetails?.subject.name ||
    chat.match.candidateRequest?.studyDetails?.subject.name ||
    "StudyBuddy";

  return {
    chatId: chat.id,
    requestId: ownedRequest?.id ?? null,
    subjectName,
    partnerName: buildParticipantDisplayName(otherUser),
    requestStatus,
    latestSession: latestSession ? serializeSession(latestSession) : null,
    canScheduleFirst: latestSession === null,
    canScheduleNext: latestSession?.status === "COMPLETED",
    canFindNewPartner: requestStatus === "ACTIVE",
    canStopSearching: requestStatus === "ACTIVE"
  };
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface StudySessionService {
  getHomeStateForUser(userId: string): Promise<SerializedStudyHomeState>;
  getChatPanelForUser(
    userId: string,
    chatId: string
  ): Promise<SerializedStudyChatPanel | null>;

  scheduleFirst(
    userId: string,
    matchId: string,
    data: ScheduleSessionInput
  ): Promise<SerializedSession>;

  updateSession(
    userId: string,
    sessionId: string,
    action: SessionAction,
    data?: { scheduledAt?: string; notes?: string }
  ): Promise<SerializedSession>;

  scheduleNext(
    userId: string,
    sessionId: string,
    data: ScheduleSessionInput
  ): Promise<SerializedSession>;

  findNewPartner(userId: string, requestId: string): Promise<void>;
  stopSearching(userId: string, requestId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const studySessionService: StudySessionService = {
  async getHomeStateForUser(userId) {
    const now = new Date();

    const [upcomingSession, latestSession] = await Promise.all([
      prisma.session.findFirst({
        where: {
          status: "CONFIRMED",
          scheduledFor: {
            gte: now
          },
          match: {
            is: {
              scenario: "STUDY"
            }
          },
          chat: {
            is: {
              OR: [{ userAId: userId }, { userBId: userId }]
            }
          }
        },
        include: homeSessionInclude,
        orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }]
      }),
      prisma.session.findFirst({
        where: {
          match: {
            is: {
              scenario: "STUDY"
            }
          },
          chat: {
            is: {
              OR: [{ userAId: userId }, { userBId: userId }]
            }
          }
        },
        include: homeSessionInclude,
        orderBy: [{ updatedAt: "desc" }, { scheduledFor: "desc" }]
      })
    ]);

    return {
      upcomingSession: upcomingSession
        ? serializeStudyHomeSession(upcomingSession, userId)
        : null,
      continuation: latestSession
        ? buildStudyContinuation(latestSession, userId)
        : null
    };
  },

  async getChatPanelForUser(userId, chatId) {
    const chat = await prisma.chat.findUnique({
      where: {
        id: chatId
      },
      include: chatPanelInclude
    });

    if (!chat) {
      throw new SessionDomainError({
        code: "chat_not_found",
        message: "Чат не найден.",
        status: 404
      });
    }

    assertChatParticipant(chat, userId);

    return serializeStudyChatPanel(chat, userId);
  },

  // -------------------------------------------------------------------------
  // scheduleFirst
  // -------------------------------------------------------------------------
  async scheduleFirst(userId, matchId, data) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: matchForSessionInclude
    });

    if (!match) {
      throw new SessionDomainError({
        code: "match_not_found",
        message: "Матч не найден.",
        status: 404
      });
    }

    if (match.sourceRequest.scenario !== "STUDY") {
      throw new SessionDomainError({
        code: "not_study_match",
        message: "Сессии можно планировать только для StudyBuddy-матчей.",
        status: 409
      });
    }

    const isSource = match.sourceRequest.ownerId === userId;
    const isCandidate =
      match.candidateRequest?.ownerId === userId ||
      match.candidateProfile?.userId === userId;

    if (!isSource && !isCandidate) {
      throw new SessionDomainError({
        code: "session_forbidden",
        message: "Этот матч вам не принадлежит.",
        status: 403
      });
    }

    if (!match.chat) {
      throw new SessionDomainError({
        code: "chat_required",
        message: "Сначала откройте чат для этого матча.",
        status: 409
      });
    }

    if (match.chat.status === "CLOSED" || match.chat.status === "BLOCKED") {
      throw new SessionDomainError({
        code: "chat_not_active",
        message: "Чат недоступен для планирования сессии.",
        status: 409
      });
    }

    const existingCount = await prisma.session.count({
      where: { chatId: match.chat.id }
    });

    if (existingCount > 0) {
      throw new SessionDomainError({
        code: "first_session_exists",
        message: "Первая сессия уже запланирована. Используйте /schedule-next для следующей.",
        status: 409
      });
    }

    const session = await prisma.session.create({
      data: {
        matchId: match.id,
        chatId: match.chat.id,
        scheduledByUserId: userId,
        sequenceNumber: 1,
        scheduledFor: new Date(data.scheduledAt),
        format: data.format,
        notes: data.notes ?? null,
        status: "PROPOSED",
        nextAction: "NONE"
      },
      include: sessionInclude
    });

    await analyticsService.track("schedule_study_session", {
      sessionId: session.id,
      matchId: match.id,
      chatId: match.chat.id,
      sequenceNumber: 1,
      userId
    });

    return serializeSession(session);
  },

  // -------------------------------------------------------------------------
  // updateSession
  // -------------------------------------------------------------------------
  async updateSession(userId, sessionId, action, data) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: sessionInclude
    });

    if (!session) {
      throw new SessionDomainError({
        code: "session_not_found",
        message: "Сессия не найдена.",
        status: 404
      });
    }

    assertChatParticipant(session.chat, userId);

    const { status } = session;
    const isTerminal =
      status === "COMPLETED" || status === "CANCELLED" || status === "MISSED";

    // Terminal sessions can only be rescheduled (user correction edge case);
    // all other actions are blocked.
    if (isTerminal && action !== "RESCHEDULE") {
      throw new SessionDomainError({
        code: "session_already_terminal",
        message: "Сессия уже завершена — изменение статуса невозможно.",
        status: 409
      });
    }

    const now = new Date();

    if (action === "CONFIRM") {
      if (status !== "PROPOSED") {
        throw new SessionDomainError({
          code: "invalid_transition",
          message: "Подтвердить можно только предложенную сессию.",
          status: 409
        });
      }
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { status: "CONFIRMED", confirmedAt: now },
        include: sessionInclude
      });
      return serializeSession(updated);
    }

    if (action === "CANCEL") {
      if (status !== "PROPOSED" && status !== "CONFIRMED") {
        throw new SessionDomainError({
          code: "invalid_transition",
          message: "Отменить можно только предложенную или подтверждённую сессию.",
          status: 409
        });
      }
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { status: "CANCELLED", cancelledAt: now, nextAction: "FIND_NEW_PARTNER" },
        include: sessionInclude
      });
      return serializeSession(updated);
    }

    if (action === "RESCHEDULE") {
      if (status !== "PROPOSED" && status !== "CONFIRMED") {
        throw new SessionDomainError({
          code: "invalid_transition",
          message: "Перенести можно только предложенную или подтверждённую сессию.",
          status: 409
        });
      }
      if (!data?.scheduledAt) {
        throw new SessionDomainError({
          code: "reschedule_missing_time",
          message: "Для переноса укажите новое время (scheduledAt).",
          status: 400
        });
      }
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          scheduledFor: new Date(data.scheduledAt),
          // Update notes only when explicitly provided in the request.
          notes: data.notes !== undefined ? data.notes : session.notes,
          status: "PROPOSED",
          confirmedAt: null
        },
        include: sessionInclude
      });
      return serializeSession(updated);
    }

    if (action === "MARK_COMPLETED") {
      if (status !== "PROPOSED" && status !== "CONFIRMED") {
        throw new SessionDomainError({
          code: "invalid_transition",
          message: "Завершить можно только предложенную или подтверждённую сессию.",
          status: 409
        });
      }
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          completedAt: now,
          nextAction: "SCHEDULE_NEXT"
        },
        include: sessionInclude
      });

      if (session.sequenceNumber === 1) {
        await analyticsService.track("first_study_session_completed", {
          sessionId,
          matchId: session.matchId,
          chatId: session.chatId,
          userId
        });
      }

      return serializeSession(updated);
    }

    if (action === "MARK_MISSED") {
      if (status !== "PROPOSED" && status !== "CONFIRMED") {
        throw new SessionDomainError({
          code: "invalid_transition",
          message: "Отметить как пропущенную можно только предложенную или подтверждённую сессию.",
          status: 409
        });
      }
      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { status: "MISSED", nextAction: "FIND_NEW_PARTNER" },
        include: sessionInclude
      });
      return serializeSession(updated);
    }

    // Exhaustive fallback — TypeScript action type should prevent this.
    throw new SessionDomainError({
      code: "unknown_action",
      message: "Неизвестное действие.",
      status: 400
    });
  },

  // -------------------------------------------------------------------------
  // scheduleNext
  // -------------------------------------------------------------------------
  async scheduleNext(userId, sessionId, data) {
    const parentSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: sessionInclude
    });

    if (!parentSession) {
      throw new SessionDomainError({
        code: "session_not_found",
        message: "Сессия не найдена.",
        status: 404
      });
    }

    assertChatParticipant(parentSession.chat, userId);

    // Derive next sequence number from the DB to avoid race conditions.
    const agg = await prisma.session.aggregate({
      where: { chatId: parentSession.chatId },
      _max: { sequenceNumber: true }
    });
    const nextSeq = (agg._max.sequenceNumber ?? 1) + 1;

    const session = await prisma.session.create({
      data: {
        matchId: parentSession.matchId,
        chatId: parentSession.chatId,
        scheduledByUserId: userId,
        sequenceNumber: nextSeq,
        scheduledFor: new Date(data.scheduledAt),
        format: data.format,
        notes: data.notes ?? null,
        status: "PROPOSED",
        nextAction: "NONE"
      },
      include: sessionInclude
    });

    await analyticsService.track("repeat_study_session_scheduled", {
      sessionId: session.id,
      matchId: session.matchId,
      chatId: session.chatId,
      sequenceNumber: nextSeq,
      userId
    });

    return serializeSession(session);
  },

  // -------------------------------------------------------------------------
  // findNewPartner
  // -------------------------------------------------------------------------
  async findNewPartner(userId, requestId) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, ownerId: true, scenario: true, status: true }
    });

    if (!request) {
      throw new SessionDomainError({
        code: "request_not_found",
        message: "Запрос не найден.",
        status: 404
      });
    }

    if (request.ownerId !== userId) {
      throw new SessionDomainError({
        code: "request_forbidden",
        message: "Этот запрос вам не принадлежит.",
        status: 403
      });
    }

    if (request.scenario !== "STUDY") {
      throw new SessionDomainError({
        code: "not_study_request",
        message: "Поиск нового напарника доступен только для запросов StudyBuddy.",
        status: 409
      });
    }

    if (request.status !== "ACTIVE") {
      throw new SessionDomainError({
        code: "request_not_active",
        message: "Запрос должен быть активным.",
        status: 409
      });
    }

    // Close active pairings. Existing chats and sessions remain intact.
    await prisma.match.updateMany({
      where: {
        OR: [
          { sourceRequestId: requestId },
          { candidateRequestId: requestId }
        ],
        status: { in: ["READY", "PENDING_RECIPIENT_ACCEPTANCE"] }
      },
      data: { status: "CLOSED" }
    });

    // Recompute so the request surfaces to new potential partners immediately.
    await matchingService.recomputeForRequest(requestId);
  },

  // -------------------------------------------------------------------------
  // stopSearching
  // -------------------------------------------------------------------------
  async stopSearching(userId, requestId) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { id: true, ownerId: true, status: true }
    });

    if (!request) {
      throw new SessionDomainError({
        code: "request_not_found",
        message: "Запрос не найден.",
        status: 404
      });
    }

    if (request.ownerId !== userId) {
      throw new SessionDomainError({
        code: "request_forbidden",
        message: "Этот запрос вам не принадлежит.",
        status: 403
      });
    }

    if (request.status === "CLOSED" || request.status === "DELETED") {
      throw new SessionDomainError({
        code: "request_already_closed",
        message: "Запрос уже закрыт.",
        status: 409
      });
    }

    // Close request and all active pairings atomically.
    // Chats and sessions are not affected.
    await prisma.$transaction([
      prisma.request.update({
        where: { id: requestId },
        data: { status: "CLOSED", closedAt: new Date() }
      }),
      prisma.match.updateMany({
        where: {
          OR: [
            { sourceRequestId: requestId },
            { candidateRequestId: requestId }
          ],
          status: { in: ["READY", "PENDING_RECIPIENT_ACCEPTANCE"] }
        },
        data: { status: "CLOSED" }
      })
    ]);
  }
};
