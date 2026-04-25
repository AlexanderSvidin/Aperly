CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED');
CREATE TYPE "VerificationType" AS ENUM ('TELEGRAM', 'HSE_EMAIL');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
CREATE TYPE "ScenarioType" AS ENUM ('CASE', 'PROJECT', 'STUDY');
CREATE TYPE "CollaborationRole" AS ENUM (
  'ANALYST',
  'DEVELOPER',
  'DESIGNER',
  'PRODUCT_MANAGER',
  'RESEARCHER',
  'MARKETER',
  'FINANCE',
  'PRESENTER',
  'OTHER'
);
CREATE TYPE "FormatPreference" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
CREATE TYPE "DayOfWeek" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);
CREATE TYPE "ProjectStage" AS ENUM ('IDEA', 'MVP', 'EARLY_TRACTION', 'OPERATING');
CREATE TYPE "CommitmentLevel" AS ENUM ('LIGHT', 'PART_TIME', 'HEAVY', 'FLEXIBLE');
CREATE TYPE "StudyFrequency" AS ENUM ('ONCE', 'WEEKLY', 'TWICE_WEEKLY', 'FLEXIBLE');
CREATE TYPE "PreferredTime" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE');
CREATE TYPE "RequestStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CLOSED', 'DELETED');
CREATE TYPE "MatchMode" AS ENUM ('REQUEST_TO_REQUEST', 'REQUEST_TO_PROFILE');
CREATE TYPE "MatchStatus" AS ENUM ('READY', 'PENDING_RECIPIENT_ACCEPTANCE', 'DECLINED', 'EXPIRED', 'CLOSED');
CREATE TYPE "ChatStatus" AS ENUM ('ACTIVE', 'STALE', 'CLOSED', 'BLOCKED');
CREATE TYPE "ContactExchangeStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED_ONE_SIDED', 'MUTUAL_CONSENT', 'DECLINED');
CREATE TYPE "MessageType" AS ENUM ('USER', 'SYSTEM', 'REMINDER');
CREATE TYPE "SessionStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'MISSED');
CREATE TYPE "SessionNextAction" AS ENUM ('NONE', 'SCHEDULE_NEXT', 'FIND_NEW_PARTNER', 'STOP_SEARCHING');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
CREATE TYPE "AdminActionType" AS ENUM ('BLOCK_USER', 'DISABLE_USER', 'UNBLOCK_USER', 'RESOLVE_REPORT');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "telegramId" BIGINT NOT NULL,
  "username" VARCHAR(64),
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100),
  "languageCode" VARCHAR(16),
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "blockedAt" TIMESTAMPTZ,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_telegramId_key" UNIQUE ("telegramId")
);

CREATE TABLE "Profile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "fullName" VARCHAR(160) NOT NULL,
  "bio" TEXT,
  "program" VARCHAR(120),
  "courseYear" INTEGER,
  "campus" VARCHAR(120),
  "preferredFormats" "FormatPreference"[] NOT NULL DEFAULT ARRAY[]::"FormatPreference"[],
  "preferredRoles" "CollaborationRole"[] NOT NULL DEFAULT ARRAY[]::"CollaborationRole"[],
  "isDiscoverable" BOOLEAN NOT NULL DEFAULT FALSE,
  "discoverableScenarios" "ScenarioType"[] NOT NULL DEFAULT ARRAY[]::"ScenarioType"[],
  "telegramUsername" VARCHAR(64),
  "phone" VARCHAR(32),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Profile_userId_key" UNIQUE ("userId")
);

CREATE TABLE "Verification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "VerificationType" NOT NULL,
  "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "email" VARCHAR(160),
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Verification_userId_type_key" UNIQUE ("userId", "type")
);

CREATE TABLE "Skill" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(64) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Skill_slug_key" UNIQUE ("slug"),
  CONSTRAINT "Skill_name_key" UNIQUE ("name")
);

CREATE TABLE "Subject" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(64) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Subject_slug_key" UNIQUE ("slug"),
  CONSTRAINT "Subject_name_key" UNIQUE ("name")
);

CREATE TABLE "UserSkill" (
  "userId" UUID NOT NULL,
  "skillId" UUID NOT NULL,
  "level" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("userId", "skillId")
);

CREATE TABLE "UserSubject" (
  "userId" UUID NOT NULL,
  "subjectId" UUID NOT NULL,
  "confidence" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSubject_pkey" PRIMARY KEY ("userId", "subjectId")
);

CREATE TABLE "Request" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "scenario" "ScenarioType" NOT NULL,
  "status" "RequestStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "lastMatchedAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseRequestDetails" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL,
  "eventName" VARCHAR(160) NOT NULL,
  "deadline" TIMESTAMPTZ,
  "neededRoles" "CollaborationRole"[] NOT NULL DEFAULT ARRAY[]::"CollaborationRole"[],
  "teamGapSize" INTEGER NOT NULL,
  "preferredFormat" "FormatPreference" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseRequestDetails_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CaseRequestDetails_requestId_key" UNIQUE ("requestId"),
  CONSTRAINT "CaseRequestDetails_teamGapSize_check" CHECK ("teamGapSize" > 0)
);

CREATE TABLE "ProjectRequestDetails" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL,
  "projectTitle" VARCHAR(160) NOT NULL,
  "shortDescription" TEXT NOT NULL,
  "stage" "ProjectStage" NOT NULL,
  "neededRoles" "CollaborationRole"[] NOT NULL DEFAULT ARRAY[]::"CollaborationRole"[],
  "expectedCommitment" "CommitmentLevel" NOT NULL,
  "preferredFormat" "FormatPreference" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectRequestDetails_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectRequestDetails_requestId_key" UNIQUE ("requestId")
);

CREATE TABLE "StudyRequestDetails" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL,
  "subjectId" UUID NOT NULL,
  "currentContext" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "desiredFrequency" "StudyFrequency" NOT NULL,
  "preferredTime" "PreferredTime" NOT NULL,
  "preferredFormat" "FormatPreference" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyRequestDetails_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyRequestDetails_requestId_key" UNIQUE ("requestId")
);

CREATE TABLE "AvailabilitySlot" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID,
  "requestId" UUID,
  "dayOfWeek" "DayOfWeek" NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AvailabilitySlot_owner_check" CHECK (
    (
      "profileId" IS NOT NULL AND "requestId" IS NULL
    ) OR (
      "profileId" IS NULL AND "requestId" IS NOT NULL
    )
  ),
  CONSTRAINT "AvailabilitySlot_time_check" CHECK (
    "startMinute" >= 0 AND
    "startMinute" < 1440 AND
    "endMinute" > "startMinute" AND
    "endMinute" <= 1440
  )
);

CREATE TABLE "Match" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "pairKey" VARCHAR(255) NOT NULL,
  "scenario" "ScenarioType" NOT NULL,
  "mode" "MatchMode" NOT NULL,
  "status" "MatchStatus" NOT NULL DEFAULT 'READY',
  "sourceRequestId" UUID NOT NULL,
  "candidateRequestId" UUID,
  "candidateProfileId" UUID,
  "score" INTEGER NOT NULL,
  "reasonSummary" VARCHAR(255) NOT NULL,
  "reasonDetails" JSONB,
  "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ,
  CONSTRAINT "Match_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Match_pairKey_key" UNIQUE ("pairKey"),
  CONSTRAINT "Match_score_check" CHECK ("score" >= 0 AND "score" <= 100),
  CONSTRAINT "Match_candidate_mode_check" CHECK (
    (
      "mode" = 'REQUEST_TO_REQUEST' AND
      "candidateRequestId" IS NOT NULL AND
      "candidateProfileId" IS NULL
    ) OR (
      "mode" = 'REQUEST_TO_PROFILE' AND
      "candidateRequestId" IS NULL AND
      "candidateProfileId" IS NOT NULL
    )
  )
);

CREATE TABLE "Chat" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "matchId" UUID NOT NULL,
  "userAId" UUID NOT NULL,
  "userBId" UUID NOT NULL,
  "status" "ChatStatus" NOT NULL DEFAULT 'ACTIVE',
  "contactExchangeStatus" "ContactExchangeStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "contactRequestedByUserId" UUID,
  "userAContactAcceptedAt" TIMESTAMPTZ,
  "userBContactAcceptedAt" TIMESTAMPTZ,
  "contactSharedAt" TIMESTAMPTZ,
  "lastMessageAt" TIMESTAMPTZ,
  "staleAfterAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Chat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Chat_matchId_key" UNIQUE ("matchId"),
  CONSTRAINT "Chat_participants_check" CHECK ("userAId" <> "userBId")
);

CREATE TABLE "Message" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chatId" UUID NOT NULL,
  "senderId" UUID,
  "type" "MessageType" NOT NULL DEFAULT 'USER',
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "matchId" UUID NOT NULL,
  "chatId" UUID NOT NULL,
  "scheduledByUserId" UUID NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "scheduledFor" TIMESTAMPTZ NOT NULL,
  "format" "FormatPreference" NOT NULL,
  "location" VARCHAR(160),
  "notes" TEXT,
  "status" "SessionStatus" NOT NULL DEFAULT 'PROPOSED',
  "nextAction" "SessionNextAction" NOT NULL DEFAULT 'NONE',
  "confirmedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_chatId_sequenceNumber_key" UNIQUE ("chatId", "sequenceNumber"),
  CONSTRAINT "Session_sequence_positive_check" CHECK ("sequenceNumber" > 0)
);

CREATE TABLE "Report" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reporterUserId" UUID NOT NULL,
  "targetUserId" UUID,
  "matchId" UUID,
  "chatId" UUID,
  "requestId" UUID,
  "reasonCode" VARCHAR(80) NOT NULL,
  "details" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedByAdminId" UUID,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Report_target_context_check" CHECK (
    "targetUserId" IS NOT NULL OR
    "matchId" IS NOT NULL OR
    "chatId" IS NOT NULL OR
    "requestId" IS NOT NULL
  )
);

CREATE TABLE "AdminAction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "adminUserId" UUID NOT NULL,
  "actionType" "AdminActionType" NOT NULL,
  "targetUserId" UUID,
  "reportId" UUID,
  "requestId" UUID,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_blockedAt_deletedAt_idx" ON "User"("status", "blockedAt", "deletedAt");
CREATE INDEX "Profile_isDiscoverable_idx" ON "Profile"("isDiscoverable");
CREATE INDEX "Verification_type_status_idx" ON "Verification"("type", "status");
CREATE INDEX "UserSkill_skillId_idx" ON "UserSkill"("skillId");
CREATE INDEX "UserSubject_subjectId_idx" ON "UserSubject"("subjectId");
CREATE INDEX "Request_ownerId_scenario_status_idx" ON "Request"("ownerId", "scenario", "status");
CREATE INDEX "Request_status_expiresAt_idx" ON "Request"("status", "expiresAt");
CREATE INDEX "Request_scenario_status_expiresAt_idx" ON "Request"("scenario", "status", "expiresAt");
CREATE UNIQUE INDEX "Request_ownerId_scenario_active_key" ON "Request"("ownerId", "scenario") WHERE "status" = 'ACTIVE';
CREATE INDEX "CaseRequestDetails_deadline_idx" ON "CaseRequestDetails"("deadline");
CREATE INDEX "ProjectRequestDetails_stage_idx" ON "ProjectRequestDetails"("stage");
CREATE INDEX "StudyRequestDetails_subjectId_desiredFrequency_idx" ON "StudyRequestDetails"("subjectId", "desiredFrequency");
CREATE INDEX "AvailabilitySlot_profileId_dayOfWeek_idx" ON "AvailabilitySlot"("profileId", "dayOfWeek");
CREATE INDEX "AvailabilitySlot_requestId_dayOfWeek_idx" ON "AvailabilitySlot"("requestId", "dayOfWeek");
CREATE INDEX "Match_sourceRequestId_status_idx" ON "Match"("sourceRequestId", "status");
CREATE INDEX "Match_candidateRequestId_idx" ON "Match"("candidateRequestId");
CREATE INDEX "Match_candidateProfileId_idx" ON "Match"("candidateProfileId");
CREATE INDEX "Match_scenario_status_score_idx" ON "Match"("scenario", "status", "score");
CREATE INDEX "Chat_userAId_status_lastMessageAt_idx" ON "Chat"("userAId", "status", "lastMessageAt");
CREATE INDEX "Chat_userBId_status_lastMessageAt_idx" ON "Chat"("userBId", "status", "lastMessageAt");
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt");
CREATE INDEX "Session_matchId_status_scheduledFor_idx" ON "Session"("matchId", "status", "scheduledFor");
CREATE INDEX "Session_chatId_status_scheduledFor_idx" ON "Session"("chatId", "status", "scheduledFor");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_targetUserId_status_idx" ON "Report"("targetUserId", "status");
CREATE INDEX "AdminAction_actionType_createdAt_idx" ON "AdminAction"("actionType", "createdAt");
CREATE INDEX "AdminAction_targetUserId_createdAt_idx" ON "AdminAction"("targetUserId", "createdAt");

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Verification"
  ADD CONSTRAINT "Verification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSkill"
  ADD CONSTRAINT "UserSkill_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSkill"
  ADD CONSTRAINT "UserSkill_skillId_fkey"
  FOREIGN KEY ("skillId") REFERENCES "Skill"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSubject"
  ADD CONSTRAINT "UserSubject_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserSubject"
  ADD CONSTRAINT "UserSubject_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseRequestDetails"
  ADD CONSTRAINT "CaseRequestDetails_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectRequestDetails"
  ADD CONSTRAINT "ProjectRequestDetails_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudyRequestDetails"
  ADD CONSTRAINT "StudyRequestDetails_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudyRequestDetails"
  ADD CONSTRAINT "StudyRequestDetails_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AvailabilitySlot"
  ADD CONSTRAINT "AvailabilitySlot_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AvailabilitySlot"
  ADD CONSTRAINT "AvailabilitySlot_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_sourceRequestId_fkey"
  FOREIGN KEY ("sourceRequestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_candidateRequestId_fkey"
  FOREIGN KEY ("candidateRequestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_candidateProfileId_fkey"
  FOREIGN KEY ("candidateProfileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_userAId_fkey"
  FOREIGN KEY ("userAId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_userBId_fkey"
  FOREIGN KEY ("userBId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_contactRequestedByUserId_fkey"
  FOREIGN KEY ("contactRequestedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_chatId_fkey"
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_chatId_fkey"
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_scheduledByUserId_fkey"
  FOREIGN KEY ("scheduledByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reporterUserId_fkey"
  FOREIGN KEY ("reporterUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_chatId_fkey"
  FOREIGN KEY ("chatId") REFERENCES "Chat"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report"
  ADD CONSTRAINT "Report_resolvedByAdminId_fkey"
  FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAction"
  ADD CONSTRAINT "AdminAction_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminAction"
  ADD CONSTRAINT "AdminAction_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAction"
  ADD CONSTRAINT "AdminAction_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAction"
  ADD CONSTRAINT "AdminAction_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
