import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";
import {
  requestInputSchema,
  type RequestInput,
  type SerializedRequest
} from "@/features/requests/lib/request-schema";
import { getDefaultExpiryDaysForScenario } from "@/features/requests/lib/request-options";
import {
  getLevelForProgramId,
  normalizeStoredProgramId
} from "@/features/study/lib/study-catalog";
import { matchingService } from "@/server/services/matching/matching-service";
import { buildActiveRequestDuplicateWhere } from "@/server/services/requests/request-constraints";
import {
  loadStudySubjectLookups,
  resolveSubjectIdsWithCustomNames
} from "@/server/services/study/study-subject-service";

export type RequestActor = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED";
  onboardingCompleted: boolean;
};

const availabilitySlotOrderBy: Prisma.AvailabilitySlotOrderByWithRelationInput[] = [
  { dayOfWeek: "asc" },
  { startMinute: "asc" }
];

const requestInclude = {
  availabilitySlots: {
    orderBy: availabilitySlotOrderBy
  },
  caseDetails: true,
  projectDetails: true,
  studyDetails: {
    include: {
      subject: true
    }
  }
} satisfies Prisma.RequestInclude;

async function loadRequestList(ownerId: string) {
  return prisma.request.findMany({
    where: {
      ownerId,
      status: {
        not: "DELETED"
      }
    },
    include: requestInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

type UserRequestRecord = Awaited<ReturnType<typeof loadRequestList>>[number];

type RequestMutationClient = Pick<
  typeof prisma,
  | "availabilitySlot"
  | "caseRequestDetails"
  | "projectRequestDetails"
  | "request"
  | "subject"
  | "studyRequestDetails"
>;

function addDays(days: number) {
  const result = new Date();
  result.setDate(result.getDate() + days);

  return result;
}

function buildDefaultExpiryDate(scenario: RequestInput["scenario"]) {
  return addDays(getDefaultExpiryDaysForScenario(scenario));
}

function serializeRequest(request: UserRequestRecord): SerializedRequest {
  return {
    id: request.id,
    scenario: request.scenario,
    status: request.status,
    notes: request.notes,
    expiresAt: request.expiresAt.toISOString(),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    lastMatchedAt: request.lastMatchedAt?.toISOString() ?? null,
    closedAt: request.closedAt?.toISOString() ?? null,
    availabilitySlots: request.availabilitySlots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute
    })),
    details: request.caseDetails
      ? {
          type: "CASE",
          eventName: request.caseDetails.eventName,
          deadline: request.caseDetails.deadline?.toISOString() ?? null,
          neededRoles: request.caseDetails.neededRoles,
          teamGapSize: request.caseDetails.teamGapSize,
          preferredFormat: request.caseDetails.preferredFormat
        }
      : request.projectDetails
        ? {
            type: "PROJECT",
            projectTitle: request.projectDetails.projectTitle,
            shortDescription: request.projectDetails.shortDescription,
            stage: request.projectDetails.stage,
            neededRoles: request.projectDetails.neededRoles,
            expectedCommitment: request.projectDetails.expectedCommitment,
            preferredFormat: request.projectDetails.preferredFormat
          }
        : {
            type: "STUDY",
            subjectId: request.studyDetails!.subjectId,
            subjectName: request.studyDetails!.subject.name,
            subjectSlug: request.studyDetails!.subject.slug,
            currentContext: request.studyDetails!.currentContext,
            goal: request.studyDetails!.goal,
            desiredFrequency: request.studyDetails!.desiredFrequency,
            preferredTime: request.studyDetails!.preferredTime,
            preferredFormat: request.studyDetails!.preferredFormat
          }
  };
}

async function loadOwnedRequest(ownerId: string, requestId: string) {
  return prisma.request.findFirst({
    where: {
      id: requestId,
      ownerId,
      status: {
        not: "DELETED"
      }
    },
    include: requestInclude
  });
}

async function assertRequestActorEligibility(actor: RequestActor) {
  if (actor.status !== "ACTIVE") {
    throw new RequestDomainError({
      code: "request_actor_forbidden",
      message: "Профиль и онбординг обязательны для создания запроса.",
      status: 403
    });
  }

  if (!actor.onboardingCompleted) {
    throw new RequestDomainError({
      code: "request_onboarding_required",
      message: "Сначала завершите онбординг профиля.",
      status: 409
    });
  }
}

async function syncExpiredRequestsForUser(ownerId: string) {
  await prisma.request.updateMany({
    where: {
      ownerId,
      status: "ACTIVE",
      expiresAt: {
        lte: new Date()
      }
    },
    data: {
      status: "EXPIRED"
    }
  });
}

async function assertNoActiveScenarioDuplicate(
  ownerId: string,
  scenario: RequestInput["scenario"],
  excludeRequestId?: string
) {
  const duplicate = await prisma.request.findFirst({
    where: buildActiveRequestDuplicateWhere(ownerId, scenario, excludeRequestId),
    select: {
      id: true
    }
  });

  if (duplicate) {
    throw new RequestDomainError({
      code: "request_active_duplicate",
      message:
        "У вас уже есть активный запрос этого сценария. Измените его или сначала архивируйте.",
      status: 409,
      meta: {
        requestId: duplicate.id
      }
    });
  }
}

async function replaceAvailabilitySlots(
  transaction: RequestMutationClient,
  requestId: string,
  availabilitySlots: RequestInput["availabilitySlots"]
) {
  await transaction.availabilitySlot.deleteMany({
    where: {
      requestId
    }
  });

  if (availabilitySlots.length === 0) {
    return;
  }

  await transaction.availabilitySlot.createMany({
    data: availabilitySlots.map((slot) => ({
      requestId,
      dayOfWeek: slot.dayOfWeek,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute
    }))
  });
}

async function replaceScenarioDetails(
  transaction: RequestMutationClient,
  requestId: string,
  input: RequestInput
) {
  await Promise.all([
    transaction.caseRequestDetails.deleteMany({
      where: {
        requestId
      }
    }),
    transaction.projectRequestDetails.deleteMany({
      where: {
        requestId
      }
    }),
    transaction.studyRequestDetails.deleteMany({
      where: {
        requestId
      }
    })
  ]);

  if (input.scenario === "CASE") {
    await transaction.caseRequestDetails.create({
      data: {
        requestId,
        eventName: input.details.eventName,
        deadline: input.details.deadline ? new Date(input.details.deadline) : null,
        neededRoles: input.details.neededRoles,
        teamGapSize: input.details.teamGapSize,
        preferredFormat: input.details.preferredFormat
      }
    });

    return;
  }

  if (input.scenario === "PROJECT") {
    await transaction.projectRequestDetails.create({
      data: {
        requestId,
        projectTitle: input.details.projectTitle,
        shortDescription: input.details.shortDescription,
        stage: input.details.stage,
        neededRoles: input.details.neededRoles,
        expectedCommitment: input.details.expectedCommitment,
        preferredFormat: input.details.preferredFormat
      }
    });

    return;
  }

  const resolvedSubjectIds = await resolveSubjectIdsWithCustomNames(transaction, {
    subjectIds: input.details.subjectId ? [input.details.subjectId] : [],
    customSubjectNames: input.details.customSubjectName
      ? [input.details.customSubjectName]
      : []
  });

  const subjectId = resolvedSubjectIds[0];

  if (!subjectId) {
    throw new Error("Выберите предмет для учебного запроса.");
  }

  const subjectCount = await transaction.subject.count({
    where: {
      id: {
        in: [subjectId]
      }
    }
  });

  if (subjectCount !== 1) {
    throw new Error("Предмет для совместной учёбы не найден.");
  }

  await transaction.studyRequestDetails.create({
    data: {
      requestId,
      subjectId,
      currentContext: input.details.currentContext,
      goal: input.details.goal,
      desiredFrequency: input.details.desiredFrequency,
      preferredTime: input.details.preferredTime,
      preferredFormat: input.details.preferredFormat
    }
  });
}

async function buildRequestLookupPayload(ownerId: string) {
  await syncExpiredRequestsForUser(ownerId);

  const [requests, subjects, viewer] = await Promise.all([
    loadRequestList(ownerId),
    loadStudySubjectLookups(prisma),
    prisma.user.findUnique({
      where: {
        id: ownerId
      },
      select: {
        profile: {
          select: {
            program: true,
            courseYear: true
          }
        }
      }
    })
  ]);

  const normalizedProgramId = normalizeStoredProgramId(viewer?.profile?.program);

  return {
    requests: requests.map(serializeRequest),
    subjects,
    studyDefaults: {
      studyLevel: getLevelForProgramId(normalizedProgramId),
      programId:
        normalizedProgramId ?? "ba-international-business-economics",
      courseYear: viewer?.profile?.courseYear ?? 1
    }
  };
}

export class RequestDomainError extends Error {
  code: string;
  status: number;
  meta?: Record<string, string>;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    meta?: Record<string, string>;
  }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
    this.meta = params.meta;
  }
}

export interface RequestService {
  getComposerData(ownerId: string): Promise<{
    requests: SerializedRequest[];
    subjects: {
      id: string;
      name: string;
      slug: string;
      levelId: "BACHELOR" | "MASTER" | null;
      programId: string | null;
      courseYear: number | null;
      kind: "PROGRAM" | "ENGLISH" | "CUSTOM" | "OTHER";
      englishLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;
      searchText: string;
    }[];
    studyDefaults: {
      studyLevel: "BACHELOR" | "MASTER";
      programId: string;
      courseYear: number;
    };
  }>;
  listForUser(ownerId: string): Promise<SerializedRequest[]>;
  getById(ownerId: string, requestId: string): Promise<SerializedRequest>;
  create(actor: RequestActor, rawInput: unknown): Promise<SerializedRequest>;
  update(actor: RequestActor, requestId: string, rawInput: unknown): Promise<SerializedRequest>;
  renew(actor: RequestActor, requestId: string): Promise<SerializedRequest>;
  archive(actor: RequestActor, requestId: string): Promise<SerializedRequest>;
}

export const requestService: RequestService = {
  async getComposerData(ownerId) {
    return buildRequestLookupPayload(ownerId);
  },

  async listForUser(ownerId) {
    const payload = await buildRequestLookupPayload(ownerId);

    return payload.requests;
  },

  async getById(ownerId, requestId) {
    await syncExpiredRequestsForUser(ownerId);

    const request = await loadOwnedRequest(ownerId, requestId);

    if (!request) {
      throw new RequestDomainError({
        code: "request_not_found",
        message: "Запрос не найден.",
        status: 404
      });
    }

    return serializeRequest(request);
  },

  async create(actor, rawInput) {
    await assertRequestActorEligibility(actor);
    await syncExpiredRequestsForUser(actor.id);

    const input = requestInputSchema.parse(rawInput);

    await assertNoActiveScenarioDuplicate(actor.id, input.scenario);

    const created = await prisma.$transaction(async (transaction) => {
      const request = await transaction.request.create({
        data: {
          ownerId: actor.id,
          scenario: input.scenario,
          status: "ACTIVE",
          notes: input.notes,
          expiresAt: buildDefaultExpiryDate(input.scenario)
        }
      });

      await replaceAvailabilitySlots(transaction, request.id, input.availabilitySlots);
      await replaceScenarioDetails(transaction, request.id, input);

      return transaction.request.findUniqueOrThrow({
        where: {
          id: request.id
        },
        include: requestInclude
      });
    });

    await matchingService.recomputeForRequest(created.id);

    const refreshedRequest = await loadOwnedRequest(actor.id, created.id);

    return serializeRequest(refreshedRequest ?? created);
  },

  async update(actor, requestId, rawInput) {
    await assertRequestActorEligibility(actor);
    await syncExpiredRequestsForUser(actor.id);

    const existingRequest = await loadOwnedRequest(actor.id, requestId);

    if (!existingRequest) {
      throw new RequestDomainError({
        code: "request_not_found",
        message: "Запрос не найден.",
        status: 404
      });
    }

    if (existingRequest.status !== "ACTIVE") {
      throw new RequestDomainError({
        code: "request_not_editable",
        message:
          "Изменять можно только активный запрос. Для старого запроса используйте возобновление.",
        status: 409
      });
    }

    const input = requestInputSchema.parse(rawInput);

    if (input.scenario !== existingRequest.scenario) {
      throw new RequestDomainError({
        code: "request_scenario_locked",
        message: "Запрос другого сценария редактировать нельзя.",
        status: 409
      });
    }

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.request.update({
        where: {
          id: requestId
        },
        data: {
          notes: input.notes
        }
      });

      await replaceAvailabilitySlots(transaction, requestId, input.availabilitySlots);
      await replaceScenarioDetails(transaction, requestId, input);

      return transaction.request.findUniqueOrThrow({
        where: {
          id: requestId
        },
        include: requestInclude
      });
    });

    await matchingService.recomputeForRequest(updated.id);

    const refreshedRequest = await loadOwnedRequest(actor.id, updated.id);

    return serializeRequest(refreshedRequest ?? updated);
  },

  async renew(actor, requestId) {
    await assertRequestActorEligibility(actor);
    await syncExpiredRequestsForUser(actor.id);

    const existingRequest = await loadOwnedRequest(actor.id, requestId);

    if (!existingRequest) {
      throw new RequestDomainError({
        code: "request_not_found",
        message: "Запрос не найден.",
        status: 404
      });
    }

    if (existingRequest.status !== "ACTIVE") {
      await assertNoActiveScenarioDuplicate(
        actor.id,
        existingRequest.scenario,
        existingRequest.id
      );
    }

    const renewed = await prisma.request.update({
      where: {
        id: requestId
      },
      data: {
        status: "ACTIVE",
        closedAt: null,
        expiresAt: buildDefaultExpiryDate(existingRequest.scenario)
      },
      include: requestInclude
    });

    await matchingService.recomputeForRequest(renewed.id);

    const refreshedRequest = await loadOwnedRequest(actor.id, renewed.id);

    return serializeRequest(refreshedRequest ?? renewed);
  },

  async archive(actor, requestId) {
    await assertRequestActorEligibility(actor);
    await syncExpiredRequestsForUser(actor.id);

    const existingRequest = await loadOwnedRequest(actor.id, requestId);

    if (!existingRequest) {
      throw new RequestDomainError({
        code: "request_not_found",
        message: "Запрос не найден.",
        status: 404
      });
    }

    if (existingRequest.status === "CLOSED") {
      return serializeRequest(existingRequest);
    }

    const archived = await prisma.request.update({
      where: {
        id: requestId
      },
      data: {
        status: "CLOSED",
        closedAt: new Date()
      },
      include: requestInclude
    });

    return serializeRequest(archived);
  }
};
