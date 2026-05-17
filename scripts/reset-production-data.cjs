const { PrismaClient } = require("@prisma/client");

const REQUIRED_CONFIRMATION = "YES";

const deletionPlan = [
  // Admin/moderation records hold restrictive references to users.
  ["AdminAction", "adminAction"],
  ["Report", "report"],

  // Chat/session state depends on users, matches, and chats.
  ["Session", "session"],
  ["Message", "message"],
  ["Chat", "chat"],

  // Connection/interactions should be removed before their user/request inputs.
  ["Connection", "connection"],
  ["Interaction", "interaction"],

  // Matching output depends on requests and fallback profiles.
  ["Match", "match"],

  // Request/profile child tables.
  ["AvailabilitySlot", "availabilitySlot"],
  ["ActivityRequestDetails", "activityRequestDetails"],
  ["StudyRequestDetails", "studyRequestDetails"],
  ["ProjectRequestDetails", "projectRequestDetails"],
  ["CaseRequestDetails", "caseRequestDetails"],
  ["Request", "request"],

  // User-owned profile/onboarding/capability data.
  ["LanguageSkill", "languageSkill"],
  ["UserSubject", "userSubject"],
  ["UserSkill", "userSkill"],
  ["Verification", "verification"],
  ["Profile", "profile"],
  ["User", "user"]
];

function assertConfirmed() {
  if (process.env.CONFIRM_RESET_APP_DATA !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Refusing to reset app data. Set CONFIRM_RESET_APP_DATA=${REQUIRED_CONFIRMATION} to run this destructive cleanup.`
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
}

function describeDatabaseTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return `${url.host}${url.pathname}`;
  } catch {
    return "DATABASE_URL is set, but could not be parsed for display.";
  }
}

async function countRemaining(prisma) {
  const counts = [];

  for (const [modelName, delegateName] of deletionPlan) {
    const delegate = prisma[delegateName];

    if (!delegate || typeof delegate.count !== "function") {
      throw new Error(
        `Prisma delegate not found for ${modelName}: ${delegateName}`
      );
    }

    const count = await delegate.count();
    counts.push({ modelName, count });
  }

  return counts;
}

async function resetAppData() {
  assertConfirmed();

  const prisma = new PrismaClient();

  try {
    console.log("Aperly app data reset");
    console.log(`Database target: ${describeDatabaseTarget()}`);
    console.log("Confirmation: CONFIRM_RESET_APP_DATA=YES");
    console.log("");

    const deleted = await prisma.$transaction(
      async (tx) => {
        const results = [];

        for (const [modelName, delegateName] of deletionPlan) {
          const delegate = tx[delegateName];

          if (!delegate || typeof delegate.deleteMany !== "function") {
            throw new Error(
              `Prisma delegate not found for ${modelName}: ${delegateName}`
            );
          }

          const result = await delegate.deleteMany({});
          results.push({ modelName, count: result.count });
        }

        return results;
      },
      {
        maxWait: 10000,
        timeout: 120000
      }
    );

    console.log("Deleted records:");
    for (const { modelName, count } of deleted) {
      console.log(`${modelName}: ${count}`);
    }

    const remaining = await countRemaining(prisma);
    const nonEmptyModels = remaining.filter(({ count }) => count > 0);

    if (nonEmptyModels.length > 0) {
      console.log("");
      console.error("Reset finished, but some app-data models are not empty:");
      for (const { modelName, count } of nonEmptyModels) {
        console.error(`${modelName}: ${count}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("Verification: all targeted app-data models are empty.");
    console.log(
      "Retained lookup/system tables: Skill, Subject, _prisma_migrations."
    );
    console.log(
      "Note: npm run db:seed and npm run db:setup recreate demo users and requests."
    );
  } finally {
    await prisma.$disconnect();
  }
}

resetAppData().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
