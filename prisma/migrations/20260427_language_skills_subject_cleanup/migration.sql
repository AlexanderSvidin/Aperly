CREATE TYPE "Language" AS ENUM ('ENGLISH');

CREATE TYPE "LanguageLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

CREATE TABLE "LanguageSkill" (
    "userId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "level" "LanguageLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LanguageSkill_pkey" PRIMARY KEY ("userId","language")
);

CREATE INDEX "LanguageSkill_language_level_idx" ON "LanguageSkill"("language", "level");

ALTER TABLE "LanguageSkill" ADD CONSTRAINT "LanguageSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LanguageSkill" ("userId", "language", "level", "createdAt", "updatedAt")
SELECT DISTINCT ON ("UserSubject"."userId")
  "UserSubject"."userId",
  'ENGLISH'::"Language",
  CASE "Subject"."slug"
    WHEN 'english-a1' THEN 'A1'::"LanguageLevel"
    WHEN 'english-a2' THEN 'A2'::"LanguageLevel"
    WHEN 'english-b1' THEN 'B1'::"LanguageLevel"
    WHEN 'english-b2' THEN 'B2'::"LanguageLevel"
    WHEN 'english-c1' THEN 'C1'::"LanguageLevel"
    WHEN 'english-c2' THEN 'C2'::"LanguageLevel"
    ELSE 'B1'::"LanguageLevel"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "UserSubject"
JOIN "Subject" ON "Subject"."id" = "UserSubject"."subjectId"
WHERE "Subject"."slug" IN (
  'english-a1',
  'english-a2',
  'english-b1',
  'english-b2',
  'english-c1',
  'english-c2',
  'english-course',
  'independent-english-exam'
)
ON CONFLICT ("userId", "language") DO UPDATE SET
  "level" = EXCLUDED."level",
  "updatedAt" = CURRENT_TIMESTAMP;

DELETE FROM "UserSubject"
USING "Subject"
WHERE "UserSubject"."subjectId" = "Subject"."id"
  AND "Subject"."slug" IN (
    'english-a1',
    'english-a2',
    'english-b1',
    'english-b2',
    'english-c1',
    'english-c2',
    'english-course',
    'independent-english-exam'
  );

DELETE FROM "Subject"
WHERE "slug" IN (
  'english-a1',
  'english-a2',
  'english-b1',
  'english-b2',
  'english-c1',
  'english-c2',
  'english-course',
  'independent-english-exam'
);
