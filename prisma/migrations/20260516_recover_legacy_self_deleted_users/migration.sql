WITH recoverable_users AS (
  SELECT "id"
  FROM "User"
  WHERE "status" = 'DELETED'::"UserStatus"
    AND "role" = 'USER'::"UserRole"
    AND "blockedAt" IS NULL
    AND "onboardingCompleted" = false
)
DELETE FROM "UserSkill"
WHERE "userId" IN (SELECT "id" FROM recoverable_users);

WITH recoverable_users AS (
  SELECT "id"
  FROM "User"
  WHERE "status" = 'DELETED'::"UserStatus"
    AND "role" = 'USER'::"UserRole"
    AND "blockedAt" IS NULL
    AND "onboardingCompleted" = false
)
DELETE FROM "UserSubject"
WHERE "userId" IN (SELECT "id" FROM recoverable_users);

WITH recoverable_users AS (
  SELECT "id"
  FROM "User"
  WHERE "status" = 'DELETED'::"UserStatus"
    AND "role" = 'USER'::"UserRole"
    AND "blockedAt" IS NULL
    AND "onboardingCompleted" = false
)
DELETE FROM "LanguageSkill"
WHERE "userId" IN (SELECT "id" FROM recoverable_users);

WITH recoverable_users AS (
  SELECT "id"
  FROM "User"
  WHERE "status" = 'DELETED'::"UserStatus"
    AND "role" = 'USER'::"UserRole"
    AND "blockedAt" IS NULL
    AND "onboardingCompleted" = false
),
recoverable_profiles AS (
  SELECT "id"
  FROM "Profile"
  WHERE "userId" IN (SELECT "id" FROM recoverable_users)
)
DELETE FROM "AvailabilitySlot"
WHERE "profileId" IN (SELECT "id" FROM recoverable_profiles);

WITH recoverable_users AS (
  SELECT "id"
  FROM "User"
  WHERE "status" = 'DELETED'::"UserStatus"
    AND "role" = 'USER'::"UserRole"
    AND "blockedAt" IS NULL
    AND "onboardingCompleted" = false
)
UPDATE "Profile"
SET
  "fullName" = 'Удалённый профиль',
  "bio" = NULL,
  "campus" = NULL,
  "program" = NULL,
  "courseYear" = NULL,
  "isDiscoverable" = false,
  "discoverableScenarios" = ARRAY[]::"ScenarioType"[],
  "telegramUsername" = NULL,
  "phone" = NULL,
  "preferredFormats" = ARRAY[]::"FormatPreference"[],
  "preferredRoles" = ARRAY[]::"CollaborationRole"[]
WHERE "userId" IN (SELECT "id" FROM recoverable_users);

UPDATE "User"
SET
  "status" = 'INACTIVE'::"UserStatus",
  "onboardingCompleted" = false,
  "deletedAt" = COALESCE("deletedAt", NOW())
WHERE "status" = 'DELETED'::"UserStatus"
  AND "role" = 'USER'::"UserRole"
  AND "blockedAt" IS NULL
  AND "onboardingCompleted" = false;
