ALTER TABLE "Skill" ALTER COLUMN "name" TYPE VARCHAR(240);
ALTER TABLE "Subject" ALTER COLUMN "name" TYPE VARCHAR(240);
ALTER TABLE "CaseRequestDetails" ALTER COLUMN "eventName" TYPE VARCHAR(240);
ALTER TABLE "ProjectRequestDetails" ALTER COLUMN "projectTitle" TYPE VARCHAR(240);
ALTER TABLE "ActivityRequestDetails" ALTER COLUMN "title" TYPE VARCHAR(240);
ALTER TABLE "ActivityRequestDetails" ALTER COLUMN "location" TYPE VARCHAR(240);
ALTER TABLE "StudyRequestDetails" ALTER COLUMN "subjectId" DROP NOT NULL;

ALTER TABLE "StudyRequestDetails"
  ADD COLUMN IF NOT EXISTS "subjects" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

UPDATE "StudyRequestDetails"
SET "subjects" = ARRAY["subjectId"]::UUID[]
WHERE cardinality("subjects") = 0;

CREATE INDEX IF NOT EXISTS "StudyRequestDetails_subjects_idx"
  ON "StudyRequestDetails" USING GIN ("subjects");

UPDATE "Request" AS request
SET
  "status" = 'CLOSED'::"RequestStatus",
  "closedAt" = COALESCE(request."closedAt", NOW())
FROM "User" AS owner
WHERE request."ownerId" = owner."id"
  AND request."status" IN ('ACTIVE'::"RequestStatus", 'DRAFT'::"RequestStatus")
  AND (
    owner."status" <> 'ACTIVE'::"UserStatus"
    OR owner."deletedAt" IS NOT NULL
  );

UPDATE "Interaction" AS interaction
SET
  "status" = 'CANCELLED'::"InteractionStatus",
  "decidedAt" = COALESCE(interaction."decidedAt", NOW())
WHERE interaction."status" = 'PENDING'::"InteractionStatus"
  AND (
    interaction."senderUserId" IN (
      SELECT "id"
      FROM "User"
      WHERE "status" <> 'ACTIVE'::"UserStatus"
        OR "deletedAt" IS NOT NULL
    )
    OR interaction."recipientUserId" IN (
      SELECT "id"
      FROM "User"
      WHERE "status" <> 'ACTIVE'::"UserStatus"
        OR "deletedAt" IS NOT NULL
    )
    OR interaction."sourceRequestId" IN (
      SELECT "id"
      FROM "Request"
      WHERE "status" <> 'ACTIVE'::"RequestStatus"
    )
    OR interaction."targetRequestId" IN (
      SELECT "id"
      FROM "Request"
      WHERE "status" <> 'ACTIVE'::"RequestStatus"
    )
  );
