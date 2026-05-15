import type { Prisma } from "@prisma/client";

import type { SerializedInteractionCtaState } from "@/features/connections/lib/connection-types";
import type { SerializedOpportunityDetail } from "@/features/opportunities/lib/opportunity-types";
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
import { connectionService } from "@/server/services/connections/connection-service";

const opportunityDetailInclude = {
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
  caseDetails: true,
  projectDetails: true,
  activityDetails: true,
  studyDetails: {
    include: {
      subject: true
    }
  }
} satisfies Prisma.RequestInclude;

type OpportunityDetailRecord = Prisma.RequestGetPayload<{
  include: typeof opportunityDetailInclude;
}>;

const roleLabelByValue = Object.fromEntries(
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

function buildDisplayName(request: OpportunityDetailRecord) {
  return (
    request.owner.profile?.fullName ||
    [request.owner.firstName, request.owner.lastName].filter(Boolean).join(" ").trim() ||
    "Студент HSE Perm"
  );
}

function buildScenarioPayload(request: OpportunityDetailRecord) {
  if (request.scenario === "CASE" && request.caseDetails) {
    const roles = request.caseDetails.neededRoles.map(
      (role) => roleLabelByValue[role] ?? role
    );

    return {
      title: request.caseDetails.eventName,
      goal:
        roles.length > 0
          ? `Нужны роли: ${roles.join(", ")}`
          : "Команда ищет участника на кейс или хакатон.",
      meta: `Команда до ${request.caseDetails.teamGapSize} человек`,
      format: formatLabelByValue[request.caseDetails.preferredFormat] ?? null
    };
  }

  if (request.scenario === "PROJECT" && request.projectDetails) {
    return {
      title: request.projectDetails.projectTitle,
      goal: request.projectDetails.shortDescription,
      meta: `${
        projectStageLabelByValue[request.projectDetails.stage] ??
        request.projectDetails.stage
      } · ${
        commitmentLabelByValue[request.projectDetails.expectedCommitment] ??
        request.projectDetails.expectedCommitment
      }`,
      format: formatLabelByValue[request.projectDetails.preferredFormat] ?? null
    };
  }

  if (request.scenario === "ACTIVITY" && request.activityDetails) {
    return {
      title: request.activityDetails.title,
      goal: request.activityDetails.comment ?? "Ищут людей для активности.",
      meta: `${request.activityDetails.activitySubtype} • ${request.activityDetails.peopleCount} чел.`,
      format: formatLabelByValue[request.activityDetails.preferredFormat] ?? null
    };
  }

  return {
    title: request.studyDetails?.subject.name ?? "StudyBuddy",
    goal: request.studyDetails?.goal ?? "Ищет партнёра для совместной учёбы.",
    meta: `${
      studyFrequencyLabelByValue[
        request.studyDetails?.desiredFrequency ?? "FLEXIBLE"
      ] ?? "Гибко"
    } · ${
      preferredTimeLabelByValue[
        request.studyDetails?.preferredTime ?? "FLEXIBLE"
      ] ?? "Гибко"
    }`,
    format: request.studyDetails?.preferredFormat
      ? formatLabelByValue[request.studyDetails.preferredFormat]
      : null
  };
}

function serializeOpportunityDetail(
  request: OpportunityDetailRecord,
  viewerUserId: string,
  responseState: SerializedInteractionCtaState = {
    status: "NONE" as const,
    label: "Откликнуться",
    canAct: true,
    interactionId: null,
    connectionId: null
  }
): SerializedOpportunityDetail {
  const payload = buildScenarioPayload(request);
  const isActive = request.status === "ACTIVE" && request.expiresAt > new Date();

  return {
    id: request.id,
    scenario: request.scenario,
    status: request.status,
    title: payload.title,
    goal: payload.goal,
    meta: payload.meta,
    format: payload.format,
    notes: request.notes,
    author: {
      userId: request.ownerId,
      name: buildDisplayName(request),
      bio: request.owner.profile?.bio ?? null,
      program: getProgramLabel(request.owner.profile?.program) ?? null,
      courseYear: request.owner.profile?.courseYear ?? null,
      skills: request.owner.userSkills.map((entry) => entry.skill.name),
      subjects: request.owner.userSubjects.map((entry) => entry.subject.name)
    },
    canRespond:
      isActive &&
      request.ownerId !== viewerUserId &&
      responseState.status === "NONE",
    isOwnRequest: request.ownerId === viewerUserId,
    isAvailable: isActive,
    responseState,
    expiresAt: request.expiresAt.toISOString()
  };
}

export const opportunityService = {
  async getDetailForUser(userId: string, requestId: string) {
    const request = await prisma.request.findFirst({
      where: {
        id: requestId,
        status: {
          not: "DELETED"
        },
        owner: {
          status: "ACTIVE",
          blockedAt: null,
          deletedAt: null
        }
      },
      include: opportunityDetailInclude
    });

    if (!request) {
      return null;
    }

    const responseState = await connectionService.getResponseStateForRequest(
      userId,
      request.id
    );

    return serializeOpportunityDetail(request, userId, responseState);
  }
};
