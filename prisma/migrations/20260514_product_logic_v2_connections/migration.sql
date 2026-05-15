CREATE TYPE "InteractionType" AS ENUM ('RESPONSE', 'INVITATION');
CREATE TYPE "InteractionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'ENDED', 'ARCHIVED');

CREATE TABLE "Interaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "InteractionType" NOT NULL,
  "status" "InteractionStatus" NOT NULL DEFAULT 'PENDING',
  "scenario" "ScenarioType" NOT NULL,
  "matchId" UUID,
  "sourceRequestId" UUID,
  "targetRequestId" UUID,
  "targetProfileId" UUID,
  "senderUserId" UUID NOT NULL,
  "recipientUserId" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  "archivedAt" TIMESTAMPTZ,
  CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Interaction_participants_check" CHECK ("senderUserId" <> "recipientUserId"),
  CONSTRAINT "Interaction_target_check" CHECK (
    "targetRequestId" IS NOT NULL OR
    "targetProfileId" IS NOT NULL OR
    "matchId" IS NOT NULL
  )
);

CREATE TABLE "Connection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "interactionId" UUID NOT NULL,
  "matchId" UUID,
  "scenario" "ScenarioType" NOT NULL,
  "userAId" UUID NOT NULL,
  "userBId" UUID NOT NULL,
  "sourceRequestId" UUID,
  "targetRequestId" UUID,
  "targetProfileId" UUID,
  "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "telegramSharedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMPTZ,
  "archivedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Connection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Connection_interactionId_key" UNIQUE ("interactionId"),
  CONSTRAINT "Connection_participants_check" CHECK ("userAId" <> "userBId")
);

CREATE INDEX "Interaction_senderUserId_status_createdAt_idx" ON "Interaction"("senderUserId", "status", "createdAt");
CREATE INDEX "Interaction_recipientUserId_status_createdAt_idx" ON "Interaction"("recipientUserId", "status", "createdAt");
CREATE INDEX "Interaction_targetRequestId_status_idx" ON "Interaction"("targetRequestId", "status");
CREATE INDEX "Interaction_sourceRequestId_status_idx" ON "Interaction"("sourceRequestId", "status");
CREATE INDEX "Interaction_matchId_status_idx" ON "Interaction"("matchId", "status");
CREATE INDEX "Connection_userAId_status_createdAt_idx" ON "Connection"("userAId", "status", "createdAt");
CREATE INDEX "Connection_userBId_status_createdAt_idx" ON "Connection"("userBId", "status", "createdAt");
CREATE INDEX "Connection_scenario_status_createdAt_idx" ON "Connection"("scenario", "status", "createdAt");
CREATE INDEX "Connection_matchId_idx" ON "Connection"("matchId");

ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_sourceRequestId_fkey"
  FOREIGN KEY ("sourceRequestId") REFERENCES "Request"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_targetRequestId_fkey"
  FOREIGN KEY ("targetRequestId") REFERENCES "Request"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_targetProfileId_fkey"
  FOREIGN KEY ("targetProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Connection"
  ADD CONSTRAINT "Connection_interactionId_fkey"
  FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Connection"
  ADD CONSTRAINT "Connection_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Connection"
  ADD CONSTRAINT "Connection_userAId_fkey"
  FOREIGN KEY ("userAId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Connection"
  ADD CONSTRAINT "Connection_userBId_fkey"
  FOREIGN KEY ("userBId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Connection"
  ADD CONSTRAINT "Connection_sourceRequestId_fkey"
  FOREIGN KEY ("sourceRequestId") REFERENCES "Request"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Connection"
  ADD CONSTRAINT "Connection_targetRequestId_fkey"
  FOREIGN KEY ("targetRequestId") REFERENCES "Request"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Connection"
  ADD CONSTRAINT "Connection_targetProfileId_fkey"
  FOREIGN KEY ("targetProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
