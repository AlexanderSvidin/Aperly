import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, test } from "node:test";

import { prisma } from "@/server/db/client";
import { validateTelegramInitData } from "@/server/services/auth/telegram-init-data";
import { chatService } from "@/server/services/chat/chat-service";
import {
  buildHomeLatestMatches,
  buildHomeRequestItem
} from "@/server/services/home/home-presenters";
import { homeService } from "@/server/services/home/home-service";
import { moderationService } from "@/server/services/moderation/moderation-service";
import { requestService } from "@/server/services/requests/request-service";
import { studySessionService } from "@/server/services/study-sessions/study-session-service";

Object.assign(process.env, { NODE_ENV: "test" });

let telegramCounter = BigInt(Date.now()) * 1000n;

type TestContext = {
  prefix: string;
  userIds: string[];
  requestIds: string[];
  matchIds: string[];
  chatIds: string[];
  sessionIds: string[];
  reportIds: string[];
  subjectIds: string[];
};

function nextTelegramId() {
  telegramCounter += 1n;

  return telegramCounter;
}

function buildPrefix(label: string) {
  return `test_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildContext(label: string): TestContext {
  return {
    prefix: buildPrefix(label),
    userIds: [],
    requestIds: [],
    matchIds: [],
    chatIds: [],
    sessionIds: [],
    reportIds: [],
    subjectIds: []
  };
}

async function cleanupContext(context: TestContext) {
  await prisma.adminAction.deleteMany({
    where: {
      OR: [
        { adminUserId: { in: context.userIds } },
        { targetUserId: { in: context.userIds } },
        { requestId: { in: context.requestIds } },
        { reportId: { in: context.reportIds } }
      ]
    }
  });

  await prisma.report.deleteMany({
    where: {
      OR: [
        { id: { in: context.reportIds } },
        { reporterUserId: { in: context.userIds } },
        { targetUserId: { in: context.userIds } },
        { requestId: { in: context.requestIds } }
      ]
    }
  });

  await prisma.message.deleteMany({
    where: {
      chatId: { in: context.chatIds }
    }
  });

  await prisma.session.deleteMany({
    where: {
      id: { in: context.sessionIds }
    }
  });

  await prisma.chat.deleteMany({
    where: {
      id: { in: context.chatIds }
    }
  });

  await prisma.match.deleteMany({
    where: {
      id: { in: context.matchIds }
    }
  });

  await prisma.request.deleteMany({
    where: {
      id: { in: context.requestIds }
    }
  });

  await prisma.user.deleteMany({
    where: {
      id: { in: context.userIds }
    }
  });

  await prisma.subject.deleteMany({
    where: {
      id: { in: context.subjectIds }
    }
  });
}

async function createUser(
  context: TestContext,
  input?: {
    role?: "USER" | "ADMIN";
    status?: "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED";
    firstName?: string;
    lastName?: string | null;
    username?: string | null;
  }
) {
  const user = await prisma.user.create({
    data: {
      telegramId: nextTelegramId(),
      firstName: input?.firstName ?? "Test",
      lastName: input?.lastName ?? context.prefix,
      username:
        input?.username === undefined
          ? `${context.prefix}_${context.userIds.length}`.slice(0, 30)
          : input.username,
      role: input?.role ?? "USER",
      status: input?.status ?? "ACTIVE",
      onboardingCompleted: true,
      profile: {
        create: {
          fullName: `${input?.firstName ?? "Test"} ${context.prefix}`.trim(),
          program: "ba-international-business-economics",
          isDiscoverable: true,
          discoverableScenarios: ["STUDY", "PROJECT"],
          preferredFormats: ["ONLINE"]
        }
      }
    },
    include: {
      profile: true
    }
  });

  context.userIds.push(user.id);

  return user;
}

async function createSubject(context: TestContext) {
  const subject = await prisma.subject.create({
    data: {
      slug: `${context.prefix}_subject`,
      name: `${context.prefix} Subject`
    }
  });

  context.subjectIds.push(subject.id);

  return subject;
}

async function createStudyRequest(
  context: TestContext,
  ownerId: string,
  subjectId: string
) {
  const request = await prisma.request.create({
    data: {
      ownerId,
      scenario: "STUDY",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      studyDetails: {
        create: {
          subjectId,
          currentContext: `${context.prefix} current context`,
          goal: `${context.prefix} shared goal`,
          desiredFrequency: "WEEKLY",
          preferredTime: "EVENING",
          preferredFormat: "ONLINE"
        }
      }
    }
  });

  context.requestIds.push(request.id);

  return request;
}

async function createProjectRequest(context: TestContext, ownerId: string) {
  const request = await prisma.request.create({
    data: {
      ownerId,
      scenario: "PROJECT",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      projectDetails: {
        create: {
          projectTitle: `${context.prefix} Project`,
          shortDescription: `${context.prefix} project description for moderation flow`,
          stage: "MVP",
          neededRoles: ["DEVELOPER"],
          expectedCommitment: "PART_TIME",
          preferredFormat: "ONLINE"
        }
      }
    }
  });

  context.requestIds.push(request.id);

  return request;
}

function buildSignedTelegramInitData(params: {
  botToken: string;
  authDate: number;
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
}) {
  const searchParams = new URLSearchParams({
    auth_date: String(params.authDate),
    query_id: "test-query",
    user: JSON.stringify(params.user)
  });

  const dataCheckString = [...searchParams.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData")
    .update(params.botToken)
    .digest();
  const hash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  searchParams.set("hash", hash);

  return searchParams.toString();
}

after(async () => {
  await prisma.$disconnect();
});

test("buildHomeRequestItem summarizes StudyBuddy request data", () => {
  const item = buildHomeRequestItem(
    {
      id: "request-study",
      scenario: "STUDY",
      status: "ACTIVE",
      notes: null,
      expiresAt: "2026-05-01T10:00:00.000Z",
      createdAt: "2026-04-20T10:00:00.000Z",
      updatedAt: "2026-04-20T10:00:00.000Z",
      lastMatchedAt: null,
      closedAt: null,
      availabilitySlots: [],
      details: {
        type: "STUDY",
        subjectId: "subject-id",
        subjectName: "Микроэкономика",
        subjectSlug: "microeconomics",
        currentContext: "Готовимся к семинару",
        goal: "Разобрать задачи перед контрольной",
        desiredFrequency: "WEEKLY",
        preferredTime: "EVENING",
        preferredFormat: "ONLINE"
      }
    },
    3
  );

  assert.equal(item.title, "Микроэкономика");
  assert.equal(item.activeMatchCount, 3);
  assert.match(item.subtitle, /Раз/);
});

test("buildHomeLatestMatches sorts by recency first and score second", () => {
  const items = buildHomeLatestMatches([
    {
      requestId: "request-a",
      requestTitle: "Запрос A",
      requestScenario: "PROJECT",
      requestStatus: "ACTIVE",
      requestExpiresAt: "2026-05-01T10:00:00.000Z",
      lastMatchedAt: null,
      fallbackUsed: false,
      emptyState: null,
      matches: [
        {
          id: "match-older-high",
          mode: "REQUEST_TO_REQUEST",
          status: "READY",
          score: 99,
          reasonSummary: "older high score",
          dimensions: [],
          candidateProfile: {
            id: "profile-1",
            userId: "user-1",
            fullName: "User One",
            bio: null,
            program: null,
            courseYear: null,
            preferredFormats: [],
            skillNames: [],
            subjectNames: [],
            availabilityLabels: [],
            isDiscoverable: true
          },
          candidateRequest: null,
          chatReadiness: "READY_FOR_CHAT",
          computedAt: "2026-04-20T10:00:00.000Z",
          expiresAt: null
        },
        {
          id: "match-newer-low",
          mode: "REQUEST_TO_REQUEST",
          status: "READY",
          score: 70,
          reasonSummary: "newer low score",
          dimensions: [],
          candidateProfile: {
            id: "profile-2",
            userId: "user-2",
            fullName: "User Two",
            bio: null,
            program: null,
            courseYear: null,
            preferredFormats: [],
            skillNames: [],
            subjectNames: [],
            availabilityLabels: [],
            isDiscoverable: true
          },
          candidateRequest: null,
          chatReadiness: "INVITE_REQUIRED",
          computedAt: "2026-04-21T10:00:00.000Z",
          expiresAt: null
        }
      ]
    }
  ]);

  assert.deepEqual(
    items.map((item) => item.id),
    ["match-newer-low", "match-older-high"]
  );
});

test("homeService composes dashboard with active requests, chats and StudyBuddy session", async () => {
  const context = buildContext("home");

  try {
    const owner = await createUser(context, { firstName: "Owner" });
    const partner = await createUser(context, { firstName: "Partner" });
    const subject = await createSubject(context);
    const ownerRequest = await createStudyRequest(context, owner.id, subject.id);
    const partnerRequest = await createStudyRequest(context, partner.id, subject.id);

    const match = await prisma.match.create({
      data: {
        pairKey: `${context.prefix}_pair`,
        scenario: "STUDY",
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: ownerRequest.id,
        candidateRequestId: partnerRequest.id,
        score: 88,
        reasonSummary: `${context.prefix} matching reason`,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      }
    });
    context.matchIds.push(match.id);

    const chat = await prisma.chat.create({
      data: {
        matchId: match.id,
        userAId: owner.id,
        userBId: partner.id,
        status: "ACTIVE",
        lastMessageAt: new Date(),
        staleAfterAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
      }
    });
    context.chatIds.push(chat.id);

    await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: owner.id,
        type: "USER",
        text: `${context.prefix} hello`
      }
    });

    const upcomingSession = await prisma.session.create({
      data: {
        matchId: match.id,
        chatId: chat.id,
        scheduledByUserId: owner.id,
        sequenceNumber: 1,
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
        format: "ONLINE",
        notes: `${context.prefix} upcoming`,
        status: "CONFIRMED",
        nextAction: "NONE",
        confirmedAt: new Date()
      }
    });
    context.sessionIds.push(upcomingSession.id);

    const completedSession = await prisma.session.create({
      data: {
        matchId: match.id,
        chatId: chat.id,
        scheduledByUserId: owner.id,
        sequenceNumber: 2,
        scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000),
        format: "ONLINE",
        notes: `${context.prefix} completed`,
        status: "COMPLETED",
        nextAction: "SCHEDULE_NEXT",
        completedAt: new Date()
      }
    });
    context.sessionIds.push(completedSession.id);

    const dashboard = await homeService.getDashboardForUser(owner.id);

    assert.equal(dashboard.activeRequests.length, 1);
    assert.equal(dashboard.activeRequests[0]?.title, `${context.prefix} Subject`);
    assert.equal(dashboard.latestMatches.length, 1);
    assert.equal(dashboard.latestMatches[0]?.candidateName, partner.profile?.fullName);
    assert.equal(dashboard.activeChats.length, 1);
    assert.equal(
      dashboard.activeChats[0]?.otherUser.displayName,
      partner.profile?.fullName
    );
    assert.equal(dashboard.upcomingStudySession?.subjectName, `${context.prefix} Subject`);
    assert.equal(dashboard.upcomingStudySession?.chatId, chat.id);
    assert.equal(dashboard.studyContinuation?.recommendedAction, "SCHEDULE_NEXT");
    assert.equal(dashboard.studyContinuation?.canFindNewPartner, true);
    assert.equal(dashboard.primaryCta.href, "/requests/new");
  } finally {
    await cleanupContext(context);
  }
});

test("moderationService blocks users, closes chats and resolves reports with audit log", async () => {
  const context = buildContext("moderation");

  try {
    const admin = await createUser(context, {
      role: "ADMIN",
      firstName: "Admin"
    });
    const target = await createUser(context, { firstName: "Target" });
    const partner = await createUser(context, { firstName: "Partner" });
    const reporter = await createUser(context, { firstName: "Reporter" });
    const targetRequest = await createProjectRequest(context, target.id);
    const partnerRequest = await createProjectRequest(context, partner.id);

    const match = await prisma.match.create({
      data: {
        pairKey: `${context.prefix}_project_pair`,
        scenario: "PROJECT",
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: targetRequest.id,
        candidateRequestId: partnerRequest.id,
        score: 75,
        reasonSummary: `${context.prefix} project match`,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      }
    });
    context.matchIds.push(match.id);

    const chat = await prisma.chat.create({
      data: {
        matchId: match.id,
        userAId: target.id,
        userBId: partner.id,
        status: "ACTIVE",
        lastMessageAt: new Date(),
        staleAfterAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
      }
    });
    context.chatIds.push(chat.id);

    const report = await prisma.report.create({
      data: {
        reporterUserId: reporter.id,
        targetUserId: target.id,
        requestId: targetRequest.id,
        reasonCode: "spam",
        details: `${context.prefix} report details`,
        status: "OPEN"
      }
    });
    context.reportIds.push(report.id);

    const blockResult = await moderationService.updateUserStatus(
      admin.id,
      target.id,
      "BLOCK",
      `${context.prefix} block note`
    );

    const blockedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: target.id
      },
      select: {
        status: true,
        blockedAt: true
      }
    });

    const blockedChat = await prisma.chat.findUniqueOrThrow({
      where: {
        id: chat.id
      },
      select: {
        status: true
      }
    });

    const blockAction = await prisma.adminAction.findFirst({
      where: {
        adminUserId: admin.id,
        targetUserId: target.id,
        actionType: "BLOCK_USER"
      },
      select: {
        id: true
      }
    });

    assert.equal(blockResult.status, "BLOCKED");
    assert.equal(blockedUser.status, "BLOCKED");
    assert.ok(blockedUser.blockedAt);
    assert.equal(blockedChat.status, "BLOCKED");
    assert.ok(blockAction);

    const resolvedReport = await moderationService.resolveReport(
      admin.id,
      report.id,
      `${context.prefix} resolved`
    );

    const storedReport = await prisma.report.findUniqueOrThrow({
      where: {
        id: report.id
      },
      select: {
        status: true,
        resolvedAt: true,
        resolvedByAdminId: true
      }
    });

    const resolveAction = await prisma.adminAction.findFirst({
      where: {
        adminUserId: admin.id,
        reportId: report.id,
        actionType: "RESOLVE_REPORT"
      },
      select: {
        id: true
      }
    });

    const dashboard = await moderationService.getDashboard(admin.id);

    assert.equal(resolvedReport.status, "RESOLVED");
    assert.equal(storedReport.status, "RESOLVED");
    assert.ok(storedReport.resolvedAt);
    assert.equal(storedReport.resolvedByAdminId, admin.id);
    assert.ok(resolveAction);
    assert.ok(dashboard.users.some((user) => user.id === target.id));
    assert.ok(dashboard.reports.some((item) => item.id === report.id));
    assert.ok(
      dashboard.actions.some((action) => action.actionType === "RESOLVE_REPORT")
    );
  } finally {
    await cleanupContext(context);
  }
});

test("validateTelegramInitData accepts signed Telegram Mini App payloads", () => {
  const botToken = "123456:test-token";
  const authDate = Math.floor(Date.now() / 1000);
  const initData = buildSignedTelegramInitData({
    botToken,
    authDate,
    user: {
      id: 777001,
      first_name: "Александр",
      last_name: "Свидин",
      username: "aperly_test",
      language_code: "ru"
    }
  });

  const validated = validateTelegramInitData({
    botToken,
    initData,
    maxAgeSeconds: 60
  });

  assert.equal(validated.user.id, 777001);
  assert.equal(validated.user.firstName, "Александр");
  assert.equal(validated.user.username, "aperly_test");
});

test("requestService creates StudyBuddy request and recomputes R2R matches", async () => {
  const context = buildContext("request_matching");

  try {
    const owner = await createUser(context, { firstName: "StudyOwner" });
    const partner = await createUser(context, { firstName: "StudyPartner" });
    const subject = await createSubject(context);
    const partnerRequest = await createStudyRequest(context, partner.id, subject.id);

    const created = await requestService.create(
      {
        id: owner.id,
        status: "ACTIVE",
        onboardingCompleted: true
      },
      {
        scenario: "STUDY",
        notes: "",
        availabilitySlots: [],
        details: {
          subjectId: subject.id,
          currentContext: `${context.prefix} preparing for seminar`,
          goal: `${context.prefix} solve weekly tasks`,
          desiredFrequency: "WEEKLY",
          preferredTime: "EVENING",
          preferredFormat: "ONLINE"
        }
      }
    );
    context.requestIds.push(created.id);

    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { sourceRequestId: created.id },
          { candidateRequestId: created.id }
        ]
      }
    });
    context.matchIds.push(...matches.map((match) => match.id));

    assert.equal(created.details.type, "STUDY");
    assert.ok(
      matches.some(
        (match) =>
          match.mode === "REQUEST_TO_REQUEST" &&
          (match.sourceRequestId === partnerRequest.id ||
            match.candidateRequestId === partnerRequest.id)
      )
    );
  } finally {
    await cleanupContext(context);
  }
});

test("chatService decline keeps contacts hidden and writes decline message", async () => {
  const context = buildContext("contact_decline");

  try {
    const owner = await createUser(context, { firstName: "ContactOwner" });
    const partner = await createUser(context, { firstName: "ContactPartner" });
    const ownerRequest = await createProjectRequest(context, owner.id);
    const partnerRequest = await createProjectRequest(context, partner.id);

    const match = await prisma.match.create({
      data: {
        pairKey: `${context.prefix}_contact_pair`,
        scenario: "PROJECT",
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: ownerRequest.id,
        candidateRequestId: partnerRequest.id,
        score: 82,
        reasonSummary: `${context.prefix} contact exchange reason`,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      }
    });
    context.matchIds.push(match.id);

    const chat = await prisma.chat.create({
      data: {
        matchId: match.id,
        userAId: owner.id,
        userBId: partner.id,
        status: "ACTIVE",
        lastMessageAt: new Date(),
        staleAfterAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
      }
    });
    context.chatIds.push(chat.id);

    await chatService.requestContactExchange(owner.id, chat.id);
    const result = await chatService.respondToContactExchange(
      partner.id,
      chat.id,
      "DECLINE"
    );

    const storedChat = await prisma.chat.findUniqueOrThrow({
      where: { id: chat.id },
      select: {
        contactExchangeStatus: true,
        contactSharedAt: true
      }
    });

    const lastSystemMessage = await prisma.message.findFirst({
      where: {
        chatId: chat.id,
        type: "SYSTEM"
      },
      orderBy: { createdAt: "desc" },
      select: { text: true }
    });

    assert.equal(result.status, "DECLINED");
    assert.equal(result.revealedContacts, null);
    assert.equal(storedChat.contactExchangeStatus, "DECLINED");
    assert.equal(storedChat.contactSharedAt, null);
    assert.match(lastSystemMessage?.text ?? "", /отклон/i);
  } finally {
    await cleanupContext(context);
  }
});

test("studySessionService supports first session, completion and repeat scheduling", async () => {
  const context = buildContext("study_session");

  try {
    const owner = await createUser(context, { firstName: "SessionOwner" });
    const partner = await createUser(context, { firstName: "SessionPartner" });
    const subject = await createSubject(context);
    const ownerRequest = await createStudyRequest(context, owner.id, subject.id);
    const partnerRequest = await createStudyRequest(context, partner.id, subject.id);

    const match = await prisma.match.create({
      data: {
        pairKey: `${context.prefix}_study_pair`,
        scenario: "STUDY",
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: ownerRequest.id,
        candidateRequestId: partnerRequest.id,
        score: 91,
        reasonSummary: `${context.prefix} study match`,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      }
    });
    context.matchIds.push(match.id);

    const chat = await prisma.chat.create({
      data: {
        matchId: match.id,
        userAId: owner.id,
        userBId: partner.id,
        status: "ACTIVE",
        lastMessageAt: new Date(),
        staleAfterAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
      }
    });
    context.chatIds.push(chat.id);

    const firstSession = await studySessionService.scheduleFirst(owner.id, match.id, {
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      format: "ONLINE",
      notes: `${context.prefix} first session`
    });
    context.sessionIds.push(firstSession.id);

    const confirmed = await studySessionService.updateSession(
      partner.id,
      firstSession.id,
      "CONFIRM"
    );
    const completed = await studySessionService.updateSession(
      owner.id,
      firstSession.id,
      "MARK_COMPLETED"
    );
    const nextSession = await studySessionService.scheduleNext(
      owner.id,
      firstSession.id,
      {
        scheduledAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        format: "ONLINE",
        notes: `${context.prefix} repeat session`
      }
    );
    context.sessionIds.push(nextSession.id);

    assert.equal(firstSession.status, "PROPOSED");
    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(completed.status, "COMPLETED");
    assert.equal(completed.nextAction, "SCHEDULE_NEXT");
    assert.equal(nextSession.sequenceNumber, 2);
    assert.equal(nextSession.status, "PROPOSED");
  } finally {
    await cleanupContext(context);
  }
});
