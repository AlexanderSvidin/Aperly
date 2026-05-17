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
import {
  loadStudySubjectLookups,
  resolveSubjectIdsWithCustomNames
} from "@/server/services/study/study-subject-service";
import { analyticsService } from "@/server/services/analytics/analytics-service";

export type RequestActor = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED";
  onboardingCompleted: boolean;
};

const availabilitySlotOrderBy: Prisma.AvailabilitySlotOrderByWithRelationInput[] = [
  { dayOfWeek: "asc" },
  { startMinute: "asc" }
];

async function trackRequestActionCompleted(
  action: "archive" | "close" | "create" | "pause" | "renew" | "update",
  actorId: string,
  request: Pick<SerializedRequest, "id" | "scenario" | "status">
) {
  await analyticsService.track("request_action_completed", {
    action,
    requestId: request.id,
    scenario: request.scenario,
    status: request.status,
    userId: actorId
  });
}

const requestInclude = {
  availabilitySlots: {
    orderBy: availabilitySlotOrderBy
  },
  caseDetails: true,
  projectDetails: true,
  activityDetails: true,
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

type StudySubjectSummary = {
  id: string;
  name: string;
  slug: string;
};

type RequestMutationClient = Pick<
  typeof prisma,
  | "availabilitySlot"
  | "caseRequestDetails"
  | "projectRequestDetails"
  | "activityRequestDetails"
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

function getStudySubjectIds(request: UserRequestRecord) {
  if (!request.studyDetails) {
    return [];
  }

  const subjectIds =
    request.studyDetails.subjects.length > 0
      ? request.studyDetails.subjects
      : request.studyDetails.subjectId
        ? [request.studyDetails.subjectId]
        : [];

  return [...new Set(subjectIds.filter(Boolean))];
}

async function buildSubjectMapForRequests(requests: UserRequestRecord[]) {
  const subjectIds = [
    ...new Set(requests.flatMap((request) => getStudySubjectIds(request)))
  ];

  if (subjectIds.length === 0) {
    return new Map<string, StudySubjectSummary>();
  }

  const subjects = await prisma.subject.findMany({
    where: {
      id: {
        in: subjectIds
      }
    },
    select: {
      id: true,
      name: true,
      slug: true
    }
  });

  return new Map(subjects.map((subject) => [subject.id, subject]));
}

function buildStudySubjects(
  request: UserRequestRecord,
  subjectById: Map<string, StudySubjectSummary>
) {
  const fallbackSubject = request.studyDetails?.subject
    ? {
        id: request.studyDetails.subject.id,
        name: request.studyDetails.subject.name,
        slug: request.studyDetails.subject.slug
      }
    : null;
  const subjects = getStudySubjectIds(request)
    .map((subjectId) => subjectById.get(subjectId))
    .filter(Boolean) as StudySubjectSummary[];

  if (subjects.length > 0) {
    return subjects;
  }

  return fallbackSubject ? [fallbackSubject] : [];
}

function serializeRequest(
  request: UserRequestRecord,
  subjectById = new Map<string, StudySubjectSummary>()
): SerializedRequest {
  const studySubjects = buildStudySubjects(request, subjectById);
  const primaryStudySubject =
    studySubjects[0] ??
    (request.studyDetails?.subject
      ? {
          id: request.studyDetails.subject.id,
          name: request.studyDetails.subject.name,
          slug: request.studyDetails.subject.slug
        }
      : {
          id: "",
          name: "Совместная учёба",
          slug: "study"
        });

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
        : request.activityDetails
          ? {
              type: "ACTIVITY",
              title: request.activityDetails.title,
              activitySubtype: request.activityDetails.activitySubtype,
              time: request.activityDetails.time?.toISOString() ?? null,
              preferredFormat: request.activityDetails.preferredFormat,
              location: request.activityDetails.location,
              peopleCount: request.activityDetails.peopleCount,
              recurrence: request.activityDetails.recurrence,
              comment: request.activityDetails.comment
            }
        : {
            type: "STUDY",
            subjectId: primaryStudySubject.id,
            subjectName: primaryStudySubject.name,
            subjectSlug: primaryStudySubject.slug,
            subjects: studySubjects,
            currentContext: request.studyDetails!.currentContext,
            goal: request.studyDetails!.goal,
            desiredFrequency: request.studyDetails!.desiredFrequency,
            preferredTime: request.studyDetails!.preferredTime,
            preferredFormat: request.studyDetails!.preferredFormat
          }
  };
}

async function serializeRequestWithSubjects(request: UserRequestRecord) {
  const subjectById = await buildSubjectMapForRequests([request]);

  return serializeRequest(request, subjectById);
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
    }),
    transaction.activityRequestDetails.deleteMany({
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

  if (input.scenario === "ACTIVITY") {
    await transaction.activityRequestDetails.create({
      data: {
        requestId,
        title: input.details.title,
        activitySubtype: input.details.activitySubtype,
        time: input.details.time ? new Date(input.details.time) : null,
        preferredFormat: input.details.preferredFormat,
        location: input.details.location?.trim() || null,
        peopleCount: input.details.peopleCount,
        recurrence: input.details.recurrence,
        comment: input.details.comment?.trim() || null
      }
    });

    return;
  }

  const resolvedSubjectIds = await resolveSubjectIdsWithCustomNames(transaction, {
    subjectIds: input.details.subjectIds,
    customSubjectNames: input.details.customSubjectNames
  });

  const subjectId = resolvedSubjectIds[0] ?? null;

  if (resolvedSubjectIds.length > 0) {
    const subjectCount = await transaction.subject.count({
      where: {
        id: {
          in: resolvedSubjectIds
        }
      }
    });

    if (subjectCount !== resolvedSubjectIds.length) {
      throw new Error("Предмет для совместной учёбы не найден.");
    }
  }

  await transaction.studyRequestDetails.create({
    data: {
      requestId,
      subjectId,
      subjects: resolvedSubjectIds,
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
  const subjectById = new Map(
    subjects.map((subject) => [
      subject.id,
      {
        id: subject.id,
        name: subject.name,
        slug: subject.slug
      }
    ])
  );

  return {
    requests: requests.map((request) => serializeRequest(request, subjectById)),
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
      kind: "PROGRAM" | "CUSTOM" | "OTHER";
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
  pause(actor: RequestActor, requestId: string): Promise<SerializedRequest>;
  renew(actor: RequestActor, requestId: string): Promise<SerializedRequest>;
  close(actor: RequestActor, requestId: string): Promise<SerializedRequest>;
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

    return serializeRequestWithSubjects(request);
  },

  async create(actor, rawInput) {
    await assertRequestActorEligibility(actor);
    await syncExpiredRequestsForUser(actor.id);

    const input = requestInputSchema.parse(rawInput);

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
    const serialized = await serializeRequestWithSubjects(refreshedRequest ?? created);
    await trackRequestActionCompleted("create", actor.id, serialized);

    return serialized;
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
    const serialized = await serializeRequestWithSubjects(refreshedRequest ?? updated);
    await trackRequestActionCompleted("update", actor.id, serialized);

    return serialized;
  },

  async pause(actor, requestId) {
    await assertRequestActorEligibility(actor);
    await syncExpiredRequestsForUser(actor.id);

    const existingRequest = await loadOwnedRequest(actor.id, requestId);

    if (!existingRequest) {
      throw new RequestDomainError({
        code: "request_not_found",
        message: "Р—Р°РїСЂРѕСЃ РЅРµ РЅР°Р№РґРµРЅ.",
        status: 404
      });
    }

    if (existingRequest.status !== "ACTIVE") {
      throw new RequestDomainError({
        code: "request_not_pausable",
        message: "РџРѕСЃС‚Р°РІРёС‚СЊ РЅР° РїР°СѓР·Сѓ РјРѕР¶РЅРѕ С‚РѕР»СЊРєРѕ Р°РєС‚РёРІРЅС‹Р№ Р·Р°РїСЂРѕСЃ.",
        status: 409
      });
    }

    const paused = await prisma.request.update({
      where: {
        id: requestId
      },
      data: {
        status: "PAUSED"
      },
      include: requestInclude
    });

    await matchingService.recomputeForRequest(paused.id);

    const serialized = await serializeRequestWithSubjects(paused);
    await trackRequestActionCompleted("pause", actor.id, serialized);

    return serialized;
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

    if (
      existingRequest.status !== "PAUSED" &&
      existingRequest.status !== "EXPIRED"
    ) {
      throw new RequestDomainError({
        code: "request_not_resumable",
        message: "Р’РѕР·РѕР±РЅРѕРІРёС‚СЊ РјРѕР¶РЅРѕ С‚РѕР»СЊРєРѕ Р·Р°РїСЂРѕСЃ РЅР° РїР°СѓР·Рµ.",
        status: 409
      });
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
    const serialized = await serializeRequestWithSubjects(refreshedRequest ?? renewed);
    await trackRequestActionCompleted("renew", actor.id, serialized);

    return serialized;
  },

  async close(actor, requestId) {
    await assertRequestActorEligibility(actor);
    await syncExpiredRequestsForUser(actor.id);

    const existingRequest = await loadOwnedRequest(actor.id, requestId);

    if (!existingRequest) {
      throw new RequestDomainError({
        code: "request_not_found",
        message: "Р—Р°РїСЂРѕСЃ РЅРµ РЅР°Р№РґРµРЅ.",
        status: 404
      });
    }

    if (existingRequest.status === "CLOSED") {
      const serialized = await serializeRequestWithSubjects(existingRequest);
      await trackRequestActionCompleted("close", actor.id, serialized);

      return serialized;
    }

    if (
      existingRequest.status === "ARCHIVED" ||
      existingRequest.status === "DELETED"
    ) {
      throw new RequestDomainError({
        code: "request_archived",
        message: "РђСЂС…РёРІРЅС‹Р№ Р·Р°РїСЂРѕСЃ РЅРµР»СЊР·СЏ Р·Р°РєСЂС‹С‚СЊ.",
        status: 409
      });
    }

    const closed = await prisma.request.update({
      where: {
        id: requestId
      },
      data: {
        status: "CLOSED",
        closedAt: new Date()
      },
      include: requestInclude
    });

    await matchingService.recomputeForRequest(closed.id);

    const serialized = await serializeRequestWithSubjects(closed);
    await trackRequestActionCompleted("close", actor.id, serialized);

    return serialized;
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

    if (
      existingRequest.status === "ARCHIVED" ||
      existingRequest.status === "DELETED"
    ) {
      const serialized = await serializeRequestWithSubjects(existingRequest);
      await trackRequestActionCompleted("archive", actor.id, serialized);

      return serialized;
    }

    const archived = await prisma.request.update({
      where: {
        id: requestId
      },
      data: {
        status: "ARCHIVED",
        closedAt: new Date()
      },
      include: requestInclude
    });

    await matchingService.recomputeForRequest(archived.id);

    const serialized = await serializeRequestWithSubjects(archived);
    await trackRequestActionCompleted("archive", actor.id, serialized);

    return serialized;
  }
};
