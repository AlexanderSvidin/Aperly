import type { Prisma, ScenarioType } from "@prisma/client";

import type {
  SerializedHomeFeedData,
  SerializedHomeOpportunity
} from "@/features/home/lib/home-types";
import { buildHomePrimaryCta } from "@/server/services/home/home-presenters";
import {
  collaborationRoleOptions,
  commitmentOptions,
  preferredTimeOptions,
  projectStageOptions,
  requestFormatOptions,
  studyFrequencyOptions
} from "@/features/requests/lib/request-options";
import { getProgramLabel } from "@/features/study/lib/study-catalog";
import { prisma } from "@/server/db/client";

const HOME_FEED_LIMIT = 30;

const scenarioOrder: ScenarioType[] = ["STUDY", "PROJECT", "CASE"];

const collaborationRoleLabelByValue = Object.fromEntries(
  collaborationRoleOptions.map((option) => [option.value, option.label])
) as Record<(typeof collaborationRoleOptions)[number]["value"], string>;

const commitmentLabelByValue = Object.fromEntries(
  commitmentOptions.map((option) => [option.value, option.label])
) as Record<(typeof commitmentOptions)[number]["value"], string>;

const formatLabelByValue = Object.fromEntries(
  requestFormatOptions.map((option) => [option.value, option.label])
) as Record<(typeof requestFormatOptions)[number]["value"], string>;

const preferredTimeLabelByValue = Object.fromEntries(
  preferredTimeOptions.map((option) => [option.value, option.label])
) as Record<(typeof preferredTimeOptions)[number]["value"], string>;

const projectStageLabelByValue = Object.fromEntries(
  projectStageOptions.map((option) => [option.value, option.label])
) as Record<(typeof projectStageOptions)[number]["value"], string>;

const studyFrequencyLabelByValue = Object.fromEntries(
  studyFrequencyOptions.map((option) => [option.value, option.label])
) as Record<(typeof studyFrequencyOptions)[number]["value"], string>;

const opportunityInclude = {
  owner: {
    include: {
      profile: true,
      userSkills: {
        include: {
          skill: true
        }
      },
      userSubjects: {
        include: {
          subject: true
        }
      }
    }
  },
  availabilitySlots: {
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }]
  },
  caseDetails: true,
  projectDetails: true,
  studyDetails: {
    include: {
      subject: true
    }
  }
} satisfies Prisma.RequestInclude;

type OpportunityRecord = Prisma.RequestGetPayload<{
  include: typeof opportunityInclude;
}>;

export interface HomeService {
  getFeedForUser(
    userId: string,
    options?: {
      scenario?: ScenarioType | "ALL";
    }
  ): Promise<SerializedHomeFeedData>;
}

function buildPersonDisplayName(input: {
  fullName: string | null | undefined;
  firstName: string;
  lastName: string | null;
}) {
  return (
    input.fullName ||
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
    "Студент HSE Perm"
  );
}

function formatMinuteRange(slot: { startMinute: number; endMinute: number }) {
  const startHour = String(Math.floor(slot.startMinute / 60)).padStart(2, "0");
  const startMinute = String(slot.startMinute % 60).padStart(2, "0");
  const endHour = String(Math.floor(slot.endMinute / 60)).padStart(2, "0");
  const endMinute = String(slot.endMinute % 60).padStart(2, "0");

  return `${startHour}:${startMinute}-${endHour}:${endMinute}`;
}

function buildTimeLabel(request: OpportunityRecord) {
  const firstSlot = request.availabilitySlots[0];

  if (firstSlot) {
    return formatMinuteRange(firstSlot);
  }

  if (request.scenario === "STUDY" && request.studyDetails) {
    return (
      preferredTimeLabelByValue[request.studyDetails.preferredTime] ??
      request.studyDetails.preferredTime
    );
  }

  return null;
}

function buildScenarioPayload(request: OpportunityRecord) {
  if (request.scenario === "CASE" && request.caseDetails) {
    const roles = request.caseDetails.neededRoles
      .slice(0, 2)
      .map((role) => collaborationRoleLabelByValue[role] ?? role);

    return {
      title: request.caseDetails.eventName,
      goal:
        roles.length > 0
          ? `Нужны: ${roles.join(", ")}`
          : "Собирают команду на кейс или хакатон",
      meta: `Команда до ${request.caseDetails.teamGapSize} человек`,
      format: formatLabelByValue[request.caseDetails.preferredFormat] ?? null
    };
  }

  if (request.scenario === "PROJECT" && request.projectDetails) {
    const stage =
      projectStageLabelByValue[request.projectDetails.stage] ??
      request.projectDetails.stage;
    const commitment =
      commitmentLabelByValue[request.projectDetails.expectedCommitment] ??
      request.projectDetails.expectedCommitment;

    return {
      title: request.projectDetails.projectTitle,
      goal: request.projectDetails.shortDescription,
      meta: `${stage} • ${commitment}`,
      format: formatLabelByValue[request.projectDetails.preferredFormat] ?? null
    };
  }

  const frequency =
    studyFrequencyLabelByValue[
      request.studyDetails?.desiredFrequency ?? "FLEXIBLE"
    ] ?? "Гибко";

  return {
    title: request.studyDetails?.subject.name ?? "Совместная учёба",
    goal: request.studyDetails?.goal ?? "Ищут напарника для учёбы",
    meta: `${frequency} • ${request.studyDetails?.currentContext ?? "StudyBuddy"}`,
    format: request.studyDetails?.preferredFormat
      ? formatLabelByValue[request.studyDetails.preferredFormat]
      : null
  };
}

function buildRelevanceReason(
  request: OpportunityRecord,
  viewerActiveRequestByScenario: Map<ScenarioType, string>
) {
  if (viewerActiveRequestByScenario.has(request.scenario)) {
    return "У вас уже есть запрос в этом сценарии. Проверьте, появился ли отклик.";
  }

  if (request.scenario === "STUDY") {
    return "Можно откликнуться своим StudyBuddy-запросом по предмету и времени.";
  }

  if (request.scenario === "PROJECT") {
    return "Можно создать проектный запрос с ролью или навыком под эту возможность.";
  }

  return "Можно создать командный запрос и сравнить роли, формат и дедлайн.";
}

function serializeOpportunity(
  request: OpportunityRecord,
  viewerActiveRequestByScenario: Map<ScenarioType, string>
): SerializedHomeOpportunity {
  const scenarioPayload = buildScenarioPayload(request);
  const activeViewerRequestId = viewerActiveRequestByScenario.get(request.scenario);
  const authorName = buildPersonDisplayName({
    fullName: request.owner.profile?.fullName,
    firstName: request.owner.firstName,
    lastName: request.owner.lastName
  });

  return {
    id: request.id,
    scenario: request.scenario,
    title: scenarioPayload.title,
    goal: scenarioPayload.goal,
    meta: scenarioPayload.meta,
    format: scenarioPayload.format,
    time: buildTimeLabel(request),
    author: {
      name: authorName,
      program: getProgramLabel(request.owner.profile?.program) ?? null,
      courseYear: request.owner.profile?.courseYear ?? null
    },
    trustInfo: request.owner.profile?.isDiscoverable
      ? "Открытый профиль"
      : "Профиль скрыт",
    relevanceReason: buildRelevanceReason(request, viewerActiveRequestByScenario),
    ctaLabel: activeViewerRequestId ? "Открыть отклики" : "Откликнуться",
    ctaHref: activeViewerRequestId
      ? `/matches?requestId=${activeViewerRequestId}`
      : `/requests/new?scenario=${request.scenario}`,
    expiresAt: request.expiresAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

function resolveScenarioFilter(scenario: ScenarioType | "ALL" | undefined) {
  if (scenario === "CASE" || scenario === "PROJECT" || scenario === "STUDY") {
    return scenario;
  }

  return "ALL";
}

export const homeService: HomeService = {
  async getFeedForUser(userId, options) {
    const selectedScenario = resolveScenarioFilter(options?.scenario);
    const now = new Date();

    const activeOwnRequests = await prisma.request.findMany({
      where: {
        ownerId: userId,
        status: "ACTIVE",
        expiresAt: {
          gt: now
        }
      },
      select: {
        id: true,
        scenario: true
      }
    });

    const viewerActiveRequestByScenario = new Map(
      activeOwnRequests.map((request) => [request.scenario, request.id])
    );

    const scenarioWhere =
      selectedScenario === "ALL"
        ? {}
        : {
            scenario: selectedScenario
          };

    const opportunities = await prisma.request.findMany({
      where: {
        ...scenarioWhere,
        ownerId: {
          not: userId
        },
        status: "ACTIVE",
        expiresAt: {
          gt: now
        },
        owner: {
          status: "ACTIVE",
          blockedAt: null,
          deletedAt: null,
          profile: {
            is: {
              isDiscoverable: true,
              discoverableScenarios:
                selectedScenario === "ALL"
                  ? {
                      isEmpty: false
                    }
                  : {
                      has: selectedScenario
                    }
            }
          }
        }
      },
      include: opportunityInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: HOME_FEED_LIMIT
    });

    const filteredOpportunities =
      selectedScenario === "ALL"
        ? opportunities.filter((request) =>
            request.owner.profile?.discoverableScenarios.includes(request.scenario)
          )
        : opportunities;

    const serializedOpportunities = filteredOpportunities.map((request) =>
      serializeOpportunity(request, viewerActiveRequestByScenario)
    );

    return {
      opportunities: serializedOpportunities,
      activeScenarioFilters: scenarioOrder.filter((scenario) =>
        selectedScenario === "ALL"
          ? serializedOpportunities.some((item) => item.scenario === scenario)
          : scenario === selectedScenario
      ),
      selectedScenario,
      primaryCta: buildHomePrimaryCta()
    };
  }
};
