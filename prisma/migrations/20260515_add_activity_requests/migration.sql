-- Add Product Logic v2.0 activity requests.
ALTER TYPE "ScenarioType" ADD VALUE IF NOT EXISTS 'ACTIVITY';

CREATE TYPE "ActivitySubtype" AS ENUM ('CLUB', 'MEETING', 'SPORT', 'HOBBY', 'OTHER');

CREATE TABLE "ActivityRequestDetails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requestId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "activitySubtype" "ActivitySubtype" NOT NULL,
    "time" TIMESTAMP(3),
    "preferredFormat" "FormatPreference" NOT NULL,
    "location" VARCHAR(160),
    "peopleCount" INTEGER NOT NULL,
    "recurrence" "StudyFrequency" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityRequestDetails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityRequestDetails_requestId_key" ON "ActivityRequestDetails"("requestId");
CREATE INDEX "ActivityRequestDetails_activitySubtype_time_idx" ON "ActivityRequestDetails"("activitySubtype", "time");

ALTER TABLE "ActivityRequestDetails" ADD CONSTRAINT "ActivityRequestDetails_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
