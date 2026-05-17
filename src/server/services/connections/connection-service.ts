import type { Prisma, ScenarioType } from "@prisma/client";

import type {
  SerializedConnectionDetail,
  SerializedConnectionSummary,
  SerializedConnectionsScreenData,
  SerializedInteractionCtaState,
  SerializedInteractionDetail,
  SerializedInteractionSummary
} from "@/features/connections/lib/connection-types";
import { prisma } from "@/server/db/client";
import { analyticsService } from "@/server/services/analytics/analytics-service";

const DEFAULT_INTERACTION_MESSAGE = "Привет! Мне интересно подключиться.";
const INTERACTION_MESSAGE_MAX_LENGTH = 5000;

async function loadOtherProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      userSkills: {
        include: { skill: true },
        take: 6
      }
    }
  });
  if (!user) return null;
  const displayName =
    user.profile?.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Студент";
  const courseParts = [
    user.profile?.program,
    user.profile?.courseYear ? `${user.profile.courseYear} курс` : null
  ].filter(Boolean) as string[];
  return {
    name: displayName,
    courseInfo: courseParts.length > 0 ? courseParts.join(", ") : null,
    skills: user.userSkills.map((entry) => entry.skill.name)
  };
}

async function loadRequestSummary(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      studyDetails: { include: { subject: true } },
      caseDetails: true,
      projectDetails: true,
      activityDetails: true
    }
  });
  if (!request) return null;
  let title = "Запрос";
  let format: string | null = null;
  let comment: string | null = null;
  const roles: string[] = [];

  if (request.studyDetails) {
    title = request.studyDetails.subject?.name ?? "Учебный запрос";
    format = request.studyDetails.preferredFormat ?? null;
    comment = request.studyDetails.goal ?? null;
  } else if (request.caseDetails) {
    title = request.caseDetails.eventName;
    format = request.caseDetails.preferredFormat ?? null;
    if (Array.isArray(request.caseDetails.neededRoles)) {
      roles.push(...(request.caseDetails.neededRoles as string[]));
    }
  } else if (request.projectDetails) {
    title = request.projectDetails.projectTitle;
    format = request.projectDetails.preferredFormat ?? null;
    comment = request.projectDetails.shortDescription ?? null;
    if (Array.isArray(request.projectDetails.neededRoles)) {
      roles.push(...(request.projectDetails.neededRoles as string[]));
    }
  } else if (request.activityDetails) {
    title = request.activityDetails.title;
    format = request.activityDetails.preferredFormat ?? null;
    comment = request.activityDetails.comment ?? null;
  }

  return {
    scenario: request.scenario as ScenarioType,
    title,
    format,
    expiresAt: request.expiresAt ? request.expiresAt.toISOString() : null,
    comment,
    roles
  };
}

const userNameSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  status: true,
  deletedAt: true,
  profile: {
    select: {
      fullName: true,
      telegramUsername: true
    }
  }
} satisfies Prisma.UserSelect;

const requestContextSelect = {
  id: true,
  scenario: true,
  status: true,
  expiresAt: true,
  ownerId: true,
  owner: {
    select: userNameSelect
  },
  caseDetails: {
    select: {
      eventName: true
    }
  },
  projectDetails: {
    select: {
      projectTitle: true
    }
  },
  studyDetails: {
    select: {
      subject: {
        select: {
          name: true
        }
      },
      goal: true
    }
  }
} satisfies Prisma.RequestSelect;

const interactionInclude = {
  sender: {
    select: userNameSelect
  },
  recipient: {
    select: userNameSelect
  },
  sourceRequest: {
    select: requestContextSelect
  },
  targetRequest: {
    select: requestContextSelect
  },
  targetProfile: {
    select: {
      id: true,
      fullName: true,
      userId: true,
      user: {
        select: userNameSelect
      }
    }
  },
  connection: true
} satisfies Prisma.InteractionInclude;

const connectionInclude = {
  interaction: {
    include: {
      sender: {
        select: userNameSelect
      },
      recipient: {
        select: userNameSelect
      },
      sourceRequest: {
        select: requestContextSelect
      },
      targetRequest: {
        select: requestContextSelect
      },
      targetProfile: {
        select: {
          id: true,
          fullName: true,
          userId: true,
          user: {
            select: userNameSelect
          }
        }
      }
    }
  },
  userA: {
    select: userNameSelect
  },
  userB: {
    select: userNameSelect
  },
  sourceRequest: {
    select: requestContextSelect
  },
  targetRequest: {
    select: requestContextSelect
  },
  targetProfile: {
    select: {
      id: true,
      fullName: true,
      userId: true,
      user: {
        select: userNameSelect
      }
    }
  }
} satisfies Prisma.ConnectionInclude;

const matchForInvitationInclude = {
  sourceRequest: {
    select: requestContextSelect
  },
  candidateRequest: {
    select: requestContextSelect
  },
  candidateProfile: {
    select: {
      id: true,
      userId: true,
      user: {
        select: userNameSelect
      }
    }
  }
} satisfies Prisma.MatchInclude;

type InteractionRecord = Prisma.InteractionGetPayload<{
  include: typeof interactionInclude;
}>;
type ConnectionRecord = Prisma.ConnectionGetPayload<{
  include: typeof connectionInclude;
}>;
type MatchForInvitation = Prisma.MatchGetPayload<{
  include: typeof matchForInvitationInclude;
}>;

function normalizeMessage(value: string | null | undefined) {
  const message = value?.trim() || DEFAULT_INTERACTION_MESSAGE;

  if (message.length > INTERACTION_MESSAGE_MAX_LENGTH) {
    throw new ConnectionDomainError({
      code: "interaction_message_too_long",
      message: `Сообщение должно быть не длиннее ${INTERACTION_MESSAGE_MAX_LENGTH} символов.`,
      status: 422
    });
  }

  return message;
}

function buildDisplayName(user: {
  firstName: string;
  lastName: string | null;
  profile: { fullName: string | null } | null;
}) {
  return (
    user.profile?.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Студент"
  );
}

function normalizeTelegramUsername(value: string | null | undefined) {
  const username = value?.trim().replace(/^@+/, "");

  return username || null;
}

function buildTelegramUrl(value: string | null | undefined) {
  const username = normalizeTelegramUsername(value);

  return username ? `https://t.me/${username}` : null;
}

function isActiveRequest(
  request:
    | {
        status: string;
        expiresAt: Date;
      }
    | null
    | undefined
) {
  return Boolean(
    request && request.status === "ACTIVE" && request.expiresAt > new Date()
  );
}

function buildRequestTitle(
  request:
    | {
        scenario: ScenarioType;
        caseDetails: { eventName: string } | null;
        projectDetails: { projectTitle: string } | null;
        studyDetails: { subject: { name: string } | null; goal?: string | null } | null;
      }
    | null
    | undefined
) {
  if (!request) {
    return "Связь";
  }

  if (request.caseDetails) {
    return request.caseDetails.eventName;
  }

  if (request.projectDetails) {
    return request.projectDetails.projectTitle;
  }

  return request.studyDetails?.subject?.name ?? "StudyBuddy";
}

function buildInteractionTitle(interaction: InteractionRecord) {
  if (interaction.type === "RESPONSE") {
    return buildRequestTitle(interaction.targetRequest);
  }

  return buildRequestTitle(interaction.sourceRequest);
}

function buildInteractionSubtitle(interaction: InteractionRecord) {
  if (interaction.type === "RESPONSE") {
    return "Отклик на открытый запрос";
  }

  return interaction.targetRequest
    ? "Приглашение к вашему запросу"
    : "Приглашение по профилю";
}

function buildConnectionTitle(connection: ConnectionRecord) {
  return (
    buildRequestTitle(connection.targetRequest) ||
    buildRequestTitle(connection.sourceRequest)
  );
}

function getOtherUserFromConnection(connection: ConnectionRecord, userId: string) {
  return connection.userAId === userId ? connection.userB : connection.userA;
}

function serializeInteraction(
  interaction: InteractionRecord,
  userId: string
): SerializedInteractionSummary {
  const isIncoming = interaction.recipientUserId === userId;
  const person = isIncoming ? interaction.sender : interaction.recipient;

  return {
    id: interaction.id,
    type: interaction.type,
    status: interaction.status,
    scenario: interaction.scenario,
    title: buildInteractionTitle(interaction),
    subtitle: buildInteractionSubtitle(interaction),
    message: interaction.message,
    personName: buildDisplayName(person),
    createdAt: interaction.createdAt.toISOString(),
    expiresAt: interaction.expiresAt?.toISOString() ?? null,
    direction: isIncoming ? "INCOMING" : "OUTGOING"
  };
}

function serializeInteractionCtaState(
  interaction:
    | (Pick<InteractionRecord, "id" | "status"> & {
        connection: { id: string; status: string } | null;
      })
    | null,
  emptyLabel: string
): SerializedInteractionCtaState {
  if (!interaction) {
    return {
      status: "NONE",
      label: emptyLabel,
      canAct: true,
      interactionId: null,
      connectionId: null
    };
  }

  if (interaction.status === "PENDING") {
    return {
      status: "PENDING",
      label: "Ждём ответ",
      canAct: false,
      interactionId: interaction.id,
      connectionId: null
    };
  }

  if (interaction.status === "ACCEPTED") {
    const activeConnection =
      interaction.connection?.status === "ACTIVE" ? interaction.connection : null;

    return {
      status: "ACCEPTED",
      label: activeConnection ? "Перейти в связь" : "Ждём связь",
      canAct: Boolean(activeConnection),
      interactionId: interaction.id,
      connectionId: activeConnection?.id ?? null
    };
  }

  if (interaction.status === "DECLINED") {
    return {
      status: "DECLINED",
      label: "Отклонено",
      canAct: false,
      interactionId: interaction.id,
      connectionId: null
    };
  }

  return {
    status: interaction.status,
    label: interaction.status === "EXPIRED" ? "Истекло" : "Недоступно",
    canAct: false,
    interactionId: interaction.id,
    connectionId: null
  };
}

function serializeConnection(
  connection: ConnectionRecord,
  userId: string,
  revealActiveTelegram = false
): SerializedConnectionSummary {
  const otherUser = getOtherUserFromConnection(connection, userId);
  const otherUserCanShareTelegram =
    otherUser.status === "ACTIVE" && otherUser.deletedAt === null;
  const telegramUsername =
    revealActiveTelegram &&
    connection.status === "ACTIVE" &&
    otherUserCanShareTelegram
      ? normalizeTelegramUsername(
          otherUser.profile?.telegramUsername ?? otherUser.username
        )
      : null;

  return {
    id: connection.id,
    scenario: connection.scenario,
    status: connection.status,
    title: buildConnectionTitle(connection),
    subtitle:
      connection.status === "ACTIVE"
        ? "Активная связь. Можно перейти в Telegram."
        : "Связь завершена.",
    otherUserName: buildDisplayName(otherUser),
    telegramUsername,
    telegramUrl: buildTelegramUrl(telegramUsername),
    createdAt: connection.createdAt.toISOString(),
    endedAt: connection.endedAt?.toISOString() ?? null
  };
}

function assertUserCanUseProduct(user: {
  status: string;
  onboardingCompleted: boolean;
}) {
  if (user.status !== "ACTIVE" || !user.onboardingCompleted) {
    throw new ConnectionDomainError({
      code: "connection_actor_forbidden",
      message: "Сначала завершите профиль и убедитесь, что аккаунт активен.",
      status: 403
    });
  }
}

async function loadActiveOwnRequestForScenario(
  userId: string,
  scenario: ScenarioType
) {
  return prisma.request.findFirst({
    where: {
      ownerId: userId,
      scenario,
      status: "ACTIVE",
      expiresAt: {
        gt: new Date()
      }
    },
    select: {
      id: true
    }
  });
}

async function findExistingInteraction(input: {
  type: "RESPONSE" | "INVITATION";
  senderUserId: string;
  recipientUserId: string;
  sourceRequestId?: string | null;
  targetRequestId?: string | null;
  targetProfileId?: string | null;
  matchId?: string | null;
}) {
  return prisma.interaction.findFirst({
    where: {
      type: input.type,
      status: {
        in: ["PENDING", "ACCEPTED", "DECLINED"]
      },
      senderUserId: input.senderUserId,
      recipientUserId: input.recipientUserId,
      sourceRequestId: input.sourceRequestId ?? undefined,
      targetRequestId: input.targetRequestId ?? undefined,
      targetProfileId: input.targetProfileId ?? undefined,
      matchId: input.matchId ?? undefined
    },
    include: interactionInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
}

function resolveInvitationParticipants(userId: string, match: MatchForInvitation) {
  if (match.sourceRequest.ownerId === userId) {
    const recipientUserId =
      match.candidateRequest?.ownerId ?? match.candidateProfile?.userId ?? null;

    return {
      sourceRequestId: match.sourceRequest.id,
      targetRequestId: match.candidateRequest?.id ?? null,
      targetProfileId: match.candidateProfile?.id ?? null,
      recipientUserId
    };
  }

  if (match.candidateRequest?.ownerId === userId) {
    return {
      sourceRequestId: match.candidateRequest.id,
      targetRequestId: match.sourceRequest.id,
      targetProfileId: null,
      recipientUserId: match.sourceRequest.ownerId
    };
  }

  return {
    sourceRequestId: null,
    targetRequestId: null,
    targetProfileId: null,
    recipientUserId: null
  };
}

function ensureInteractionCanBeAccepted(interaction: InteractionRecord) {
  if (interaction.expiresAt && interaction.expiresAt <= new Date()) {
    throw new ConnectionDomainError({
      code: "interaction_expired",
      message: "Взаимодействие уже истекло.",
      status: 409
    });
  }

  if (interaction.type === "RESPONSE" && !isActiveRequest(interaction.targetRequest)) {
    throw new ConnectionDomainError({
      code: "target_request_inactive",
      message: "Закрытый или истёкший запрос не принимает новые отклики.",
      status: 409
    });
  }

  if (interaction.type === "INVITATION" && !isActiveRequest(interaction.sourceRequest)) {
    throw new ConnectionDomainError({
      code: "source_request_inactive",
      message: "Закрытый или истёкший запрос не может создавать новую связь.",
      status: 409
    });
  }

  if (interaction.targetRequest && !isActiveRequest(interaction.targetRequest)) {
    throw new ConnectionDomainError({
      code: "target_request_inactive",
      message: "Закрытый или истёкший запрос не принимает новые взаимодействия.",
      status: 409
    });
  }
}

export class ConnectionDomainError extends Error {
  code: string;
  status: number;

  constructor(params: { code: string; message: string; status: number }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
  }
}

export const connectionService = {
  async getResponseStatesForRequests(userId: string, requestIds: string[]) {
    if (requestIds.length === 0) {
      return new Map<string, SerializedInteractionCtaState>();
    }

    const interactions = await prisma.interaction.findMany({
      where: {
        type: "RESPONSE",
        senderUserId: userId,
        targetRequestId: {
          in: requestIds
        }
      },
      select: {
        id: true,
        status: true,
        targetRequestId: true,
        connection: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const stateByRequest = new Map<string, SerializedInteractionCtaState>();

    for (const interaction of interactions) {
      if (!interaction.targetRequestId || stateByRequest.has(interaction.targetRequestId)) {
        continue;
      }

      stateByRequest.set(
        interaction.targetRequestId,
        serializeInteractionCtaState(interaction, "Откликнуться")
      );
    }

    return stateByRequest;
  },

  async getResponseStateForRequest(userId: string, requestId: string) {
    const states = await this.getResponseStatesForRequests(userId, [requestId]);

    return (
      states.get(requestId) ?? serializeInteractionCtaState(null, "Откликнуться")
    );
  },

  async getInvitationStatesForMatches(userId: string, matchIds: string[]) {
    if (matchIds.length === 0) {
      return new Map<string, SerializedInteractionCtaState>();
    }

    const interactions = await prisma.interaction.findMany({
      where: {
        type: "INVITATION",
        senderUserId: userId,
        matchId: {
          in: matchIds
        }
      },
      select: {
        id: true,
        status: true,
        matchId: true,
        connection: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const stateByMatch = new Map<string, SerializedInteractionCtaState>();

    for (const interaction of interactions) {
      if (!interaction.matchId || stateByMatch.has(interaction.matchId)) {
        continue;
      }

      stateByMatch.set(
        interaction.matchId,
        serializeInteractionCtaState(interaction, "Пригласить")
      );
    }

    return stateByMatch;
  },

  async createResponseForRequest(
    senderUserId: string,
    targetRequestId: string,
    message: string
  ) {
    const normalizedMessage = normalizeMessage(message);
    const [sender, targetRequest] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: senderUserId
        },
        select: {
          id: true,
          status: true,
          onboardingCompleted: true
        }
      }),
      prisma.request.findUnique({
        where: {
          id: targetRequestId
        },
        select: requestContextSelect
      })
    ]);

    if (!sender) {
      throw new ConnectionDomainError({
        code: "sender_not_found",
        message: "Пользователь не найден.",
        status: 404
      });
    }

    assertUserCanUseProduct(sender);

    if (!targetRequest || targetRequest.ownerId === senderUserId) {
      throw new ConnectionDomainError({
        code: "target_request_not_found",
        message: "Открытый запрос не найден.",
        status: 404
      });
    }

    if (!isActiveRequest(targetRequest)) {
      throw new ConnectionDomainError({
        code: "target_request_inactive",
        message: "На закрытый или истёкший запрос уже нельзя откликнуться.",
        status: 409
      });
    }

    const existing = await findExistingInteraction({
      type: "RESPONSE",
      senderUserId,
      recipientUserId: targetRequest.ownerId,
      targetRequestId
    });

    if (existing) {
      return serializeInteraction(existing, senderUserId);
    }

    const ownRequest = await loadActiveOwnRequestForScenario(
      senderUserId,
      targetRequest.scenario
    );

    const created = await prisma.interaction.create({
      data: {
        type: "RESPONSE",
        status: "PENDING",
        scenario: targetRequest.scenario,
        sourceRequestId: ownRequest?.id ?? null,
        targetRequestId,
        senderUserId,
        recipientUserId: targetRequest.ownerId,
        message: normalizedMessage,
        expiresAt: targetRequest.expiresAt
      },
      include: interactionInclude
    });

    await analyticsService.track("response_sent", {
      interactionId: created.id,
      requestId: targetRequestId,
      scenario: targetRequest.scenario,
      userId: senderUserId
    });

    return serializeInteraction(created, senderUserId);
  },

  async createInvitationFromMatch(
    senderUserId: string,
    matchId: string,
    message: string
  ) {
    const normalizedMessage = normalizeMessage(message);
    const [sender, match] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: senderUserId
        },
        select: {
          id: true,
          status: true,
          onboardingCompleted: true
        }
      }),
      prisma.match.findUnique({
        where: {
          id: matchId
        },
        include: matchForInvitationInclude
      })
    ]);

    if (!sender) {
      throw new ConnectionDomainError({
        code: "sender_not_found",
        message: "Пользователь не найден.",
        status: 404
      });
    }

    assertUserCanUseProduct(sender);

    if (!match || match.status === "DECLINED" || match.status === "EXPIRED" || match.status === "CLOSED") {
      throw new ConnectionDomainError({
        code: "match_not_available",
        message: "Подбор больше недоступен для приглашения.",
        status: 404
      });
    }

    const participants = resolveInvitationParticipants(senderUserId, match);

    if (!participants.recipientUserId || !participants.sourceRequestId) {
      throw new ConnectionDomainError({
        code: "match_forbidden",
        message: "Этот подбор не принадлежит вашему активному запросу.",
        status: 403
      });
    }

    const sourceRequest =
      participants.sourceRequestId === match.sourceRequest.id
        ? match.sourceRequest
        : match.candidateRequest;

    if (!isActiveRequest(sourceRequest)) {
      throw new ConnectionDomainError({
        code: "source_request_inactive",
        message: "Закрытый или истёкший запрос не может отправлять приглашения.",
        status: 409
      });
    }

    if (participants.targetRequestId) {
      const targetRequest =
        participants.targetRequestId === match.sourceRequest.id
          ? match.sourceRequest
          : match.candidateRequest;

      if (!isActiveRequest(targetRequest)) {
        throw new ConnectionDomainError({
          code: "target_request_inactive",
          message: "Закрытый или истёкший запрос не принимает приглашения.",
          status: 409
        });
      }
    }

    const existing = await findExistingInteraction({
      type: "INVITATION",
      senderUserId,
      recipientUserId: participants.recipientUserId,
      sourceRequestId: participants.sourceRequestId,
      targetRequestId: participants.targetRequestId,
      targetProfileId: participants.targetProfileId,
      matchId
    });

    if (existing) {
      return serializeInteraction(existing, senderUserId);
    }

    const created = await prisma.interaction.create({
      data: {
        type: "INVITATION",
        status: "PENDING",
        scenario: match.scenario,
        matchId,
        sourceRequestId: participants.sourceRequestId,
        targetRequestId: participants.targetRequestId,
        targetProfileId: participants.targetProfileId,
        senderUserId,
        recipientUserId: participants.recipientUserId,
        message: normalizedMessage,
        expiresAt: match.expiresAt ?? sourceRequest?.expiresAt ?? null
      },
      include: interactionInclude
    });

    await analyticsService.track("invitation_sent", {
      interactionId: created.id,
      matchId,
      scenario: match.scenario,
      userId: senderUserId
    });

    return serializeInteraction(created, senderUserId);
  },

  async respondToInteraction(
    userId: string,
    interactionId: string,
    decision: "ACCEPT" | "DECLINE"
  ) {
    const interaction = await prisma.interaction.findUnique({
      where: {
        id: interactionId
      },
      include: interactionInclude
    });

    if (!interaction) {
      throw new ConnectionDomainError({
        code: "interaction_not_found",
        message: "Взаимодействие не найдено.",
        status: 404
      });
    }

    if (interaction.recipientUserId !== userId) {
      throw new ConnectionDomainError({
        code: "interaction_forbidden",
        message: "Ответить может только получатель.",
        status: 403
      });
    }

    if (interaction.status !== "PENDING") {
      throw new ConnectionDomainError({
        code: "interaction_not_pending",
        message: "На это взаимодействие уже ответили.",
        status: 409
      });
    }

    ensureInteractionCanBeAccepted(interaction);

    if (decision === "DECLINE") {
      const updated = await prisma.interaction.update({
        where: {
          id: interaction.id
        },
        data: {
          status: "DECLINED",
          decidedAt: new Date()
        },
        include: interactionInclude
      });

      await analyticsService.track("interaction_declined", {
        interactionId: updated.id,
        type: updated.type,
        userId
      });

      return {
        interaction: serializeInteraction(updated, userId),
        connection: null
      };
    }

    const now = new Date();
    const [userAId, userBId] = [
      interaction.senderUserId,
      interaction.recipientUserId
    ].sort();

    const connection = await prisma.$transaction(async (transaction) => {
      await transaction.interaction.update({
        where: {
          id: interaction.id
        },
        data: {
          status: "ACCEPTED",
          decidedAt: now
        }
      });

      return transaction.connection.create({
        data: {
          interactionId: interaction.id,
          matchId: interaction.matchId,
          scenario: interaction.scenario,
          userAId,
          userBId,
          sourceRequestId: interaction.sourceRequestId,
          targetRequestId: interaction.targetRequestId,
          targetProfileId: interaction.targetProfileId,
          status: "ACTIVE",
          telegramSharedAt: now
        },
        include: connectionInclude
      });
    });

    await analyticsService.track("connection_created", {
      connectionId: connection.id,
      interactionId: interaction.id,
      type: interaction.type,
      scenario: interaction.scenario,
      userId
    });

    return {
      interaction: serializeInteraction(
        {
          ...interaction,
          status: "ACCEPTED",
          decidedAt: now,
          connection
        },
        userId
      ),
      connection: serializeConnection(connection, userId)
    };
  },

  async listForUser(userId: string): Promise<SerializedConnectionsScreenData> {
    const [interactions, connections] = await Promise.all([
      prisma.interaction.findMany({
        where: {
          OR: [{ senderUserId: userId }, { recipientUserId: userId }]
        },
        include: interactionInclude,
        orderBy: {
          createdAt: "desc"
        },
        take: 80
      }),
      prisma.connection.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }]
        },
        include: connectionInclude,
        orderBy: {
          createdAt: "desc"
        },
        take: 80
      })
    ]);

    return {
      incoming: interactions
        .filter(
          (interaction) =>
            interaction.status === "PENDING" && interaction.recipientUserId === userId
        )
        .map((interaction) => serializeInteraction(interaction, userId)),
      outgoing: interactions
        .filter(
          (interaction) =>
            interaction.status === "PENDING" && interaction.senderUserId === userId
        )
        .map((interaction) => serializeInteraction(interaction, userId)),
      active: connections
        .filter((connection) => connection.status === "ACTIVE")
        .map((connection) => serializeConnection(connection, userId, false)),
      archive: interactions
        .filter((interaction) =>
          ["DECLINED", "CANCELLED", "EXPIRED", "ARCHIVED"].includes(
            interaction.status
          )
        )
        .map((interaction) => serializeInteraction(interaction, userId)),
      ended: connections
        .filter((connection) => connection.status !== "ACTIVE")
        .map((connection) => serializeConnection(connection, userId, false))
    };
  },

  async getInteractionForUser(
    userId: string,
    interactionId: string
  ): Promise<SerializedInteractionDetail> {
    const interaction = await prisma.interaction.findUnique({
      where: {
        id: interactionId
      },
      include: interactionInclude
    });

    if (
      !interaction ||
      (interaction.senderUserId !== userId && interaction.recipientUserId !== userId)
    ) {
      throw new ConnectionDomainError({
        code: "interaction_not_found",
        message: "Взаимодействие не найдено.",
        status: 404
      });
    }

    // Determine "other user" id (not viewer)
    const otherUserId =
      interaction.senderUserId === userId
        ? interaction.recipientUserId
        : interaction.senderUserId;

    // Choose request to summarise: for RESPONSE on author's request — sourceRequest (author's own)
    // For INVITATION — sourceRequest (inviter's request) is what recipient is being invited into
    const relevantRequestId =
      interaction.sourceRequestId ?? interaction.targetRequestId;

    let otherProfile = null as Awaited<ReturnType<typeof loadOtherProfile>> | null;
    let requestSummary = null as Awaited<ReturnType<typeof loadRequestSummary>> | null;

    if (otherUserId) {
      otherProfile = await loadOtherProfile(otherUserId);
    }
    if (relevantRequestId) {
      requestSummary = await loadRequestSummary(relevantRequestId);
    }

    return {
      ...serializeInteraction(interaction, userId),
      canAccept:
        interaction.status === "PENDING" && interaction.recipientUserId === userId,
      canDecline:
        interaction.status === "PENDING" && interaction.recipientUserId === userId,
      sourceRequestId: interaction.sourceRequestId,
      targetRequestId: interaction.targetRequestId,
      otherProfile,
      requestSummary
    };
  },

  async getConnectionForUser(
    userId: string,
    connectionId: string
  ): Promise<SerializedConnectionDetail> {
    const connection = await prisma.connection.findUnique({
      where: {
        id: connectionId
      },
      include: connectionInclude
    });

    if (
      !connection ||
      (connection.userAId !== userId && connection.userBId !== userId)
    ) {
      throw new ConnectionDomainError({
        code: "connection_not_found",
        message: "Связь не найдена.",
        status: 404
      });
    }

    return {
      ...serializeConnection(connection, userId, true),
      canOpenTelegram: connection.status === "ACTIVE",
      canEnd: connection.status === "ACTIVE"
    };
  },

  async endConnection(userId: string, connectionId: string) {
    const connection = await prisma.connection.findUnique({
      where: {
        id: connectionId
      },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        status: true
      }
    });

    if (
      !connection ||
      (connection.userAId !== userId && connection.userBId !== userId)
    ) {
      throw new ConnectionDomainError({
        code: "connection_not_found",
        message: "Связь не найдена.",
        status: 404
      });
    }

    if (connection.status !== "ACTIVE") {
      throw new ConnectionDomainError({
        code: "connection_not_active",
        message: "Связь уже завершена.",
        status: 409
      });
    }

    const updated = await prisma.connection.update({
      where: {
        id: connectionId
      },
      data: {
        status: "ENDED",
        endedAt: new Date()
      },
      include: connectionInclude
    });

    await analyticsService.track("connection_ended", {
      connectionId,
      userId
    });

    return serializeConnection(updated, userId);
  }
};
