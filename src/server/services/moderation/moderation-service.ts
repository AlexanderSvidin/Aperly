import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { analyticsService } from "@/server/services/analytics/analytics-service";
import type {
  ModerationUserAction,
  SerializedAdminAction,
  SerializedAdminDashboardData,
  SerializedAdminReport,
  SerializedAdminRequest,
  SerializedAdminUser
} from "@/features/admin/lib/admin-types";

const requestInclude = {
  owner: {
    select: {
      firstName: true,
      lastName: true,
      profile: {
        select: {
          fullName: true
        }
      }
    }
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
      }
    }
  }
} satisfies Prisma.RequestInclude;

const userInclude = {
  profile: {
    select: {
      fullName: true,
      program: true
    }
  },
  requests: {
    select: {
      id: true,
      status: true
    }
  },
  targetReports: {
    where: {
      status: {
        in: ["OPEN", "IN_REVIEW"]
      }
    },
    select: {
      id: true
    }
  }
} satisfies Prisma.UserInclude;

const reportInclude = {
  reporter: {
    select: {
      firstName: true,
      lastName: true,
      profile: {
        select: {
          fullName: true
        }
      }
    }
  },
  targetUser: {
    select: {
      firstName: true,
      lastName: true,
      profile: {
        select: {
          fullName: true
        }
      }
    }
  },
  request: {
    include: requestInclude
  }
} satisfies Prisma.ReportInclude;

const actionInclude = {
  adminUser: {
    select: {
      firstName: true,
      lastName: true,
      profile: {
        select: {
          fullName: true
        }
      }
    }
  },
  targetUser: {
    select: {
      firstName: true,
      lastName: true,
      profile: {
        select: {
          fullName: true
        }
      }
    }
  },
  request: {
    include: requestInclude
  }
} satisfies Prisma.AdminActionInclude;

type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>;
type RequestRecord = Prisma.RequestGetPayload<{ include: typeof requestInclude }>;
type ReportRecord = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;
type ActionRecord = Prisma.AdminActionGetPayload<{ include: typeof actionInclude }>;

type CreateReportInput = {
  reporterUserId: string;
  targetUserId?: string | null;
  matchId?: string | null;
  chatId?: string | null;
  requestId?: string | null;
  reasonCode: string;
  details?: string | null;
};

type MatchAccessRecord = Prisma.MatchGetPayload<{
  include: {
    sourceRequest: {
      select: {
        ownerId: true;
      };
    };
    candidateRequest: {
      select: {
        ownerId: true;
      };
    };
    candidateProfile: {
      select: {
        userId: true;
      };
    };
  };
}>;

function buildDisplayName(input: {
  firstName: string;
  lastName: string | null;
  profile: { fullName: string | null } | null;
}) {
  return (
    input.profile?.fullName ||
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
    "Пользователь"
  );
}

function buildRequestTitle(request: RequestRecord | ReportRecord["request"] | ActionRecord["request"]) {
  if (!request) {
    return null;
  }

  if (request.caseDetails) {
    return request.caseDetails.eventName;
  }

  if (request.projectDetails) {
    return request.projectDetails.projectTitle;
  }

  return request.studyDetails?.subject.name ?? "StudyBuddy";
}

function buildReportContextLabel(report: ReportRecord) {
  const requestTitle = buildRequestTitle(report.request);

  if (requestTitle) {
    return `Запрос: ${requestTitle}`;
  }

  if (report.chatId) {
    return `Чат ${report.chatId.slice(0, 8)}`;
  }

  if (report.matchId) {
    return `Мэтч ${report.matchId.slice(0, 8)}`;
  }

  return null;
}

function serializeAdminUser(user: UserRecord): SerializedAdminUser {
  return {
    id: user.id,
    displayName: buildDisplayName(user),
    username: user.username,
    role: user.role,
    status: user.status,
    onboardingCompleted: user.onboardingCompleted,
    program: user.profile?.program ?? null,
    activeRequestCount: user.requests.filter((request) => request.status === "ACTIVE")
      .length,
    openReportCount: user.targetReports.length,
    createdAt: user.createdAt.toISOString(),
    blockedAt: user.blockedAt?.toISOString() ?? null
  };
}

function serializeAdminRequest(request: RequestRecord): SerializedAdminRequest {
  return {
    id: request.id,
    title: buildRequestTitle(request) ?? "Запрос",
    scenario: request.scenario,
    status: request.status,
    ownerDisplayName: buildDisplayName(request.owner),
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString()
  };
}

function serializeAdminReport(report: ReportRecord): SerializedAdminReport {
  return {
    id: report.id,
    status: report.status,
    reasonCode: report.reasonCode,
    details: report.details,
    reporterDisplayName: buildDisplayName(report.reporter),
    targetUserDisplayName: report.targetUser
      ? buildDisplayName(report.targetUser)
      : null,
    contextLabel: buildReportContextLabel(report),
    createdAt: report.createdAt.toISOString(),
    resolvedAt: report.resolvedAt?.toISOString() ?? null
  };
}

function serializeAdminAction(action: ActionRecord): SerializedAdminAction {
  return {
    id: action.id,
    actionType: action.actionType,
    adminDisplayName: buildDisplayName(action.adminUser),
    targetUserDisplayName: action.targetUser
      ? buildDisplayName(action.targetUser)
      : null,
    requestTitle: buildRequestTitle(action.request),
    reportId: action.reportId,
    notes: action.notes,
    createdAt: action.createdAt.toISOString()
  };
}

function buildUserStatusUpdate(
  action: ModerationUserAction,
  now: Date
): {
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  blockedAt: Date | null;
  actionType: "BLOCK_USER" | "DISABLE_USER" | "UNBLOCK_USER";
} {
  if (action === "BLOCK") {
    return {
      status: "BLOCKED",
      blockedAt: now,
      actionType: "BLOCK_USER"
    };
  }

  if (action === "DISABLE") {
    return {
      status: "INACTIVE",
      blockedAt: null,
      actionType: "DISABLE_USER"
    };
  }

  return {
    status: "ACTIVE",
    blockedAt: null,
    actionType: "UNBLOCK_USER"
  };
}

function resolveMatchCounterpartyUserId(
  match: MatchAccessRecord,
  reporterUserId: string
) {
  const sourceOwnerId = match.sourceRequest.ownerId;
  const candidateOwnerId = match.candidateRequest?.ownerId ?? null;
  const candidateProfileUserId = match.candidateProfile?.userId ?? null;

  if (sourceOwnerId === reporterUserId) {
    return candidateOwnerId ?? candidateProfileUserId;
  }

  if (candidateOwnerId === reporterUserId || candidateProfileUserId === reporterUserId) {
    return sourceOwnerId;
  }

  return null;
}

async function assertAdmin(adminUserId: string) {
  const admin = await prisma.user.findUnique({
    where: {
      id: adminUserId
    },
    select: {
      id: true,
      role: true,
      status: true
    }
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new ModerationDomainError({
      code: "moderation_forbidden",
      message: "Действие доступно только администратору.",
      status: 403
    });
  }

  if (admin.status === "DELETED") {
    throw new ModerationDomainError({
      code: "moderation_admin_deleted",
      message: "Аккаунт администратора недоступен.",
      status: 403
    });
  }

  return admin;
}

export class ModerationDomainError extends Error {
  code: string;
  status: number;

  constructor(params: { code: string; message: string; status: number }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
  }
}

export interface ModerationService {
  getDashboard(adminUserId: string): Promise<SerializedAdminDashboardData>;
  createReport(input: CreateReportInput): Promise<{ id: string; status: "OPEN" }>;
  updateUserStatus(
    adminUserId: string,
    targetUserId: string,
    action: ModerationUserAction,
    notes?: string
  ): Promise<{ userId: string; status: SerializedAdminUser["status"] }>;
  resolveReport(
    adminUserId: string,
    reportId: string,
    notes?: string
  ): Promise<SerializedAdminReport>;
}

export const moderationService: ModerationService = {
  async getDashboard(adminUserId) {
    await assertAdmin(adminUserId);

    const [overview, users, requests, reports, actions] = await Promise.all([
      Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            status: "BLOCKED"
          }
        }),
        prisma.report.count({
          where: {
            status: {
              in: ["OPEN", "IN_REVIEW"]
            }
          }
        }),
        prisma.request.count({
          where: {
            status: "ACTIVE"
          }
        })
      ]),
      prisma.user.findMany({
        include: userInclude,
        orderBy: [{ createdAt: "desc" }],
        take: 12
      }),
      prisma.request.findMany({
        include: requestInclude,
        where: {
          status: {
            not: "DELETED"
          }
        },
        orderBy: [{ createdAt: "desc" }],
        take: 10
      }),
      prisma.report.findMany({
        include: reportInclude,
        orderBy: [{ createdAt: "desc" }],
        take: 10
      }),
      prisma.adminAction.findMany({
        include: actionInclude,
        orderBy: [{ createdAt: "desc" }],
        take: 10
      })
    ]);

    const [totalUsers, blockedUsers, openReports, activeRequests] = overview;

    return {
      overview: {
        totalUsers,
        blockedUsers,
        openReports,
        activeRequests
      },
      users: users.map(serializeAdminUser),
      requests: requests.map(serializeAdminRequest),
      reports: reports.map(serializeAdminReport),
      actions: actions.map(serializeAdminAction)
    };
  },

  async createReport(input) {
    const reporter = await prisma.user.findUnique({
      where: {
        id: input.reporterUserId
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!reporter || reporter.status === "DELETED") {
      throw new ModerationDomainError({
        code: "reporter_not_found",
        message: "Не удалось создать репорт для этого пользователя.",
        status: 404
      });
    }

    let targetUserId = input.targetUserId ?? null;
    let matchId = input.matchId ?? null;
    let chatId = input.chatId ?? null;
    let requestId = input.requestId ?? null;

    if (!targetUserId && !matchId && !chatId && !requestId) {
      throw new ModerationDomainError({
        code: "report_context_required",
        message: "Нужно указать пользователя или контекст репорта.",
        status: 400
      });
    }

    if (chatId) {
      const chat = await prisma.chat.findUnique({
        where: {
          id: chatId
        },
        select: {
          id: true,
          userAId: true,
          userBId: true,
          matchId: true
        }
      });

      if (!chat) {
        throw new ModerationDomainError({
          code: "report_chat_not_found",
          message: "Чат для репорта не найден.",
          status: 404
        });
      }

      if (chat.userAId !== input.reporterUserId && chat.userBId !== input.reporterUserId) {
        throw new ModerationDomainError({
          code: "report_chat_forbidden",
          message: "Нельзя отправить репорт вне доступного чата.",
          status: 403
        });
      }

      const inferredTargetUserId =
        chat.userAId === input.reporterUserId ? chat.userBId : chat.userAId;

      if (targetUserId && targetUserId !== inferredTargetUserId) {
        throw new ModerationDomainError({
          code: "report_target_mismatch",
          message: "Контекст чата и выбранный пользователь не совпадают.",
          status: 409
        });
      }

      targetUserId = inferredTargetUserId;
      matchId = matchId ?? chat.matchId;
    }

    if (matchId) {
      const match = await prisma.match.findUnique({
        where: {
          id: matchId
        },
        include: {
          sourceRequest: {
            select: {
              ownerId: true
            }
          },
          candidateRequest: {
            select: {
              ownerId: true
            }
          },
          candidateProfile: {
            select: {
              userId: true
            }
          }
        }
      });

      if (!match) {
        throw new ModerationDomainError({
          code: "report_match_not_found",
          message: "Мэтч для репорта не найден.",
          status: 404
        });
      }

      const inferredTargetUserId = resolveMatchCounterpartyUserId(
        match,
        input.reporterUserId
      );

      if (!inferredTargetUserId) {
        throw new ModerationDomainError({
          code: "report_match_forbidden",
          message: "Нельзя отправить репорт вне доступного мэтча.",
          status: 403
        });
      }

      if (targetUserId && targetUserId !== inferredTargetUserId) {
        throw new ModerationDomainError({
          code: "report_target_mismatch",
          message: "Контекст мэтча и выбранный пользователь не совпадают.",
          status: 409
        });
      }

      targetUserId = inferredTargetUserId;
    }

    if (requestId) {
      const request = await prisma.request.findUnique({
        where: {
          id: requestId
        },
        select: {
          id: true
        }
      });

      if (!request) {
        throw new ModerationDomainError({
          code: "report_request_not_found",
          message: "Запрос для репорта не найден.",
          status: 404
        });
      }
    }

    if (targetUserId === input.reporterUserId) {
      throw new ModerationDomainError({
        code: "report_self_forbidden",
        message: "Нельзя отправить репорт на самого себя.",
        status: 409
      });
    }

    const report = await prisma.report.create({
      data: {
        reporterUserId: input.reporterUserId,
        targetUserId,
        matchId,
        chatId,
        requestId,
        reasonCode: input.reasonCode,
        details: input.details ?? null,
        status: "OPEN"
      },
      select: {
        id: true,
        status: true
      }
    });

    return {
      id: report.id,
      status: "OPEN"
    };
  },

  async updateUserStatus(adminUserId, targetUserId, action, notes) {
    await assertAdmin(adminUserId);

    if (adminUserId === targetUserId) {
      throw new ModerationDomainError({
        code: "moderation_self_action_forbidden",
        message: "Администратор не может менять собственный статус через moderation UI.",
        status: 409
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: targetUserId
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!targetUser) {
      throw new ModerationDomainError({
        code: "moderation_target_not_found",
        message: "Пользователь для moderation не найден.",
        status: 404
      });
    }

    const now = new Date();
    const update = buildUserStatusUpdate(action, now);

    const updatedUser = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: {
          id: targetUserId
        },
        data: {
          status: update.status,
          blockedAt: update.blockedAt
        },
        select: {
          id: true,
          status: true
        }
      });

      if (action !== "UNBLOCK") {
        await transaction.chat.updateMany({
          where: {
            OR: [{ userAId: targetUserId }, { userBId: targetUserId }],
            status: {
              in: ["ACTIVE", "STALE"]
            }
          },
          data: {
            status: "BLOCKED",
            closedAt: now
          }
        });
      }

      await transaction.adminAction.create({
        data: {
          adminUserId,
          actionType: update.actionType,
          targetUserId,
          notes: notes?.trim() || null
        }
      });

      return user;
    });

    if (action === "BLOCK") {
      await analyticsService.track("admin_block_user", {
        adminUserId,
        targetUserId
      });
    }

    return {
      userId: updatedUser.id,
      status: updatedUser.status
    };
  },

  async resolveReport(adminUserId, reportId, notes) {
    await assertAdmin(adminUserId);

    const existingReport = await prisma.report.findUnique({
      where: {
        id: reportId
      },
      include: reportInclude
    });

    if (!existingReport) {
      throw new ModerationDomainError({
        code: "report_not_found",
        message: "Репорт не найден.",
        status: 404
      });
    }

    if (
      existingReport.status === "RESOLVED" ||
      existingReport.status === "DISMISSED"
    ) {
      return serializeAdminReport(existingReport);
    }

    const now = new Date();

    const resolvedReport = await prisma.$transaction(async (transaction) => {
      await transaction.adminAction.create({
        data: {
          adminUserId,
          actionType: "RESOLVE_REPORT",
          reportId,
          targetUserId: existingReport.targetUserId,
          requestId: existingReport.requestId,
          notes: notes?.trim() || null
        }
      });

      return transaction.report.update({
        where: {
          id: reportId
        },
        data: {
          status: "RESOLVED",
          resolvedByAdminId: adminUserId,
          resolvedAt: now
        },
        include: reportInclude
      });
    });

    return serializeAdminReport(resolvedReport);
  }
};
