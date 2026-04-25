import type { SerializedRequestMatches } from "@/features/matching/lib/match-types";
import type { SerializedRequest } from "@/features/requests/lib/request-schema";
import {
  commitmentOptions,
  preferredTimeOptions,
  projectStageOptions,
  studyFrequencyOptions
} from "@/features/requests/lib/request-options";
import type {
  SerializedHomeMatchItem,
  SerializedHomePrimaryCta,
  SerializedHomeRequestItem
} from "@/features/home/lib/home-types";

const projectStageLabelByValue = Object.fromEntries(
  projectStageOptions.map((option) => [option.value, option.label])
) as Record<(typeof projectStageOptions)[number]["value"], string>;

const commitmentLabelByValue = Object.fromEntries(
  commitmentOptions.map((option) => [option.value, option.label])
) as Record<(typeof commitmentOptions)[number]["value"], string>;

const studyFrequencyLabelByValue = Object.fromEntries(
  studyFrequencyOptions.map((option) => [option.value, option.label])
) as Record<(typeof studyFrequencyOptions)[number]["value"], string>;

const preferredTimeLabelByValue = Object.fromEntries(
  preferredTimeOptions.map((option) => [option.value, option.label])
) as Record<(typeof preferredTimeOptions)[number]["value"], string>;

export function buildHomeRequestTitle(request: SerializedRequest) {
  if (request.details.type === "CASE") {
    return request.details.eventName;
  }

  if (request.details.type === "PROJECT") {
    return request.details.projectTitle;
  }

  return request.details.subjectName;
}

export function buildHomeRequestSubtitle(request: SerializedRequest) {
  if (request.details.type === "CASE") {
    const roles = request.details.neededRoles.slice(0, 2);

    return roles.length > 0
      ? `Нужны роли: ${roles.join(", ")}`
      : "Сценарий команды под кейс или хакатон";
  }

  if (request.details.type === "PROJECT") {
    const stageLabel =
      projectStageLabelByValue[request.details.stage] ?? request.details.stage;
    const commitmentLabel =
      commitmentLabelByValue[request.details.expectedCommitment] ??
      request.details.expectedCommitment;

    return `${stageLabel} • ${commitmentLabel}`;
  }

  const frequencyLabel =
    studyFrequencyLabelByValue[request.details.desiredFrequency] ??
    request.details.desiredFrequency;
  const preferredTimeLabel =
    preferredTimeLabelByValue[request.details.preferredTime] ??
    request.details.preferredTime;

  return `${frequencyLabel} • ${preferredTimeLabel}`;
}

export function buildHomeRequestItem(
  request: SerializedRequest,
  activeMatchCount: number
): SerializedHomeRequestItem {
  return {
    id: request.id,
    scenario: request.scenario,
    status: request.status,
    title: buildHomeRequestTitle(request),
    subtitle: buildHomeRequestSubtitle(request),
    expiresAt: request.expiresAt,
    lastMatchedAt: request.lastMatchedAt,
    activeMatchCount
  };
}

export function buildHomeLatestMatches(
  collections: SerializedRequestMatches[],
  limit = 4
): SerializedHomeMatchItem[] {
  return collections
    .flatMap((collection) =>
      collection.matches.map((match) => ({
        id: match.id,
        requestId: collection.requestId,
        requestTitle: collection.requestTitle,
        requestScenario: collection.requestScenario,
        candidateName: match.candidateProfile.fullName,
        score: match.score,
        reasonSummary: match.reasonSummary,
        status: match.status,
        chatReadiness: match.chatReadiness,
        computedAt: match.computedAt
      }))
    )
    .sort((left, right) => {
      const timeDelta =
        new Date(right.computedAt).getTime() - new Date(left.computedAt).getTime();

      if (timeDelta !== 0) {
        return timeDelta;
      }

      return right.score - left.score;
    })
    .slice(0, limit);
}

export function buildHomePrimaryCta(): SerializedHomePrimaryCta {
  return {
    label: "Создать запрос",
    href: "/requests/new",
    action: "create_request"
  };
}
