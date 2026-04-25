import type { MatchStatus, Prisma, ScenarioType } from "@prisma/client";

import { prisma } from "@/server/db/client";
import type {
  SerializedMatchDetail,
  SerializedMatchDimension,
  SerializedMatchListItem,
  SerializedMatchProfileCard,
  SerializedMatchRequestCard,
  SerializedMatchRequestSummary,
  SerializedMatchesScreenData,
  SerializedRequestMatches
} from "@/features/matching/lib/match-types";
import { dayOfWeekOptions } from "@/features/profile/lib/profile-options";
import {
  collaborationRoleOptions,
  commitmentOptions,
  preferredTimeOptions,
  projectStageOptions,
  studyFrequencyOptions
} from "@/features/requests/lib/request-options";
import { getProgramLabel } from "@/features/study/lib/study-catalog";
import { buildDiscoverableFallbackProfileWhere, buildEligibleRequestWhere } from "@/server/services/matching/match-eligibility";

const MATCH_LIMIT = 10;
const MAX_FALLBACK_MATCHES = 3;
const MATCH_MIN_SCORE = 45;
const MATCH_REQUEST_MIN_COUNT = 3;
const MATCH_REQUEST_POOL_THRESHOLD = 5;
const ACTIVE_MATCH_STATUSES: MatchStatus[] = [
  "READY",
  "PENDING_RECIPIENT_ACCEPTANCE"
];

const roleSkillMap = {
  ANALYST: ["analysis", "research", "statistics", "finance", "management"],
  DEVELOPER: ["python", "frontend", "backend", "programming"],
  DESIGNER: ["design", "ux"],
  PRODUCT_MANAGER: ["product", "product-management", "management"],
  RESEARCHER: ["research", "analysis", "statistics"],
  MARKETER: ["marketing", "copywriting"],
  FINANCE: ["finance", "analysis"],
  PRESENTER: ["presentation", "copywriting"]
} as const;

const dayLabelByValue = Object.fromEntries(
  dayOfWeekOptions.map((option) => [option.value, option.label])
) as Record<(typeof dayOfWeekOptions)[number]["value"], string>;

const roleLabelByValue = Object.fromEntries(
  collaborationRoleOptions.map((option) => [option.value, option.label])
) as Record<(typeof collaborationRoleOptions)[number]["value"], string>;

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

const availabilitySlotOrderBy: Prisma.AvailabilitySlotOrderByWithRelationInput[] = [
  { dayOfWeek: "asc" },
  { startMinute: "asc" }
];

const requestInclude = {
  owner: {
    include: {
      profile: {
        include: {
          availabilitySlots: {
            orderBy: availabilitySlotOrderBy
          }
        }
      },
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

const profileInclude = {
  availabilitySlots: {
    orderBy: availabilitySlotOrderBy
  },
  user: {
    include: {
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
  }
} satisfies Prisma.ProfileInclude;

const matchInclude = {
  sourceRequest: {
    include: requestInclude
  },
  candidateRequest: {
    include: requestInclude
  },
  candidateProfile: {
    include: profileInclude
  },
  chat: {
    select: {
      id: true
    }
  }
} satisfies Prisma.MatchInclude;

type MatchRequestRecord = Prisma.RequestGetPayload<{
  include: typeof requestInclude;
}>;

type FallbackProfileRecord = Prisma.ProfileGetPayload<{
  include: typeof profileInclude;
}>;

type StoredMatchRecord = Prisma.MatchGetPayload<{
  include: typeof matchInclude;
}>;

type AvailabilityLike = {
  dayOfWeek: string;
  startMinute: number;
  endMinute: number;
}[];

type MatchDimensionDraft = {
  key: string;
  label: string;
  summaryLabel: string;
  weight: number;
  value: number;
};

type ScoredRequestCandidate = {
  pairKey: string;
  scenario: ScenarioType;
  request: MatchRequestRecord;
  score: number;
  reasonSummary: string;
  dimensions: SerializedMatchDimension[];
  expiresAt: Date;
};

type ScoredFallbackCandidate = {
  pairKey: string;
  scenario: ScenarioType;
  profile: FallbackProfileRecord;
  score: number;
  reasonSummary: string;
  dimensions: SerializedMatchDimension[];
  expiresAt: Date;
};

type RecomputeResult = {
  requestId: string;
  refreshed: true;
  matchCount: number;
  fallbackUsed: boolean;
};

function buildCanonicalRequestPairKey(leftId: string, rightId: string) {
  return `request:${[leftId, rightId].sort().join(":")}`;
}

function buildFallbackPairKey(requestId: string, profileId: string) {
  return `fallback:${requestId}:${profileId}`;
}

function buildPersonDisplayName(input: {
  fullName: string | null | undefined;
  firstName: string;
  lastName: string | null;
}) {
  return (
    input.fullName ||
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
    "������������"
  );
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0400-\u04FF]+/g, " ")
    .trim();
}

function tokenizeText(value: string | null | undefined) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return [];
  }

  return normalized.split(/\s+/).filter(Boolean);
}

function toUniqueStrings(values: (string | null | undefined)[]) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function formatProgramLabel(programId: string | null | undefined) {
  return getProgramLabel(programId) ?? programId ?? null;
}

function ratioFromIntersection(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  const intersectionCount = [...new Set(left)].filter((value) =>
    rightSet.has(value)
  ).length;

  return intersectionCount / Math.min(new Set(left).size, rightSet.size);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeTextSimilarity(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  return ratioFromIntersection(tokenizeText(normalizedLeft), tokenizeText(normalizedRight));
}

function computeArrayOverlap(left: string[], right: string[]) {
  return ratioFromIntersection(left, right);
}

function computeFormatCompatibility(
  left: "ONLINE" | "OFFLINE" | "HYBRID" | null | undefined,
  right: "ONLINE" | "OFFLINE" | "HYBRID" | null | undefined
) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left === "HYBRID" || right === "HYBRID") {
    return 0.75;
  }

  return 0;
}

function computeFormatCompatibilityForProfile(
  requestFormat: "ONLINE" | "OFFLINE" | "HYBRID" | null | undefined,
  preferredFormats: ("ONLINE" | "OFFLINE" | "HYBRID")[]
) {
  if (!requestFormat || preferredFormats.length === 0) {
    return 0;
  }

  return preferredFormats.reduce(
    (best, format) => Math.max(best, computeFormatCompatibility(requestFormat, format)),
    0
  );
}

function computeAvailabilityOverlap(left: AvailabilityLike, right: AvailabilityLike) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const totalLeft = left.reduce(
    (sum, slot) => sum + Math.max(0, slot.endMinute - slot.startMinute),
    0
  );
  const totalRight = right.reduce(
    (sum, slot) => sum + Math.max(0, slot.endMinute - slot.startMinute),
    0
  );

  if (totalLeft === 0 || totalRight === 0) {
    return 0;
  }

  let overlapMinutes = 0;

  for (const leftSlot of left) {
    for (const rightSlot of right) {
      if (leftSlot.dayOfWeek !== rightSlot.dayOfWeek) {
        continue;
      }

      overlapMinutes += Math.max(
        0,
        Math.min(leftSlot.endMinute, rightSlot.endMinute) -
          Math.max(leftSlot.startMinute, rightSlot.startMinute)
      );
    }
  }

  return clampScore(overlapMinutes / Math.min(totalLeft, totalRight));
}

function computeStageCompatibility(
  left: "IDEA" | "MVP" | "EARLY_TRACTION" | "OPERATING",
  right: "IDEA" | "MVP" | "EARLY_TRACTION" | "OPERATING"
) {
  const stageOrder = {
    IDEA: 0,
    MVP: 1,
    EARLY_TRACTION: 2,
    OPERATING: 3
  } as const;

  const difference = Math.abs(stageOrder[left] - stageOrder[right]);

  if (difference === 0) {
    return 1;
  }

  if (difference === 1) {
    return 0.7;
  }

  if (difference === 2) {
    return 0.45;
  }

  return 0.2;
}

function computeCommitmentCompatibility(
  left: "LIGHT" | "PART_TIME" | "HEAVY" | "FLEXIBLE",
  right: "LIGHT" | "PART_TIME" | "HEAVY" | "FLEXIBLE"
) {
  if (left === right) {
    return 1;
  }

  if (left === "FLEXIBLE" || right === "FLEXIBLE") {
    return 0.75;
  }

  const lowLoad = new Set(["LIGHT", "PART_TIME"]);

  if (lowLoad.has(left) && lowLoad.has(right)) {
    return 0.7;
  }

  if (
    (left === "PART_TIME" && right === "HEAVY") ||
    (left === "HEAVY" && right === "PART_TIME")
  ) {
    return 0.55;
  }

  return 0.35;
}

function computeStudyFrequencyCompatibility(
  left: "ONCE" | "WEEKLY" | "TWICE_WEEKLY" | "FLEXIBLE",
  right: "ONCE" | "WEEKLY" | "TWICE_WEEKLY" | "FLEXIBLE"
) {
  if (left === right) {
    return 1;
  }

  if (left === "FLEXIBLE" || right === "FLEXIBLE") {
    return 0.75;
  }

  if (
    (left === "WEEKLY" && right === "TWICE_WEEKLY") ||
    (left === "TWICE_WEEKLY" && right === "WEEKLY")
  ) {
    return 0.7;
  }

  if (
    (left === "ONCE" && right === "WEEKLY") ||
    (left === "WEEKLY" && right === "ONCE")
  ) {
    return 0.45;
  }

  return 0.3;
}

function computePreferredTimeCompatibility(
  left: "MORNING" | "AFTERNOON" | "EVENING" | "FLEXIBLE",
  right: "MORNING" | "AFTERNOON" | "EVENING" | "FLEXIBLE"
) {
  if (left === right) {
    return 1;
  }

  if (left === "FLEXIBLE" || right === "FLEXIBLE") {
    return 0.75;
  }

  return 0.25;
}

function inferRolesFromSkillSlugs(skillSlugs: string[]) {
  const roles = new Set<string>();

  for (const [role, mappedSlugs] of Object.entries(roleSkillMap)) {
    if (mappedSlugs.some((slug) => skillSlugs.includes(slug))) {
      roles.add(role);
    }
  }

  return [...roles];
}

function computeRoleCoverage(requiredRoles: string[], availableRoles: string[]) {
  if (requiredRoles.length === 0 || availableRoles.length === 0) {
    return 0;
  }

  return ratioFromIntersection(requiredRoles, availableRoles);
}

function computeProfileCompleteness(input: {
  fullName: string | null | undefined;
  bio: string | null | undefined;
  program: string | null | undefined;
  courseYear: number | null | undefined;
  preferredFormats: string[];
  skillCount: number;
  subjectCount: number;
  availabilitySlots: AvailabilityLike;
}) {
  const checkpoints = [
    Boolean(input.fullName),
    Boolean(input.bio),
    Boolean(input.program),
    Boolean(input.courseYear),
    input.preferredFormats.length > 0,
    input.skillCount > 0,
    input.subjectCount > 0,
    input.availabilitySlots.length > 0
  ];

  return checkpoints.filter(Boolean).length / checkpoints.length;
}

function buildAvailabilityLabels(availabilitySlots: AvailabilityLike) {
  return availabilitySlots.map((slot) => {
    const dayLabel =
      dayLabelByValue[slot.dayOfWeek as keyof typeof dayLabelByValue] ?? slot.dayOfWeek;

    const startHour = String(Math.floor(slot.startMinute / 60)).padStart(2, "0");
    const startMinute = String(slot.startMinute % 60).padStart(2, "0");
    const endHour = String(Math.floor(slot.endMinute / 60)).padStart(2, "0");
    const endMinute = String(slot.endMinute % 60).padStart(2, "0");

    return `${dayLabel}: ${startHour}:${startMinute}-${endHour}:${endMinute}`;
  });
}

function getEffectiveAvailabilitySlots(request: MatchRequestRecord) {
  if (request.availabilitySlots.length > 0) {
    return request.availabilitySlots;
  }

  return request.owner.profile?.availabilitySlots ?? [];
}

function getRequestSkillSlugs(request: MatchRequestRecord) {
  return toUniqueStrings(request.owner.userSkills.map((entry) => entry.skill.slug));
}

function getRequestSkillNames(request: MatchRequestRecord) {
  return toUniqueStrings(request.owner.userSkills.map((entry) => entry.skill.name));
}

function getRequestSubjectIds(request: MatchRequestRecord) {
  const ownerSubjects = request.owner.userSubjects.map((entry) => entry.subjectId);

  if (request.scenario === "STUDY" && request.studyDetails?.subjectId) {
    return toUniqueStrings([request.studyDetails.subjectId, ...ownerSubjects]);
  }

  return toUniqueStrings(ownerSubjects);
}

function getRequestSubjectNames(request: MatchRequestRecord) {
  const ownerSubjects = request.owner.userSubjects.map((entry) => entry.subject.name);

  if (request.scenario === "STUDY" && request.studyDetails?.subject.name) {
    return toUniqueStrings([request.studyDetails.subject.name, ...ownerSubjects]);
  }

  return toUniqueStrings(ownerSubjects);
}

function getRequestNeededRoles(request: MatchRequestRecord) {
  if (request.scenario === "CASE") {
    return request.caseDetails?.neededRoles ?? [];
  }

  if (request.scenario === "PROJECT") {
    return request.projectDetails?.neededRoles ?? [];
  }

  return [];
}

function getRequestPreferredFormat(request: MatchRequestRecord) {
  if (request.scenario === "CASE") {
    return request.caseDetails?.preferredFormat ?? null;
  }

  if (request.scenario === "PROJECT") {
    return request.projectDetails?.preferredFormat ?? null;
  }

  return request.studyDetails?.preferredFormat ?? null;
}

function buildRequestCard(request: MatchRequestRecord): SerializedMatchRequestCard {
  if (request.scenario === "CASE" && request.caseDetails) {
    return {
      id: request.id,
      scenario: request.scenario,
      title: request.caseDetails.eventName,
      subtitle: `����� ����: ${
        request.caseDetails.neededRoles
          .map((role) => roleLabelByValue[role] ?? role)
          .join(", ") || "����������"
      }`,
      preferredFormat: request.caseDetails.preferredFormat,
      expiresAt: request.expiresAt.toISOString(),
      ownerDisplayName: buildPersonDisplayName({
        fullName: request.owner.profile?.fullName,
        firstName: request.owner.firstName,
        lastName: request.owner.lastName
      })
    };
  }

  if (request.scenario === "PROJECT" && request.projectDetails) {
    return {
      id: request.id,
      scenario: request.scenario,
      title: request.projectDetails.projectTitle,
      subtitle: `${
        projectStageLabelByValue[request.projectDetails.stage] ??
        request.projectDetails.stage
      } � ${
        commitmentLabelByValue[request.projectDetails.expectedCommitment] ??
        request.projectDetails.expectedCommitment
      }`,
      preferredFormat: request.projectDetails.preferredFormat,
      expiresAt: request.expiresAt.toISOString(),
      ownerDisplayName: buildPersonDisplayName({
        fullName: request.owner.profile?.fullName,
        firstName: request.owner.firstName,
        lastName: request.owner.lastName
      })
    };
  }

  return {
    id: request.id,
    scenario: request.scenario,
    title: request.studyDetails?.subject.name ?? "���������� �����",
    subtitle: `${
      studyFrequencyLabelByValue[
        (request.studyDetails?.desiredFrequency ?? "FLEXIBLE") as keyof typeof studyFrequencyLabelByValue
      ] ?? request.studyDetails?.desiredFrequency ?? "FLEXIBLE"
    } � ${
      preferredTimeLabelByValue[
        (request.studyDetails?.preferredTime ?? "FLEXIBLE") as keyof typeof preferredTimeLabelByValue
      ] ?? request.studyDetails?.preferredTime ?? "FLEXIBLE"
    }`,
    preferredFormat: request.studyDetails?.preferredFormat ?? null,
    expiresAt: request.expiresAt.toISOString(),
    ownerDisplayName: buildPersonDisplayName({
      fullName: request.owner.profile?.fullName,
      firstName: request.owner.firstName,
      lastName: request.owner.lastName
    })
  };
}

function buildProfileCardFromRequest(request: MatchRequestRecord): SerializedMatchProfileCard {
  return {
    id: request.owner.profile?.id ?? request.owner.id,
    userId: request.owner.id,
    fullName: buildPersonDisplayName({
      fullName: request.owner.profile?.fullName,
      firstName: request.owner.firstName,
      lastName: request.owner.lastName
    }),
    bio: request.owner.profile?.bio ?? null,
    program: formatProgramLabel(request.owner.profile?.program),
    courseYear: request.owner.profile?.courseYear ?? null,
    preferredFormats: request.owner.profile?.preferredFormats ?? [],
    skillNames: getRequestSkillNames(request),
    subjectNames: getRequestSubjectNames(request),
    availabilityLabels: buildAvailabilityLabels(getEffectiveAvailabilitySlots(request)),
    isDiscoverable: request.owner.profile?.isDiscoverable ?? false
  };
}

function buildProfileCardFromProfile(profile: FallbackProfileRecord): SerializedMatchProfileCard {
  return {
    id: profile.id,
    userId: profile.user.id,
    fullName: buildPersonDisplayName({
      fullName: profile.fullName,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName
    }),
    bio: profile.bio ?? null,
    program: formatProgramLabel(profile.program),
    courseYear: profile.courseYear ?? null,
    preferredFormats: profile.preferredFormats,
    skillNames: toUniqueStrings(profile.user.userSkills.map((entry) => entry.skill.name)),
    subjectNames: toUniqueStrings(profile.user.userSubjects.map((entry) => entry.subject.name)),
    availabilityLabels: buildAvailabilityLabels(profile.availabilitySlots),
    isDiscoverable: profile.isDiscoverable
  };
}

function finalizeDimensions(dimensions: MatchDimensionDraft[]) {
  const scoredDimensions = dimensions.map((dimension) => ({
    ...dimension,
    score: roundScore(dimension.weight * clampScore(dimension.value))
  }));

  const score = scoredDimensions.reduce((sum, dimension) => sum + dimension.score, 0);

  return {
    score,
    dimensions: scoredDimensions.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      score: dimension.score
    }))
  };
}

function buildReasonSummary(
  dimensions: (SerializedMatchDimension & { summaryLabel?: string })[],
  fallbacks: string[]
) {
  const topLabels = dimensions
    .filter((dimension) => dimension.score > 0 && dimension.summaryLabel)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((dimension) => dimension.summaryLabel as string);

  if (topLabels.length === 0) {
    return fallbacks[0];
  }

  if (topLabels.length === 1) {
    return topLabels[0];
  }

  return `${topLabels[0]} � ${topLabels[1].toLowerCase()}`;
}

function attachSummaryLabels(
  dimensions: SerializedMatchDimension[],
  drafts: MatchDimensionDraft[]
) {
  return dimensions.map((dimension) => ({
    ...dimension,
    summaryLabel:
      drafts.find((draft) => draft.key === dimension.key)?.summaryLabel ?? dimension.label
  }));
}

function scoreCaseRequestPair(
  source: MatchRequestRecord,
  candidate: MatchRequestRecord
) {
  const sourceSkills = getRequestSkillSlugs(source);
  const candidateSkills = getRequestSkillSlugs(candidate);
  const sourceRoles = inferRolesFromSkillSlugs(sourceSkills);
  const candidateRoles = inferRolesFromSkillSlugs(candidateSkills);
  const eventFit = computeTextSimilarity(
    source.caseDetails?.eventName,
    candidate.caseDetails?.eventName
  );
  const roleFit = Math.max(
    computeRoleCoverage(getRequestNeededRoles(source), candidateRoles),
    computeRoleCoverage(getRequestNeededRoles(candidate), sourceRoles)
  );
  const availabilityFit = computeAvailabilityOverlap(
    getEffectiveAvailabilitySlots(source),
    getEffectiveAvailabilitySlots(candidate)
  );
  const skillFit = computeArrayOverlap(sourceSkills, candidateSkills);
  const formatFit = computeFormatCompatibility(
    getRequestPreferredFormat(source),
    getRequestPreferredFormat(candidate)
  );
  const completeness = clampScore(
    (computeProfileCompleteness({
      fullName: source.owner.profile?.fullName,
      bio: source.owner.profile?.bio,
      program: source.owner.profile?.program,
      courseYear: source.owner.profile?.courseYear,
      preferredFormats: source.owner.profile?.preferredFormats ?? [],
      skillCount: source.owner.userSkills.length,
      subjectCount: source.owner.userSubjects.length,
      availabilitySlots: source.owner.profile?.availabilitySlots ?? []
    }) +
      computeProfileCompleteness({
        fullName: candidate.owner.profile?.fullName,
        bio: candidate.owner.profile?.bio,
        program: candidate.owner.profile?.program,
        courseYear: candidate.owner.profile?.courseYear,
        preferredFormats: candidate.owner.profile?.preferredFormats ?? [],
        skillCount: candidate.owner.userSkills.length,
        subjectCount: candidate.owner.userSubjects.length,
        availabilitySlots: candidate.owner.profile?.availabilitySlots ?? []
      })) /
      2
  );

  const drafts: MatchDimensionDraft[] = [
    {
      key: "role_fit",
      label: "���� � ������",
      summaryLabel: "�������� �� �����",
      weight: 30,
      value: roleFit
    },
    {
      key: "event_relevance",
      label: "������������� �������",
      summaryLabel: "��������� ���� ��� �������",
      weight: 25,
      value: eventFit
    },
    {
      key: "availability_overlap",
      label: "����������� �� �������",
      summaryLabel: "��������� �����",
      weight: 15,
      value: availabilityFit
    },
    {
      key: "skill_fit",
      label: "��������� �����������",
      summaryLabel: "��������� ������",
      weight: 15,
      value: skillFit
    },
    {
      key: "format_fit",
      label: "������������� �������",
      summaryLabel: "�������� ������",
      weight: 10,
      value: formatFit
    },
    {
      key: "profile_completeness",
      label: "������������� �������",
      summaryLabel: "������� ������ ��������",
      weight: 5,
      value: completeness
    }
  ];

  const finalized = finalizeDimensions(drafts);
  const reasonSummary = buildReasonSummary(
    attachSummaryLabels(finalized.dimensions, drafts),
    ["���� ������� ������������� �� �����"]
  );

  return {
    score: finalized.score,
    dimensions: finalized.dimensions,
    reasonSummary
  };
}

function scoreProjectRequestPair(
  source: MatchRequestRecord,
  candidate: MatchRequestRecord
) {
  const sourceSkills = getRequestSkillSlugs(source);
  const candidateSkills = getRequestSkillSlugs(candidate);
  const sourceRoles = inferRolesFromSkillSlugs(sourceSkills);
  const candidateRoles = inferRolesFromSkillSlugs(candidateSkills);
  const roleFit = Math.max(
    computeRoleCoverage(getRequestNeededRoles(source), candidateRoles),
    computeRoleCoverage(getRequestNeededRoles(candidate), sourceRoles)
  );
  const stageFit = computeStageCompatibility(
    source.projectDetails!.stage,
    candidate.projectDetails!.stage
  );
  const commitmentFit = computeCommitmentCompatibility(
    source.projectDetails!.expectedCommitment,
    candidate.projectDetails!.expectedCommitment
  );
  const formatFit = computeFormatCompatibility(
    source.projectDetails!.preferredFormat,
    candidate.projectDetails!.preferredFormat
  );
  const skillFit = computeArrayOverlap(sourceSkills, candidateSkills);
  const completeness = clampScore(
    (computeProfileCompleteness({
      fullName: source.owner.profile?.fullName,
      bio: source.owner.profile?.bio,
      program: source.owner.profile?.program,
      courseYear: source.owner.profile?.courseYear,
      preferredFormats: source.owner.profile?.preferredFormats ?? [],
      skillCount: source.owner.userSkills.length,
      subjectCount: source.owner.userSubjects.length,
      availabilitySlots: source.owner.profile?.availabilitySlots ?? []
    }) +
      computeProfileCompleteness({
        fullName: candidate.owner.profile?.fullName,
        bio: candidate.owner.profile?.bio,
        program: candidate.owner.profile?.program,
        courseYear: candidate.owner.profile?.courseYear,
        preferredFormats: candidate.owner.profile?.preferredFormats ?? [],
        skillCount: candidate.owner.userSkills.length,
        subjectCount: candidate.owner.userSubjects.length,
        availabilitySlots: candidate.owner.profile?.availabilitySlots ?? []
      })) /
      2
  );

  const drafts: MatchDimensionDraft[] = [
    {
      key: "role_fit",
      label: "���� � ������",
      summaryLabel: "�������� �� �����",
      weight: 30,
      value: roleFit
    },
    {
      key: "stage_fit",
      label: "������������� ������",
      summaryLabel: "�������� ������ �������",
      weight: 20,
      value: stageFit
    },
    {
      key: "commitment_fit",
      label: "������������� �������������",
      summaryLabel: "��������� ��������� �������������",
      weight: 15,
      value: commitmentFit
    },
    {
      key: "format_fit",
      label: "������������� �������",
      summaryLabel: "�������� ������",
      weight: 15,
      value: formatFit
    },
    {
      key: "skill_fit",
      label: "��������� �����������",
      summaryLabel: "��������� ������",
      weight: 15,
      value: skillFit
    },
    {
      key: "profile_completeness",
      label: "������������� �������",
      summaryLabel: "������� ������ ��������",
      weight: 5,
      value: completeness
    }
  ];

  const finalized = finalizeDimensions(drafts);
  const reasonSummary = buildReasonSummary(
    attachSummaryLabels(finalized.dimensions, drafts),
    ["���� ������� ������������� �� �������"]
  );

  return {
    score: finalized.score,
    dimensions: finalized.dimensions,
    reasonSummary
  };
}

function scoreStudyRequestPair(
  source: MatchRequestRecord,
  candidate: MatchRequestRecord
) {
  const subjectFit =
    source.studyDetails?.subjectId === candidate.studyDetails?.subjectId ? 1 : 0;
  const goalFit = clampScore(
    (computeTextSimilarity(source.studyDetails?.goal, candidate.studyDetails?.goal) +
      computeTextSimilarity(
        source.studyDetails?.currentContext,
        candidate.studyDetails?.currentContext
      )) /
      2
  );
  const availabilityFit = computeAvailabilityOverlap(
    getEffectiveAvailabilitySlots(source),
    getEffectiveAvailabilitySlots(candidate)
  );
  const formatFit = computeFormatCompatibility(
    source.studyDetails?.preferredFormat,
    candidate.studyDetails?.preferredFormat
  );
  const rhythmFit = clampScore(
    (computeStudyFrequencyCompatibility(
      source.studyDetails!.desiredFrequency,
      candidate.studyDetails!.desiredFrequency
    ) +
      computePreferredTimeCompatibility(
        source.studyDetails!.preferredTime,
        candidate.studyDetails!.preferredTime
      )) /
      2
  );
  const completeness = clampScore(
    (computeProfileCompleteness({
      fullName: source.owner.profile?.fullName,
      bio: source.owner.profile?.bio,
      program: source.owner.profile?.program,
      courseYear: source.owner.profile?.courseYear,
      preferredFormats: source.owner.profile?.preferredFormats ?? [],
      skillCount: source.owner.userSkills.length,
      subjectCount: source.owner.userSubjects.length,
      availabilitySlots: source.owner.profile?.availabilitySlots ?? []
    }) +
      computeProfileCompleteness({
        fullName: candidate.owner.profile?.fullName,
        bio: candidate.owner.profile?.bio,
        program: candidate.owner.profile?.program,
        courseYear: candidate.owner.profile?.courseYear,
        preferredFormats: candidate.owner.profile?.preferredFormats ?? [],
        skillCount: candidate.owner.userSkills.length,
        subjectCount: candidate.owner.userSubjects.length,
        availabilitySlots: candidate.owner.profile?.availabilitySlots ?? []
      })) /
      2
  );

  const drafts: MatchDimensionDraft[] = [
    {
      key: "subject_fit",
      label: "���������� ��������",
      summaryLabel: "��������� �������",
      weight: 35,
      value: subjectFit
    },
    {
      key: "goal_fit",
      label: "�������� ������� ����",
      summaryLabel: "������� ������� ����",
      weight: 20,
      value: goalFit
    },
    {
      key: "availability_overlap",
      label: "����������� �� �������",
      summaryLabel: "��������� �����",
      weight: 15,
      value: availabilityFit
    },
    {
      key: "format_fit",
      label: "������������� �������",
      summaryLabel: "�������� ������",
      weight: 10,
      value: formatFit
    },
    {
      key: "rhythm_fit",
      label: "������������� �����",
      summaryLabel: "�������� ���� �������",
      weight: 15,
      value: rhythmFit
    },
    {
      key: "profile_completeness",
      label: "������������� �������",
      summaryLabel: "������� ������ ��������",
      weight: 5,
      value: completeness
    }
  ];

  const finalized = finalizeDimensions(drafts);
  const reasonSummary = buildReasonSummary(
    attachSummaryLabels(finalized.dimensions, drafts),
    ["���� ������� ������������� ��� ���������� �����"]
  );

  return {
    score: finalized.score,
    dimensions: finalized.dimensions,
    reasonSummary
  };
}

function scoreFallbackCandidate(
  source: MatchRequestRecord,
  candidate: FallbackProfileRecord
) {
  const sourceSkills = getRequestSkillSlugs(source);
  const candidateSkills = toUniqueStrings(
    candidate.user.userSkills.map((entry) => entry.skill.slug)
  );
  const sourceSubjects = getRequestSubjectIds(source);
  const candidateSubjects = toUniqueStrings(
    candidate.user.userSubjects.map((entry) => entry.subjectId)
  );
  const candidateRoles = inferRolesFromSkillSlugs(candidateSkills);
  const availabilityFit = computeAvailabilityOverlap(
    getEffectiveAvailabilitySlots(source),
    candidate.availabilitySlots
  );
  const formatFit = computeFormatCompatibilityForProfile(
    getRequestPreferredFormat(source),
    candidate.preferredFormats
  );
  const completeness = computeProfileCompleteness({
    fullName: candidate.fullName,
    bio: candidate.bio,
    program: candidate.program,
    courseYear: candidate.courseYear,
    preferredFormats: candidate.preferredFormats,
    skillCount: candidate.user.userSkills.length,
    subjectCount: candidate.user.userSubjects.length,
    availabilitySlots: candidate.availabilitySlots
  });

  if (source.scenario === "STUDY") {
    const subjectFit = source.studyDetails?.subjectId
      ? candidateSubjects.includes(source.studyDetails.subjectId)
        ? 1
        : 0
      : computeArrayOverlap(sourceSubjects, candidateSubjects);

    const drafts: MatchDimensionDraft[] = [
      {
        key: "subject_fit",
        label: "���������� ��������",
        summaryLabel: "��������� �������",
        weight: 45,
        value: subjectFit
      },
      {
        key: "availability_overlap",
        label: "����������� �� �������",
        summaryLabel: "��������� �����",
        weight: 20,
        value: availabilityFit
      },
      {
        key: "format_fit",
        label: "������������� �������",
        summaryLabel: "�������� ������",
        weight: 15,
        value: formatFit
      },
      {
        key: "profile_completeness",
        label: "������������� �������",
        summaryLabel: "������� ������ ��������",
        weight: 20,
        value: completeness
      }
    ];

    const finalized = finalizeDimensions(drafts);
    const reasonSummary = buildReasonSummary(
      attachSummaryLabels(finalized.dimensions, drafts),
      ["���� ������� ������������� ��� ���������� �����"]
    );

    return {
      score: finalized.score,
      dimensions: finalized.dimensions,
      reasonSummary
    };
  }

  const roleFit = computeRoleCoverage(getRequestNeededRoles(source), candidateRoles);
  const skillFit = computeArrayOverlap(sourceSkills, candidateSkills);
  const subjectFit = computeArrayOverlap(sourceSubjects, candidateSubjects);

  const drafts: MatchDimensionDraft[] =
    source.scenario === "CASE"
      ? [
          {
            key: "role_fit",
            label: "���� � ������",
            summaryLabel: "�������� �� �����",
            weight: 35,
            value: roleFit
          },
          {
            key: "skill_fit",
            label: "��������� �����������",
            summaryLabel: "��������� ������",
            weight: 20,
            value: skillFit
          },
          {
            key: "availability_overlap",
            label: "����������� �� �������",
            summaryLabel: "��������� �����",
            weight: 15,
            value: availabilityFit
          },
          {
            key: "format_fit",
            label: "������������� �������",
            summaryLabel: "�������� ������",
            weight: 15,
            value: formatFit
          },
          {
            key: "subject_fit",
            label: "����������� �� ���������",
            summaryLabel: "���� ����� ���������� ����",
            weight: 5,
            value: subjectFit
          },
          {
            key: "profile_completeness",
            label: "������������� �������",
            summaryLabel: "������� ������ ��������",
            weight: 10,
            value: completeness
          }
        ]
      : [
          {
            key: "role_fit",
            label: "���� � ������",
            summaryLabel: "�������� �� �����",
            weight: 30,
            value: roleFit
          },
          {
            key: "skill_fit",
            label: "��������� �����������",
            summaryLabel: "��������� ������",
            weight: 20,
            value: skillFit
          },
          {
            key: "availability_overlap",
            label: "����������� �� �������",
            summaryLabel: "��������� �����",
            weight: 10,
            value: availabilityFit
          },
          {
            key: "format_fit",
            label: "������������� �������",
            summaryLabel: "�������� ������",
            weight: 15,
            value: formatFit
          },
          {
            key: "subject_fit",
            label: "����������� �� ���������",
            summaryLabel: "���� ����� ���������� ����",
            weight: 10,
            value: subjectFit
          },
          {
            key: "profile_completeness",
            label: "������������� �������",
            summaryLabel: "������� ������ ��������",
            weight: 15,
            value: completeness
          }
        ];

  const finalized = finalizeDimensions(drafts);
  const reasonSummary = buildReasonSummary(
    attachSummaryLabels(finalized.dimensions, drafts),
    ["���� ������� ������������� �� �������"]
  );

  return {
    score: finalized.score,
    dimensions: finalized.dimensions,
    reasonSummary
  };
}

function scoreRequestCandidate(
  source: MatchRequestRecord,
  candidate: MatchRequestRecord
) {
  if (source.scenario === "CASE") {
    return scoreCaseRequestPair(source, candidate);
  }

  if (source.scenario === "PROJECT") {
    return scoreProjectRequestPair(source, candidate);
  }

  return scoreStudyRequestPair(source, candidate);
}

function buildMatchReasonDetails(input: {
  sourceRequestId: string;
  candidateRequestId?: string | null;
  candidateProfileId?: string | null;
  dimensions: SerializedMatchDimension[];
  requestCandidatePoolSize: number;
  fallbackCandidatePoolSize: number;
  fallbackUsed: boolean;
}) {
  return {
    dimensions: input.dimensions,
    requestCandidatePoolSize: input.requestCandidatePoolSize,
    fallbackCandidatePoolSize: input.fallbackCandidatePoolSize,
    fallbackUsed: input.fallbackUsed,
    sourceRequestId: input.sourceRequestId,
    candidateRequestId: input.candidateRequestId ?? null,
    candidateProfileId: input.candidateProfileId ?? null
  };
}

function readStoredDimensions(reasonDetails: Prisma.JsonValue | null): SerializedMatchDimension[] {
  if (!reasonDetails || typeof reasonDetails !== "object" || Array.isArray(reasonDetails)) {
    return [];
  }

  if (
    "dimensions" in reasonDetails &&
    Array.isArray((reasonDetails as { dimensions?: unknown[] }).dimensions)
  ) {
    return ((reasonDetails as { dimensions: unknown[] }).dimensions ?? [])
      .map((entry) => {
        if (
          entry &&
          typeof entry === "object" &&
          "key" in entry &&
          "label" in entry &&
          "score" in entry &&
          typeof entry.key === "string" &&
          typeof entry.label === "string" &&
          typeof entry.score === "number"
        ) {
          return {
            key: entry.key,
            label: entry.label,
            score: entry.score
          };
        }

        return null;
      })
      .filter(Boolean) as SerializedMatchDimension[];
  }

  return Object.entries(reasonDetails).map(([key, value]) => ({
    key,
    label: key,
    score: Array.isArray(value) ? 20 : typeof value === "string" ? 15 : 10
  }));
}

function isRequestEligibleForMatching(request: MatchRequestRecord | null | undefined, now: Date) {
  if (!request) {
    return false;
  }

  if (request.status !== "ACTIVE") {
    return false;
  }

  if (request.expiresAt <= now) {
    return false;
  }

  if (request.owner.status !== "ACTIVE") {
    return false;
  }

  if (request.owner.blockedAt || request.owner.deletedAt) {
    return false;
  }

  return true;
}

function isFallbackProfileEligible(
  profile: FallbackProfileRecord | null | undefined,
  scenario: ScenarioType,
  requestingUserId: string
) {
  if (!profile) {
    return false;
  }

  if (!profile.isDiscoverable) {
    return false;
  }

  if (!profile.discoverableScenarios.includes(scenario)) {
    return false;
  }

  if (profile.user.id === requestingUserId) {
    return false;
  }

  if (profile.user.status !== "ACTIVE") {
    return false;
  }

  if (profile.user.blockedAt || profile.user.deletedAt) {
    return false;
  }

  return true;
}

function buildRequestEmptyState(
  request: MatchRequestRecord,
  isDiscoverable: boolean
): SerializedRequestMatches["emptyState"] {
  if (request.status !== "ACTIVE" || request.expiresAt <= new Date()) {
    return {
      code: "REQUEST_INACTIVE",
      title: "������� ��� ����� ������� ������ ����������",
      description: "�������� ������ ��� �������� �����, ����� ����� �������� ���������� ����������.",
      suggestions: [
        "�������� ������, ���� ���� �� ��� ���������.",
        "��������� ����, ������� ��� ������ ����� ��������� ��������.",
        "����� renew ������� ������������� ������."
      ],
      keepRequestOpen: false
    };
  }

  return {
    code: "NO_MATCHES",
    title: "���������� ���������� ���� ���",
    description:
      "������ ������� ��������. ����� �������� ��� ��������, �������� ��������� ��� ��������� ����� � �������� �������� �������.",
    suggestions: [
      "�������� ����, �������, ���� ��� ������� �����.",
      isDiscoverable
        ? "��������� �������: ������, �������� � ��������� ����� ������ �� ��������."
        : "� ������� ����� ������� ����� ������� ��� ��������� ������.",
      "�������� ������ �������� � ���������� �������� ������ �����."
    ],
    keepRequestOpen: true
  };
}

function buildRequestSummary(
  request: MatchRequestRecord,
  collection: SerializedRequestMatches
): SerializedMatchRequestSummary {
  const requestCard = buildRequestCard(request);

  return {
    id: request.id,
    scenario: request.scenario,
    status: request.status,
    title: requestCard.title,
    subtitle: requestCard.subtitle,
    expiresAt: request.expiresAt.toISOString(),
    lastMatchedAt: request.lastMatchedAt?.toISOString() ?? null,
    activeMatchCount: collection.matches.length,
    fallbackUsed: collection.fallbackUsed
  };
}

function getCounterpartyRequest(match: StoredMatchRecord, requestId: string) {
  if (match.mode !== "REQUEST_TO_REQUEST") {
    return null;
  }

  if (match.sourceRequestId === requestId) {
    return match.candidateRequest;
  }

  if (match.candidateRequestId === requestId) {
    return match.sourceRequest;
  }

  return null;
}

function isVisibleMatchForRequest(
  match: StoredMatchRecord,
  request: MatchRequestRecord,
  now: Date
) {
  if (!ACTIVE_MATCH_STATUSES.includes(match.status)) {
    return false;
  }

  if (match.expiresAt && match.expiresAt <= now) {
    return false;
  }

  if (match.mode === "REQUEST_TO_REQUEST") {
    const counterpartyRequest = getCounterpartyRequest(match, request.id);

    return isRequestEligibleForMatching(counterpartyRequest, now);
  }

  return isFallbackProfileEligible(match.candidateProfile, request.scenario, request.ownerId);
}

function serializeStoredMatch(
  match: StoredMatchRecord,
  requestId: string
): SerializedMatchListItem | null {
  if (match.mode === "REQUEST_TO_REQUEST") {
    const counterpartyRequest = getCounterpartyRequest(match, requestId);

    if (!counterpartyRequest) {
      return null;
    }

    return {
      id: match.id,
      mode: match.mode,
      status: match.status,
      score: match.score,
      reasonSummary: match.reasonSummary,
      dimensions: readStoredDimensions(match.reasonDetails),
      candidateProfile: buildProfileCardFromRequest(counterpartyRequest),
      candidateRequest: buildRequestCard(counterpartyRequest),
      chatReadiness: "READY_FOR_CHAT",
      computedAt: match.computedAt.toISOString(),
      expiresAt: match.expiresAt?.toISOString() ?? null
    };
  }

  if (!match.candidateProfile) {
    return null;
  }

  return {
    id: match.id,
    mode: match.mode,
    status: match.status,
    score: match.score,
    reasonSummary: match.reasonSummary,
    dimensions: readStoredDimensions(match.reasonDetails),
    candidateProfile: buildProfileCardFromProfile(match.candidateProfile),
    candidateRequest: null,
    chatReadiness: "INVITE_REQUIRED",
    computedAt: match.computedAt.toISOString(),
    expiresAt: match.expiresAt?.toISOString() ?? null
  };
}

async function syncExpiredRequestsForOwner(ownerId: string) {
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

async function syncExpiredRequestById(requestId: string) {
  await prisma.request.updateMany({
    where: {
      id: requestId,
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

async function loadRequestById(requestId: string) {
  return prisma.request.findUnique({
    where: {
      id: requestId
    },
    include: requestInclude
  });
}

async function loadOwnedRequests(ownerId: string) {
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

async function loadRelevantMatchesForRequest(requestId: string) {
  return prisma.match.findMany({
    where: {
      OR: [{ sourceRequestId: requestId }, { candidateRequestId: requestId }]
    },
    include: matchInclude
  });
}

async function closeObsoleteMatches(
  requestId: string,
  keepPairKeys: Set<string>,
  now: Date
) {
  const relevantMatches = await loadRelevantMatchesForRequest(requestId);
  const closableIds = relevantMatches
    .filter((match) => !keepPairKeys.has(match.pairKey) && !match.chat)
    .map((match) => match.id);
  const touchedRequestIds = new Set<string>();

  for (const match of relevantMatches) {
    if (keepPairKeys.has(match.pairKey)) {
      continue;
    }

    touchedRequestIds.add(match.sourceRequestId);

    if (match.candidateRequestId) {
      touchedRequestIds.add(match.candidateRequestId);
    }
  }

  if (closableIds.length > 0) {
    await prisma.match.updateMany({
      where: {
        id: {
          in: closableIds
        }
      },
      data: {
        status: "CLOSED",
        expiresAt: now,
        computedAt: now
      }
    });
  }

  return touchedRequestIds;
}

async function closeMatchesForInactiveRequest(requestId: string, now: Date) {
  const relevantMatches = await loadRelevantMatchesForRequest(requestId);
  const closableIds = relevantMatches
    .filter((match) => !match.chat)
    .map((match) => match.id);

  if (closableIds.length === 0) {
    return;
  }

  await prisma.match.updateMany({
    where: {
      id: {
        in: closableIds
      }
    },
    data: {
      status: "EXPIRED",
      expiresAt: now,
      computedAt: now
    }
  });
}

async function persistMatchesForRequest(
  sourceRequest: MatchRequestRecord,
  requestMatches: ScoredRequestCandidate[],
  fallbackMatches: ScoredFallbackCandidate[],
  poolInfo: {
    requestCandidatePoolSize: number;
    fallbackCandidatePoolSize: number;
    fallbackUsed: boolean;
  },
  now: Date
) {
  const keepPairKeys = new Set<string>();
  const touchedRequestIds = new Set<string>([sourceRequest.id]);

  for (const candidate of requestMatches) {
    const sortedIds = [sourceRequest.id, candidate.request.id].sort();
    const pairKey = buildCanonicalRequestPairKey(sourceRequest.id, candidate.request.id);

    keepPairKeys.add(pairKey);
    touchedRequestIds.add(sortedIds[0]);
    touchedRequestIds.add(sortedIds[1]);

    await prisma.match.upsert({
      where: {
        pairKey
      },
      create: {
        pairKey,
        scenario: candidate.scenario,
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: sortedIds[0],
        candidateRequestId: sortedIds[1],
        score: candidate.score,
        reasonSummary: candidate.reasonSummary,
        reasonDetails: buildMatchReasonDetails({
          sourceRequestId: sourceRequest.id,
          candidateRequestId: candidate.request.id,
          dimensions: candidate.dimensions,
          requestCandidatePoolSize: poolInfo.requestCandidatePoolSize,
          fallbackCandidatePoolSize: poolInfo.fallbackCandidatePoolSize,
          fallbackUsed: poolInfo.fallbackUsed
        }),
        computedAt: now,
        expiresAt: candidate.expiresAt
      },
      update: {
        scenario: candidate.scenario,
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: sortedIds[0],
        candidateRequestId: sortedIds[1],
        candidateProfileId: null,
        score: candidate.score,
        reasonSummary: candidate.reasonSummary,
        reasonDetails: buildMatchReasonDetails({
          sourceRequestId: sourceRequest.id,
          candidateRequestId: candidate.request.id,
          dimensions: candidate.dimensions,
          requestCandidatePoolSize: poolInfo.requestCandidatePoolSize,
          fallbackCandidatePoolSize: poolInfo.fallbackCandidatePoolSize,
          fallbackUsed: poolInfo.fallbackUsed
        }),
        computedAt: now,
        expiresAt: candidate.expiresAt
      }
    });
  }

  for (const candidate of fallbackMatches) {
    keepPairKeys.add(candidate.pairKey);

    await prisma.match.upsert({
      where: {
        pairKey: candidate.pairKey
      },
      create: {
        pairKey: candidate.pairKey,
        scenario: candidate.scenario,
        mode: "REQUEST_TO_PROFILE",
        status: "PENDING_RECIPIENT_ACCEPTANCE",
        sourceRequestId: sourceRequest.id,
        candidateProfileId: candidate.profile.id,
        score: candidate.score,
        reasonSummary: candidate.reasonSummary,
        reasonDetails: buildMatchReasonDetails({
          sourceRequestId: sourceRequest.id,
          candidateProfileId: candidate.profile.id,
          dimensions: candidate.dimensions,
          requestCandidatePoolSize: poolInfo.requestCandidatePoolSize,
          fallbackCandidatePoolSize: poolInfo.fallbackCandidatePoolSize,
          fallbackUsed: poolInfo.fallbackUsed
        }),
        computedAt: now,
        expiresAt: candidate.expiresAt
      },
      update: {
        scenario: candidate.scenario,
        mode: "REQUEST_TO_PROFILE",
        status: "PENDING_RECIPIENT_ACCEPTANCE",
        sourceRequestId: sourceRequest.id,
        candidateRequestId: null,
        candidateProfileId: candidate.profile.id,
        score: candidate.score,
        reasonSummary: candidate.reasonSummary,
        reasonDetails: buildMatchReasonDetails({
          sourceRequestId: sourceRequest.id,
          candidateProfileId: candidate.profile.id,
          dimensions: candidate.dimensions,
          requestCandidatePoolSize: poolInfo.requestCandidatePoolSize,
          fallbackCandidatePoolSize: poolInfo.fallbackCandidatePoolSize,
          fallbackUsed: poolInfo.fallbackUsed
        }),
        computedAt: now,
        expiresAt: candidate.expiresAt
      }
    });
  }

  const obsoleteRequestIds = await closeObsoleteMatches(sourceRequest.id, keepPairKeys, now);

  for (const requestId of obsoleteRequestIds) {
    touchedRequestIds.add(requestId);
  }

  await prisma.request.updateMany({
    where: {
      id: {
        in: [...touchedRequestIds]
      }
    },
    data: {
      lastMatchedAt: now
    }
  });
}

async function loadRequestCandidates(sourceRequest: MatchRequestRecord, now: Date) {
  const candidates = await prisma.request.findMany({
    where: {
      ...buildEligibleRequestWhere(now),
      scenario: sourceRequest.scenario,
      ownerId: {
        not: sourceRequest.ownerId
      }
    },
    include: requestInclude
  });

  return candidates.filter((candidate) => candidate.id !== sourceRequest.id);
}

async function loadFallbackProfiles(sourceRequest: MatchRequestRecord, now: Date) {
  return prisma.profile.findMany({
    where: buildDiscoverableFallbackProfileWhere(
      sourceRequest.scenario,
      sourceRequest.ownerId,
      now
    ),
    include: profileInclude
  });
}

function sortMatchesByScore<T extends { score: number }>(matches: T[]) {
  return [...matches].sort((left, right) => right.score - left.score);
}

export class MatchingDomainError extends Error {
  code: string;
  status: number;

  constructor(params: { code: string; message: string; status: number }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
  }
}

export interface MatchingService {
  recomputeForRequest(requestId: string): Promise<RecomputeResult>;
  recomputeForUser(userId: string): Promise<{
    requestIds: string[];
    recomputedCount: number;
  }>;
  refreshForRequest(requestId: string): Promise<RecomputeResult>;
  refreshForOwnedRequest(userId: string, requestId: string): Promise<RecomputeResult>;
  listForOwnedRequest(
    userId: string,
    requestId: string
  ): Promise<SerializedRequestMatches>;
  getDetailForUser(userId: string, matchId: string): Promise<SerializedMatchDetail>;
  getScreenDataForUser(
    userId: string,
    options?: {
      requestId?: string;
      matchId?: string;
    }
  ): Promise<SerializedMatchesScreenData>;
}

export const matchingService: MatchingService = {
  async recomputeForRequest(requestId) {
    await syncExpiredRequestById(requestId);

    const sourceRequest = await loadRequestById(requestId);
    const now = new Date();

    if (!sourceRequest || !isRequestEligibleForMatching(sourceRequest, now)) {
      await closeMatchesForInactiveRequest(requestId, now);

      return {
        requestId,
        refreshed: true,
        matchCount: 0,
        fallbackUsed: false
      };
    }

    const requestCandidates = await loadRequestCandidates(sourceRequest, now);
    const scoredRequestMatches = sortMatchesByScore(
      requestCandidates
        .map((candidate) => {
          const scored = scoreRequestCandidate(sourceRequest, candidate);

          if (scored.score < MATCH_MIN_SCORE) {
            return null;
          }

          return {
            pairKey: buildCanonicalRequestPairKey(sourceRequest.id, candidate.id),
            scenario: sourceRequest.scenario,
            request: candidate,
            score: scored.score,
            reasonSummary: scored.reasonSummary,
            dimensions: scored.dimensions,
            expiresAt:
              sourceRequest.expiresAt < candidate.expiresAt
                ? sourceRequest.expiresAt
                : candidate.expiresAt
          } satisfies ScoredRequestCandidate;
        })
        .filter(Boolean) as ScoredRequestCandidate[]
    ).slice(0, MATCH_LIMIT);

    let scoredFallbackMatches: ScoredFallbackCandidate[] = [];
    const shouldUseFallback =
      scoredRequestMatches.length < MATCH_REQUEST_MIN_COUNT &&
      requestCandidates.length < MATCH_REQUEST_POOL_THRESHOLD;

    if (shouldUseFallback) {
      const fallbackProfiles = await loadFallbackProfiles(sourceRequest, now);

      scoredFallbackMatches = sortMatchesByScore(
        fallbackProfiles
          .map((profile) => {
            if (!isFallbackProfileEligible(profile, sourceRequest.scenario, sourceRequest.ownerId)) {
              return null;
            }

            const scored = scoreFallbackCandidate(sourceRequest, profile);

            if (scored.score < MATCH_MIN_SCORE) {
              return null;
            }

            return {
              pairKey: buildFallbackPairKey(sourceRequest.id, profile.id),
              scenario: sourceRequest.scenario,
              profile,
              score: scored.score,
              reasonSummary: scored.reasonSummary,
              dimensions: scored.dimensions,
              expiresAt: sourceRequest.expiresAt
            } satisfies ScoredFallbackCandidate;
          })
          .filter(Boolean) as ScoredFallbackCandidate[]
      ).slice(0, Math.min(MAX_FALLBACK_MATCHES, MATCH_LIMIT - scoredRequestMatches.length));

      await persistMatchesForRequest(
        sourceRequest,
        scoredRequestMatches,
        scoredFallbackMatches,
        {
          requestCandidatePoolSize: requestCandidates.length,
          fallbackCandidatePoolSize: fallbackProfiles.length,
          fallbackUsed: scoredFallbackMatches.length > 0
        },
        now
      );

      return {
        requestId,
        refreshed: true,
        matchCount: Math.min(
          MATCH_LIMIT,
          scoredRequestMatches.length + scoredFallbackMatches.length
        ),
        fallbackUsed: scoredFallbackMatches.length > 0
      };
    }

    await persistMatchesForRequest(
      sourceRequest,
      scoredRequestMatches,
      [],
      {
        requestCandidatePoolSize: requestCandidates.length,
        fallbackCandidatePoolSize: 0,
        fallbackUsed: false
      },
      now
    );

    return {
      requestId,
      refreshed: true,
      matchCount: scoredRequestMatches.length,
      fallbackUsed: false
    };
  },

  async recomputeForUser(userId) {
    await syncExpiredRequestsForOwner(userId);

    const [user, activeOwnRequests, impactedMatches] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId
        },
        include: {
          profile: true
        }
      }),
      prisma.request.findMany({
        where: {
          ownerId: userId,
          ...buildEligibleRequestWhere(new Date())
        },
        select: {
          id: true,
          scenario: true
        }
      }),
      prisma.match.findMany({
        where: {
          OR: [
            {
              sourceRequest: {
                is: {
                  ownerId: userId
                }
              }
            },
            {
              candidateRequest: {
                is: {
                  ownerId: userId
                }
              }
            },
            {
              candidateProfile: {
                is: {
                  userId
                }
              }
            }
          ]
        },
        select: {
          sourceRequestId: true,
          candidateRequestId: true
        }
      })
    ]);

    if (!user) {
      return {
        requestIds: [],
        recomputedCount: 0
      };
    }

    const relevantScenarios = new Set<ScenarioType>();

    for (const request of activeOwnRequests) {
      relevantScenarios.add(request.scenario);
    }

    for (const scenario of user.profile?.discoverableScenarios ?? []) {
      relevantScenarios.add(scenario);
    }

    const scenarioRequestIds =
      relevantScenarios.size > 0
        ? await prisma.request.findMany({
            where: {
              ...buildEligibleRequestWhere(new Date()),
              scenario: {
                in: [...relevantScenarios]
              }
            },
            select: {
              id: true
            }
          })
        : [];

    const requestIds = [
      ...new Set(
        [
          ...activeOwnRequests.map((request) => request.id),
          ...impactedMatches.flatMap((match) =>
            [match.sourceRequestId, match.candidateRequestId].filter(Boolean)
          ),
          ...scenarioRequestIds.map((request) => request.id)
        ] as string[]
      )
    ];

    for (const requestId of requestIds) {
      await this.recomputeForRequest(requestId);
    }

    return {
      requestIds,
      recomputedCount: requestIds.length
    };
  },

  async refreshForRequest(requestId) {
    return this.recomputeForRequest(requestId);
  },

  async refreshForOwnedRequest(userId, requestId) {
    await syncExpiredRequestsForOwner(userId);

    const request = await prisma.request.findFirst({
      where: {
        id: requestId,
        ownerId: userId,
        status: {
          not: "DELETED"
        }
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!request) {
      throw new MatchingDomainError({
        code: "match_request_not_found",
        message: "������ ��� ������� �� ������.",
        status: 404
      });
    }

    if (request.status !== "ACTIVE") {
      throw new MatchingDomainError({
        code: "match_refresh_not_allowed",
        message: "��������� ������� ����� ������ ��� ��������� �������.",
        status: 409
      });
    }

    return this.refreshForRequest(requestId);
  },

  async listForOwnedRequest(userId, requestId) {
    await syncExpiredRequestsForOwner(userId);

    const request = await prisma.request.findFirst({
      where: {
        id: requestId,
        ownerId: userId,
        status: {
          not: "DELETED"
        }
      },
      include: requestInclude
    });

    if (!request) {
      throw new MatchingDomainError({
        code: "match_request_not_found",
        message: "������ ��� ������� �� ������.",
        status: 404
      });
    }

    if (!isRequestEligibleForMatching(request, new Date())) {
      return {
        requestId: request.id,
        requestTitle: buildRequestCard(request).title,
        requestScenario: request.scenario,
        requestStatus: request.status,
        requestExpiresAt: request.expiresAt.toISOString(),
        lastMatchedAt: request.lastMatchedAt?.toISOString() ?? null,
        matches: [],
        fallbackUsed: false,
        emptyState: buildRequestEmptyState(
          request,
          request.owner.profile?.isDiscoverable ?? false
        )
      };
    }

    const now = new Date();
    const storedMatches = await prisma.match.findMany({
      where: {
        status: {
          in: ACTIVE_MATCH_STATUSES
        },
        OR: [{ sourceRequestId: requestId }, { candidateRequestId: requestId }]
      },
      include: matchInclude,
      orderBy: [{ score: "desc" }, { computedAt: "desc" }]
    });

    const visibleMatches = storedMatches
      .filter((match) => isVisibleMatchForRequest(match, request, now))
      .map((match) => serializeStoredMatch(match, requestId))
      .filter(Boolean) as SerializedMatchListItem[];

    const sortedVisibleMatches = sortMatchesByScore(visibleMatches).slice(0, MATCH_LIMIT);

    return {
      requestId: request.id,
      requestTitle: buildRequestCard(request).title,
      requestScenario: request.scenario,
      requestStatus: request.status,
      requestExpiresAt: request.expiresAt.toISOString(),
      lastMatchedAt: request.lastMatchedAt?.toISOString() ?? null,
      matches: sortedVisibleMatches,
      fallbackUsed: sortedVisibleMatches.some(
        (match) => match.mode === "REQUEST_TO_PROFILE"
      ),
      emptyState:
        sortedVisibleMatches.length === 0
          ? buildRequestEmptyState(
              request,
              request.owner.profile?.isDiscoverable ?? false
            )
          : null
    };
  },

  async getDetailForUser(userId, matchId) {
    const match = await prisma.match.findUnique({
      where: {
        id: matchId
      },
      include: matchInclude
    });

    if (!match) {
      throw new MatchingDomainError({
        code: "match_not_found",
        message: "���� �� ������.",
        status: 404
      });
    }

    const accessibleRequest =
      match.sourceRequest.ownerId === userId
        ? match.sourceRequest
        : match.candidateRequest?.ownerId === userId
          ? match.candidateRequest
          : null;

    const fallbackRecipientUserId = match.candidateProfile?.userId ?? null;
    const canAccess =
      Boolean(accessibleRequest) || fallbackRecipientUserId === userId;

    if (!canAccess) {
      throw new MatchingDomainError({
        code: "match_forbidden",
        message: "���� ���� ����������.",
        status: 403
      });
    }

    const referenceRequest = accessibleRequest ?? match.sourceRequest;
    const serialized = serializeStoredMatch(match, referenceRequest.id);

    if (!serialized) {
      throw new MatchingDomainError({
        code: "match_not_found",
        message: "���� ����������.",
        status: 404
      });
    }

    return {
      ...serialized,
      request: buildRequestCard(referenceRequest)
    };
  },

  async getScreenDataForUser(userId, options) {
    await syncExpiredRequestsForOwner(userId);

    const ownedRequests = await loadOwnedRequests(userId);
    const collections = await Promise.all(
      ownedRequests.map((request) => this.listForOwnedRequest(userId, request.id))
    );

    const collectionById = new Map(
      collections.map((collection) => [collection.requestId, collection])
    );

    const selectedRequestId =
      options?.requestId && collectionById.has(options.requestId)
        ? options.requestId
        : ownedRequests.find((request) => request.status === "ACTIVE")?.id ??
          ownedRequests[0]?.id ??
          null;

    const selectedRequestMatches = selectedRequestId
      ? collectionById.get(selectedRequestId) ?? null
      : null;
    const selectedMatchId =
      options?.matchId &&
      selectedRequestMatches?.matches.some((match) => match.id === options.matchId)
        ? options.matchId
        : null;

    return {
      requests: ownedRequests.map((request) =>
        buildRequestSummary(
          request,
          collectionById.get(request.id) ?? {
            requestId: request.id,
            requestTitle: buildRequestCard(request).title,
            requestScenario: request.scenario,
            requestStatus: request.status,
            requestExpiresAt: request.expiresAt.toISOString(),
            lastMatchedAt: request.lastMatchedAt?.toISOString() ?? null,
            matches: [],
            fallbackUsed: false,
            emptyState: null
          }
        )
      ),
      selectedRequestId,
      selectedMatchId,
      selectedRequestMatches
    };
  }
};
