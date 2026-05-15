import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";

import { legacyChatDisabledPayload } from "@/app/api/_legacy-disabled";
import { POST as legacyOpenChatPost } from "@/app/api/matches/[id]/open-chat/route";
import { prisma } from "@/server/db/client";
import { validateTelegramInitData } from "@/server/services/auth/telegram-init-data";
import { chatService } from "@/server/services/chat/chat-service";
import { connectionService } from "@/server/services/connections/connection-service";
import { getMatchUiStatus } from "@/features/matching/lib/match-options";
import {
  buildHomeLatestMatches,
  buildHomeRequestItem
} from "@/server/services/home/home-presenters";
import { homeService } from "@/server/services/home/home-service";
import {
  buildPublicMatchReasons,
  matchingService
} from "@/server/services/matching/matching-service";
import { moderationService } from "@/server/services/moderation/moderation-service";
import { profileService } from "@/server/services/profile/profile-service";
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

  await prisma.connection.deleteMany({
    where: {
      OR: [{ userAId: { in: context.userIds } }, { userBId: { in: context.userIds } }]
    }
  });

  await prisma.interaction.deleteMany({
    where: {
      OR: [
        { senderUserId: { in: context.userIds } },
        { recipientUserId: { in: context.userIds } },
        { sourceRequestId: { in: context.requestIds } },
        { targetRequestId: { in: context.requestIds } }
      ]
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

async function createActivityRequest(context: TestContext, ownerId: string) {
  const request = await prisma.request.create({
    data: {
      ownerId,
      scenario: "ACTIVITY",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      activityDetails: {
        create: {
          title: `${context.prefix} Activity`,
          activitySubtype: "MEETING",
          preferredFormat: "ONLINE",
          peopleCount: 4,
          recurrence: "WEEKLY",
          comment: `${context.prefix} activity comment`
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

function buildEmptyMatchResponse() {
  return {
    status: "NONE" as const,
    introMessage: null,
    sentByMe: false,
    canSendIntro: true,
    canAccept: false,
    canDecline: false,
    telegramUsername: null,
    telegramUrl: null,
    contactHint: "Контакт откроется после принятия отклика."
  };
}

function buildEmptyInvitationState() {
  return {
    status: "NONE" as const,
    label: "Пригласить",
    canAct: true,
    interactionId: null,
    connectionId: null
  };
}

after(async () => {
  await prisma.$disconnect();
});

test("match UI status mapping hides technical backend statuses", () => {
  assert.deepEqual(
    getMatchUiStatus({
      mode: "REQUEST_TO_REQUEST",
      status: "READY",
      chatReadiness: "READY_FOR_CHAT",
      response: {
        status: "NONE",
        introMessage: null,
        sentByMe: false,
        canSendIntro: true,
        canAccept: false,
        canDecline: false,
        telegramUsername: null,
        telegramUrl: null,
        contactHint: "Контакт откроется после принятия отклика."
      }
    }),
    {
      label: "Можно откликнуться",
      tone: "success",
      nextAction: "Откликнуться",
      canAct: true
    }
  );

  assert.deepEqual(
    getMatchUiStatus({
      mode: "REQUEST_TO_PROFILE",
      status: "PENDING_RECIPIENT_ACCEPTANCE",
      chatReadiness: "INVITE_REQUIRED",
      response: {
        status: "SENT",
        introMessage: "Хочу присоединиться к запросу.",
        sentByMe: true,
        canSendIntro: false,
        canAccept: false,
        canDecline: false,
        telegramUsername: null,
        telegramUrl: null,
        contactHint: "Контакт скрыт до принятия отклика."
      }
    }),
    {
      label: "Отклик отправлен",
      tone: "warning",
      nextAction: "Ждём ответа",
      canAct: false
    }
  );

  assert.equal(
    getMatchUiStatus({
      mode: "REQUEST_TO_PROFILE",
      status: "EXPIRED",
      chatReadiness: "INVITE_REQUIRED",
      response: {
        status: "NONE",
        introMessage: null,
        sentByMe: false,
        canSendIntro: false,
        canAccept: false,
        canDecline: false,
        telegramUsername: null,
        telegramUrl: null,
        contactHint: "Контакт откроется после принятия отклика."
      }
    }).label,
    "Истекло"
  );
});

test("buildPublicMatchReasons returns deterministic human reasons", () => {
  assert.deepEqual(
    buildPublicMatchReasons([
      { key: "format_fit", label: "Предпочитаемый формат", score: 10 },
      { key: "subject_fit", label: "Предмет", score: 35 },
      { key: "skill_fit", label: "Навыки", score: 18 },
      { key: "profile_completeness", label: "Профиль", score: 0 },
      { key: "availability_overlap", label: "Время", score: 12 }
    ]),
    [
      "Совпадает предмет",
      "Есть нужный навык",
      "Похоже удобное время",
      "Подходит формат"
    ]
  );
});

test("legacy fallback chat invite flow is disabled", async () => {
  const context = buildContext("legacy_invite_disabled");

  try {
    const owner = await createUser(context, { firstName: "InviteOwner" });
    const recipient = await createUser(context, { firstName: "InviteRecipient" });
    const subject = await createSubject(context);
    const sourceRequest = await createStudyRequest(context, owner.id, subject.id);

    const match = await prisma.match.create({
      data: {
        pairKey: `${context.prefix}_fallback_pair`,
        scenario: "STUDY",
        mode: "REQUEST_TO_PROFILE",
        status: "PENDING_RECIPIENT_ACCEPTANCE",
        sourceRequestId: sourceRequest.id,
        candidateProfileId: recipient.profile!.id,
        score: 72,
        reasonSummary: `${context.prefix} fallback reason`,
        reasonDetails: {
          dimensions: [
            { key: "subject_fit", label: "Предмет", score: 35 },
            { key: "format_fit", label: "Формат", score: 10 }
          ]
        },
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      }
    });
    context.matchIds.push(match.id);

    await assert.rejects(
      () => chatService.openFromMatch(owner.id, match.id, "Legacy intro message"),
      { code: "legacy_chat_disabled", status: 410 }
    );
    const disabledStoredMatch = await prisma.match.findUniqueOrThrow({
      where: { id: match.id },
      include: { chat: true }
    });

    assert.equal(disabledStoredMatch.status, "PENDING_RECIPIENT_ACCEPTANCE");
    assert.equal(disabledStoredMatch.chat, null);
    return;

    const firstResult = await chatService.openFromMatch(
      owner.id,
      match.id,
      "Хочу обсудить совместную подготовку и удобное время."
    );
    const secondResult = await chatService.openFromMatch(
      owner.id,
      match.id,
      "Хочу обсудить совместную подготовку и удобное время."
    );
    const storedMatch = await prisma.match.findUniqueOrThrow({
      where: { id: match.id },
      include: { chat: true }
    });

    assert.deepEqual(firstResult, { status: "RESPONSE_SENT", matchId: match.id });
    assert.deepEqual(secondResult, { status: "RESPONSE_SENT", matchId: match.id });
    assert.equal(storedMatch.status, "PENDING_RECIPIENT_ACCEPTANCE");
    assert.equal(storedMatch.chat, null);
  } finally {
    await cleanupContext(context);
  }
});

test("legacy match response flow is disabled and does not create chat consent", async () => {
  const context = buildContext("legacy_intro_disabled");

  try {
    const sender = await createUser(context, { firstName: "IntroSender" });
    const recipient = await createUser(context, { firstName: "IntroRecipient" });
    const subject = await createSubject(context);
    const senderRequest = await createStudyRequest(context, sender.id, subject.id);
    const recipientRequest = await createStudyRequest(context, recipient.id, subject.id);

    const match = await prisma.match.create({
      data: {
        pairKey: `${context.prefix}_request_pair`,
        scenario: "STUDY",
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: senderRequest.id,
        candidateRequestId: recipientRequest.id,
        score: 82,
        reasonSummary: `${context.prefix} request reason`,
        reasonDetails: {
          dimensions: [
            { key: "subject_fit", label: "Предмет", score: 35 },
            { key: "availability_overlap", label: "Время", score: 20 }
          ]
        },
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      }
    });
    context.matchIds.push(match.id);

    const intro = "Я уже разбирал этот предмет и предлагаю созвониться на неделе.";
    await assert.rejects(
      () => chatService.openFromMatch(sender.id, match.id, intro),
      { code: "legacy_chat_disabled", status: 410 }
    );
    const storedMatch = await prisma.match.findUniqueOrThrow({
      where: { id: match.id },
      select: { reasonDetails: true }
    });
    const disabledChatCount = await prisma.chat.count({
      where: { matchId: match.id }
    });

    assert.equal(
      Boolean((storedMatch.reasonDetails as { response?: unknown } | null)?.response),
      false
    );
    assert.equal(disabledChatCount, 0);
    return;

    const sent = await chatService.openFromMatch(sender.id, match.id, intro);
    const recipientMatches = await matchingService.listForOwnedRequest(
      recipient.id,
      recipientRequest.id
    );
    const receivedMatch = recipientMatches.matches.find((item) => item.id === match.id);

    assert.deepEqual(sent, { status: "RESPONSE_SENT", matchId: match.id });
    assert.equal(receivedMatch?.response.status, "RECEIVED");
    assert.equal(receivedMatch?.response.introMessage, intro);
    assert.equal(receivedMatch?.response.canAccept, true);

    const accepted: any = await chatService.respondToFallbackInvite(
      recipient.id,
      match.id,
      "ACCEPT"
    );
    assert.equal(accepted.status, "ACCEPTED");
    if (accepted.status === "ACCEPTED") {
      context.chatIds.push(accepted.chatId);
      assert.equal(
        accepted.telegramUsername,
        sender.username?.replace(/^@+/, "") ?? null
      );
      assert.ok(accepted.telegramUrl?.startsWith("https://t.me/"));
    }

    const chatCount = await prisma.chat.count({
      where: { matchId: match.id }
    });
    assert.equal(chatCount, 1);
  } finally {
    await cleanupContext(context);
  }
});

test("archived requests are hidden from Home feed", async () => {
  const context = buildContext("archive_home");

  try {
    const owner = await createUser(context, { firstName: "ArchiveOwner" });
    const viewer = await createUser(context, { firstName: "ArchiveViewer" });
    const subject = await createSubject(context);
    const request = await createStudyRequest(context, owner.id, subject.id);

    await requestService.archive(
      {
        id: owner.id,
        status: owner.status,
        onboardingCompleted: owner.onboardingCompleted
      },
      request.id
    );

    const feed = await homeService.getFeedForUser(viewer.id);

    assert.equal(
      feed.opportunities.some((opportunity) => opportunity.id === request.id),
      false
    );
  } finally {
    await cleanupContext(context);
  }
});

test("deleted profile is hidden from discovery and matching fallback", async () => {
  const context = buildContext("delete_profile");

  try {
    const deletedUser = await createUser(context, { firstName: "DeletedCandidate" });
    const viewer = await createUser(context, { firstName: "DeleteViewer" });
    const subject = await createSubject(context);
    await createStudyRequest(context, deletedUser.id, subject.id);

    await profileService.deleteProfile(deletedUser.id);

    const feed = await homeService.getFeedForUser(viewer.id);

    assert.equal(
      feed.opportunities.some((opportunity) =>
        opportunity.author.name.includes("DeletedCandidate")
      ),
      false
    );
  } finally {
    await cleanupContext(context);
  }
});

test("request notes use private label copy", () => {
  const componentSource = readFileSync(
    new URL("../src/features/requests/components/request-composer-shell.tsx", import.meta.url),
    "utf8"
  );

  assert.match(componentSource, /Личная заметка/);
  assert.match(componentSource, /Видна только вам/);
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
          reasons: [],
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
          response: buildEmptyMatchResponse(),
          invitationState: buildEmptyInvitationState(),
          computedAt: "2026-04-20T10:00:00.000Z",
          expiresAt: null
        },
        {
          id: "match-newer-low",
          mode: "REQUEST_TO_REQUEST",
          status: "READY",
          score: 70,
          reasonSummary: "newer low score",
          reasons: [],
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
          response: buildEmptyMatchResponse(),
          invitationState: buildEmptyInvitationState(),
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

test("homeService feed excludes current user and inactive requests", async () => {
  const context = buildContext("home_feed");

  try {
    const viewer = await createUser(context, { firstName: "Viewer" });
    const partner = await createUser(context, { firstName: "Partner" });
    const inactiveOwner = await createUser(context, { firstName: "InactiveOwner" });
    const subject = await createSubject(context);
    const ownRequest = await createStudyRequest(context, viewer.id, subject.id);
    const partnerRequest = await createStudyRequest(context, partner.id, subject.id);
    const inactiveRequest = await createStudyRequest(
      context,
      inactiveOwner.id,
      subject.id
    );

    await prisma.request.update({
      where: { id: inactiveRequest.id },
      data: { status: "CLOSED", closedAt: new Date() }
    });

    const feed = await homeService.getFeedForUser(viewer.id);
    const studyFeed = await homeService.getFeedForUser(viewer.id, {
      scenario: "STUDY"
    });

    assert.ok(feed.opportunities.some((item) => item.id === partnerRequest.id));
    assert.ok(!feed.opportunities.some((item) => item.id === ownRequest.id));
    assert.ok(!feed.opportunities.some((item) => item.id === inactiveRequest.id));
    assert.equal(
      studyFeed.opportunities.filter((item) => item.id === partnerRequest.id).length,
      1
    );
    assert.equal(studyFeed.opportunities[0]?.scenario, "STUDY");
    assert.equal(studyFeed.opportunities[0]?.responseState.status, "NONE");
    assert.equal(studyFeed.opportunities[0]?.responseState.canAct, true);
    assert.equal(feed.primaryCta.href, "/create");
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
    const screenData = await matchingService.getScreenDataForUser(owner.id, {
      requestId: created.id
    });

    assert.equal(created.details.type, "STUDY");
    assert.equal(screenData.selectedRequestId, created.id);
    assert.ok(
      screenData.selectedRequestMatches?.matches.some((match) =>
        matches.some((storedMatch) => storedMatch.id === match.id)
      )
    );
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

test("requestService creates StudyBuddy request with a custom subject without duplicates", async () => {
  const context = buildContext("request_custom_subject");
  const customSubjectName = `${context.prefix} Applied Metrics`;

  try {
    const owner = await createUser(context, { firstName: "CustomOwner" });
    const secondOwner = await createUser(context, { firstName: "CustomOwnerTwo" });

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
          subjectId: null,
          customSubjectName: `  ${customSubjectName}  `,
          currentContext: `${context.prefix} preparing for custom subject exam`,
          goal: `${context.prefix} build a repeatable study plan`,
          desiredFrequency: "WEEKLY",
          preferredTime: "EVENING",
          preferredFormat: "ONLINE"
        }
      }
    );
    context.requestIds.push(created.id);

    const reused = await requestService.create(
      {
        id: secondOwner.id,
        status: "ACTIVE",
        onboardingCompleted: true
      },
      {
        scenario: "STUDY",
        notes: "",
        availabilitySlots: [],
        details: {
          subjectId: null,
          customSubjectName: customSubjectName.toLowerCase(),
          currentContext: `${context.prefix} another custom subject context`,
          goal: `${context.prefix} compare solutions every week`,
          desiredFrequency: "WEEKLY",
          preferredTime: "EVENING",
          preferredFormat: "ONLINE"
        }
      }
    );
    context.requestIds.push(reused.id);

    assert.equal(created.details.type, "STUDY");
    assert.equal(reused.details.type, "STUDY");

    if (created.details.type === "STUDY" && reused.details.type === "STUDY") {
      assert.equal(created.details.subjectName, customSubjectName);
      assert.equal(reused.details.subjectId, created.details.subjectId);
      context.subjectIds.push(created.details.subjectId);
    }
  } finally {
    await cleanupContext(context);
  }
});

test("requestService updates active request details and keeps existing chatted matches", async () => {
  const context = buildContext("request_update");

  try {
    const owner = await createUser(context, { firstName: "UpdateOwner" });
    const partner = await createUser(context, { firstName: "UpdatePartner" });
    const ownerRequest = await createProjectRequest(context, owner.id);
    const partnerRequest = await createProjectRequest(context, partner.id);

    const match = await prisma.match.create({
      data: {
        pairKey: `${context.prefix}_update_pair`,
        scenario: "PROJECT",
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: ownerRequest.id,
        candidateRequestId: partnerRequest.id,
        score: 91,
        reasonSummary: `${context.prefix} existing chatted match`,
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

    const updated = await requestService.update(
      {
        id: owner.id,
        status: "ACTIVE",
        onboardingCompleted: true
      },
      ownerRequest.id,
      {
        scenario: "PROJECT",
        notes: "Updated notes",
        availabilitySlots: [],
        details: {
          projectTitle: `${context.prefix} Updated Project`,
          shortDescription: `${context.prefix} updated project description for request lifecycle`,
          stage: "EARLY_TRACTION",
          neededRoles: ["DESIGNER"],
          expectedCommitment: "FLEXIBLE",
          preferredFormat: "HYBRID"
        }
      }
    );

    const existingMatch = await prisma.match.findUnique({
      where: { id: match.id },
      include: { chat: true }
    });

    assert.equal(updated.details.type, "PROJECT");
    if (updated.details.type === "PROJECT") {
      assert.equal(updated.details.projectTitle, `${context.prefix} Updated Project`);
      assert.equal(updated.details.stage, "EARLY_TRACTION");
    }
    assert.equal(existingMatch?.chat?.id, chat.id);
  } finally {
    await cleanupContext(context);
  }
});

test("requestService pauses, resumes, closes and archives requests", async () => {
  const context = buildContext("request_lifecycle");

  try {
    const owner = await createUser(context, { firstName: "LifecycleOwner" });
    const request = await createProjectRequest(context, owner.id);
    const actor = {
      id: owner.id,
      status: "ACTIVE" as const,
      onboardingCompleted: true
    };

    const paused = await requestService.pause(actor, request.id);
    assert.equal(paused.status, "PAUSED");

    const resumed = await requestService.renew(actor, request.id);
    assert.equal(resumed.status, "ACTIVE");

    const closed = await requestService.close(actor, request.id);
    assert.equal(closed.status, "CLOSED");
    assert.ok(closed.closedAt);

    const archived = await requestService.archive(actor, request.id);
    assert.equal(archived.status, "ARCHIVED");

    const visibleRequests = await requestService.listForUser(owner.id);
    assert.equal(
      visibleRequests.some((visibleRequest) => visibleRequest.id === request.id),
      true
    );
  } finally {
    await cleanupContext(context);
  }
});

test("requestService returns validation errors for invalid StudyBuddy subjects", async () => {
  const context = buildContext("request_validation");

  try {
    const owner = await createUser(context, { firstName: "ValidationOwner" });

    await assert.rejects(
      () =>
        requestService.create(
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
              subjectId: null,
              customSubjectName: null,
              currentContext: `${context.prefix} preparing for seminar`,
              goal: `${context.prefix} solve weekly tasks`,
              desiredFrequency: "WEEKLY",
              preferredTime: "EVENING",
              preferredFormat: "ONLINE"
            }
          }
        ),
      /Выберите предмет|subjectId/
    );
  } finally {
    await cleanupContext(context);
  }
});

test("response lifecycle prevents duplicates and reveals Telegram only on active connection", async () => {
  const context = buildContext("response_lifecycle");

  try {
    const owner = await createUser(context, { firstName: "ResponseOwner", username: "owner_contact" });
    const responder = await createUser(context, { firstName: "ResponseSender", username: "sender_contact" });
    const subject = await createSubject(context);
    const request = await createStudyRequest(context, owner.id, subject.id);

    const first = await connectionService.createResponseForRequest(
      responder.id,
      request.id,
      "Хочу откликнуться и обсудить совместную учёбу."
    );
    const duplicate = await connectionService.createResponseForRequest(
      responder.id,
      request.id,
      "Повторный отклик не должен создать дубль."
    );
    const interactionCount = await prisma.interaction.count({
      where: { type: "RESPONSE", senderUserId: responder.id, targetRequestId: request.id }
    });

    assert.equal(first.status, "PENDING");
    assert.equal(duplicate.id, first.id);
    assert.equal(interactionCount, 1);

    const accepted = await connectionService.respondToInteraction(owner.id, first.id, "ACCEPT");
    assert.ok(accepted.connection?.id);

    if (accepted.connection?.id) {
      const list = await connectionService.listForUser(owner.id);
      const summary = list.active.find((connection) => connection.id === accepted.connection?.id);
      const detail = await connectionService.getConnectionForUser(owner.id, accepted.connection.id);

      assert.equal(summary?.telegramUsername, null);
      assert.equal(detail.status, "ACTIVE");
      assert.equal(detail.telegramUsername, "sender_contact");

      await prisma.request.update({
        where: { id: request.id },
        data: { status: "CLOSED", closedAt: new Date() }
      });
      const stillActive = await connectionService.getConnectionForUser(owner.id, accepted.connection.id);
      assert.equal(stillActive.status, "ACTIVE");
    }
  } finally {
    await cleanupContext(context);
  }
});

test("declined response and invitation do not create connections", async () => {
  const context = buildContext("decline_lifecycle");

  try {
    const owner = await createUser(context, { firstName: "DeclineOwner" });
    const candidate = await createUser(context, { firstName: "DeclineCandidate" });
    const subject = await createSubject(context);
    const ownerRequest = await createStudyRequest(context, owner.id, subject.id);
    const candidateRequest = await createStudyRequest(context, candidate.id, subject.id);

    const response = await connectionService.createResponseForRequest(
      candidate.id,
      ownerRequest.id,
      "Могу помочь с этим учебным запросом."
    );
    await connectionService.respondToInteraction(owner.id, response.id, "DECLINE");

    const match = await prisma.match.create({
      data: {
        pairKey: `${context.prefix}_invite_pair`,
        scenario: "STUDY",
        mode: "REQUEST_TO_REQUEST",
        status: "READY",
        sourceRequestId: ownerRequest.id,
        candidateRequestId: candidateRequest.id,
        score: 80,
        reasonSummary: `${context.prefix} invite reason`,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      }
    });
    context.matchIds.push(match.id);

    const invitation = await connectionService.createInvitationFromMatch(
      owner.id,
      match.id,
      "Приглашаю вас в мой учебный запрос."
    );
    const duplicate = await connectionService.createInvitationFromMatch(
      owner.id,
      match.id,
      "Повторное приглашение не должно создать дубль."
    );
    await connectionService.respondToInteraction(candidate.id, invitation.id, "DECLINE");

    const connectionCount = await prisma.connection.count({
      where: {
        OR: [
          { interactionId: response.id },
          { interactionId: invitation.id }
        ]
      }
    });

    assert.equal(duplicate.id, invitation.id);
    assert.equal(connectionCount, 0);
  } finally {
    await cleanupContext(context);
  }
});

test("closed request is hidden from opportunities and rejects new interactions", async () => {
  const context = buildContext("closed_interactions");

  try {
    const owner = await createUser(context, { firstName: "ClosedOwner" });
    const viewer = await createUser(context, { firstName: "ClosedViewer" });
    const subject = await createSubject(context);
    const request = await createStudyRequest(context, owner.id, subject.id);

    await prisma.request.update({
      where: { id: request.id },
      data: { status: "CLOSED", closedAt: new Date() }
    });

    const feed = await homeService.getFeedForUser(viewer.id);

    assert.ok(!feed.opportunities.some((item) => item.id === request.id));
    await assert.rejects(
      () =>
        connectionService.createResponseForRequest(
          viewer.id,
          request.id,
          "Хочу откликнуться на закрытый запрос."
        ),
      { code: "target_request_inactive", status: 409 }
    );
  } finally {
    await cleanupContext(context);
  }
});

test("activity request can be created and appears in opportunities", async () => {
  const context = buildContext("activity_request");

  try {
    const owner = await createUser(context, { firstName: "ActivityOwner" });
    const viewer = await createUser(context, { firstName: "ActivityViewer" });

    await prisma.profile.updateMany({
      where: { userId: { in: [owner.id, viewer.id] } },
      data: { discoverableScenarios: ["STUDY", "PROJECT", "ACTIVITY"] }
    });

    const activity = await createActivityRequest(context, owner.id);
    await matchingService.recomputeForRequest(activity.id);
    const feed = await homeService.getFeedForUser(viewer.id, { scenario: "ACTIVITY" });

    assert.ok(feed.opportunities.some((item) => item.id === activity.id));
    assert.equal(feed.selectedScenario, "ACTIVITY");
  } finally {
    await cleanupContext(context);
  }
});

test("legacy contact exchange flow is disabled and keeps contacts hidden", async () => {
  const context = buildContext("contact_disabled");

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

    await assert.rejects(
      () => chatService.requestContactExchange(owner.id, chat.id),
      { code: "legacy_chat_disabled", status: 410 }
    );
    const disabledStoredChat = await prisma.chat.findUniqueOrThrow({
      where: { id: chat.id },
      select: {
        contactExchangeStatus: true,
        contactSharedAt: true
      }
    });
    const disabledMessageCount = await prisma.message.count({
      where: { chatId: chat.id }
    });

    assert.equal(disabledStoredChat.contactExchangeStatus, "NOT_REQUESTED");
    assert.equal(disabledStoredChat.contactSharedAt, null);
    assert.equal(disabledMessageCount, 0);
    return;

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

test("legacy chat endpoint returns 410 without contact data", async () => {
  const response = await legacyOpenChatPost();
  const payload = await response.json();

  assert.equal(response.status, 410);
  assert.deepEqual(payload, legacyChatDisabledPayload);
  assert.equal(JSON.stringify(payload).includes("telegram"), false);
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
