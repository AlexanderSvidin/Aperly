import assert from "node:assert/strict";

import { prisma } from "@/server/db/client";
import { chatService } from "@/server/services/chat/chat-service";
import { requestService } from "@/server/services/requests/request-service";
import { studySessionService } from "@/server/services/study-sessions/study-session-service";

const prefix = `preprod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let telegramId = BigInt(Date.now()) * 1000n;
const userIds: string[] = [];
const requestIds: string[] = [];
const matchIds: string[] = [];
const chatIds: string[] = [];
const sessionIds: string[] = [];
const subjectIds: string[] = [];

function nextTelegramId() {
  telegramId += 1n;
  return telegramId;
}

async function createUser(label: string, options: { discoverable?: boolean } = {}) {
  const user = await prisma.user.create({
    data: {
      telegramId: nextTelegramId(),
      firstName: label,
      lastName: prefix,
      username: `${prefix}_${label}`.slice(0, 32),
      status: "ACTIVE",
      onboardingCompleted: true,
      profile: {
        create: {
          fullName: `${label} ${prefix}`,
          bio: `${label} проверочный профиль`,
          program: "ba-international-business-economics",
          courseYear: 2,
          preferredFormats: ["ONLINE", "HYBRID"],
          preferredRoles: ["ANALYST", "DEVELOPER", "DESIGNER"],
          isDiscoverable: options.discoverable ?? true,
          discoverableScenarios: ["CASE", "PROJECT", "STUDY"],
          telegramUsername: `${prefix}_${label}`.slice(0, 32),
          phone: null
        }
      }
    },
    include: { profile: true }
  });

  userIds.push(user.id);
  return user;
}

async function createSubject() {
  const subject = await prisma.subject.create({
    data: {
      slug: `${prefix}_micro`,
      name: `${prefix} Микроэкономика`
    }
  });

  subjectIds.push(subject.id);
  return subject;
}

function actor(user: Awaited<ReturnType<typeof createUser>>) {
  return {
    id: user.id,
    status: user.status,
    onboardingCompleted: user.onboardingCompleted
  };
}

async function trackCreatedRequest<T extends { id: string }>(promise: Promise<T>) {
  const request = await promise;
  requestIds.push(request.id);
  return request;
}

async function createProjectViaService(
  user: Awaited<ReturnType<typeof createUser>>,
  title: string
) {
  return trackCreatedRequest(
    requestService.create(actor(user), {
      scenario: "PROJECT",
      notes: `${prefix} project notes`,
      availabilitySlots: [],
      details: {
        projectTitle: title,
        shortDescription: `${prefix} project description`,
        stage: "IDEA",
        neededRoles: ["DEVELOPER", "DESIGNER"],
        expectedCommitment: "PART_TIME",
        preferredFormat: "ONLINE"
      }
    })
  );
}

try {
  const caseOwner = await createUser("caseOwner");
  const projectOwner = await createUser("projectOwner");
  const studyOwner = await createUser("studyOwner");
  const r2rPartner = await createUser("r2rPartner");
  const r2pCandidate = await createUser("r2pCandidate", { discoverable: true });
  const declinePartner = await createUser("declinePartner");
  const studyPartner = await createUser("studyPartner");
  const subject = await createSubject();

  const caseRequest = await trackCreatedRequest(
    requestService.create(actor(caseOwner), {
      scenario: "CASE",
      notes: `${prefix} case notes`,
      availabilitySlots: [
        { dayOfWeek: "MONDAY", startMinute: 1080, endMinute: 1260 }
      ],
      details: {
        eventName: `${prefix} Changellenge Cup`,
        deadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        neededRoles: ["ANALYST", "DESIGNER"],
        teamGapSize: 2,
        preferredFormat: "HYBRID"
      }
    })
  );
  const projectRequest = await createProjectViaService(
    projectOwner,
    `${prefix} Startup`
  );
  const r2rPartnerRequest = await createProjectViaService(
    r2rPartner,
    `${prefix} Partner project`
  );
  const declinePartnerRequest = await createProjectViaService(
    declinePartner,
    `${prefix} Decline project`
  );
  const studyRequest = await trackCreatedRequest(
    requestService.create(actor(studyOwner), {
      scenario: "STUDY",
      notes: `${prefix} study notes`,
      availabilitySlots: [],
      details: {
        subjectId: subject.id,
        currentContext: `${prefix} готовлюсь к семинару`,
        goal: `${prefix} разобрать задачи`,
        desiredFrequency: "WEEKLY",
        preferredTime: "EVENING",
        preferredFormat: "ONLINE"
      }
    })
  );
  const studyPartnerRequest = await trackCreatedRequest(
    requestService.create(actor(studyPartner), {
      scenario: "STUDY",
      notes: `${prefix} partner study notes`,
      availabilitySlots: [],
      details: {
        subjectId: subject.id,
        currentContext: `${prefix} тоже готовлюсь`,
        goal: `${prefix} заниматься вместе`,
        desiredFrequency: "WEEKLY",
        preferredTime: "EVENING",
        preferredFormat: "ONLINE"
      }
    })
  );

  assert.equal(caseRequest.details.type, "CASE");
  assert.equal(projectRequest.details.type, "PROJECT");
  assert.equal(studyRequest.details.type, "STUDY");

  const r2rMatch = await prisma.match.create({
    data: {
      pairKey: `${prefix}:r2r`,
      scenario: "PROJECT",
      mode: "REQUEST_TO_REQUEST",
      status: "READY",
      sourceRequestId: projectRequest.id,
      candidateRequestId: r2rPartnerRequest.id,
      score: 90,
      reasonSummary: "Совпали цель, формат и роли",
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000)
    }
  });
  matchIds.push(r2rMatch.id);
  const opened = await chatService.openFromMatch(projectOwner.id, r2rMatch.id);
  assert.equal(opened.status, "CHAT_READY");
  chatIds.push(opened.chatId);
  await chatService.sendMessage(projectOwner.id, opened.chatId, "Привет");
  await chatService.sendMessage(r2rPartner.id, opened.chatId, "Да, давай");
  await prisma.chat.update({
    where: { id: opened.chatId },
    data: { staleAfterAt: new Date(Date.now() - 1000), status: "ACTIVE" }
  });
  const reminder = await chatService.sendReminder(projectOwner.id, opened.chatId);
  assert.equal(reminder.message.type, "REMINDER");
  await chatService.requestContactExchange(projectOwner.id, opened.chatId);
  const accepted = await chatService.respondToContactExchange(
    r2rPartner.id,
    opened.chatId,
    "ACCEPT"
  );
  assert.equal(accepted.status, "MUTUAL_CONSENT_REACHED");
  assert.ok(accepted.revealedContacts?.telegramUsername);

  const declineMatch = await prisma.match.create({
    data: {
      pairKey: `${prefix}:decline`,
      scenario: "PROJECT",
      mode: "REQUEST_TO_REQUEST",
      status: "READY",
      sourceRequestId: projectRequest.id,
      candidateRequestId: declinePartnerRequest.id,
      score: 81,
      reasonSummary: "Контрольный отказ контактов",
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000)
    }
  });
  matchIds.push(declineMatch.id);
  const declineChat = await prisma.chat.create({
    data: {
      matchId: declineMatch.id,
      userAId: projectOwner.id,
      userBId: declinePartner.id,
      status: "ACTIVE",
      lastMessageAt: new Date(),
      staleAfterAt: new Date(Date.now() + 86_400_000)
    }
  });
  chatIds.push(declineChat.id);
  await chatService.requestContactExchange(projectOwner.id, declineChat.id);
  const declined = await chatService.respondToContactExchange(
    declinePartner.id,
    declineChat.id,
    "DECLINE"
  );
  assert.equal(declined.status, "DECLINED");
  assert.equal(declined.revealedContacts, null);

  const r2pMatch = await prisma.match.create({
    data: {
      pairKey: `${prefix}:r2p`,
      scenario: "CASE",
      mode: "REQUEST_TO_PROFILE",
      status: "PENDING_RECIPIENT_ACCEPTANCE",
      sourceRequestId: caseRequest.id,
      candidateProfileId: r2pCandidate.profile!.id,
      score: 68,
      reasonSummary: "Открытый профиль подходит под запрос",
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000)
    }
  });
  matchIds.push(r2pMatch.id);
  const invite = await chatService.openFromMatch(caseOwner.id, r2pMatch.id);
  assert.equal(invite.status, "INVITE_SENT");
  const inviteAccepted = await chatService.respondToFallbackInvite(
    r2pCandidate.id,
    r2pMatch.id,
    "ACCEPT"
  );
  assert.equal(inviteAccepted.status, "ACCEPTED");
  chatIds.push(inviteAccepted.chatId);

  const studyMatch = await prisma.match.create({
    data: {
      pairKey: `${prefix}:study`,
      scenario: "STUDY",
      mode: "REQUEST_TO_REQUEST",
      status: "READY",
      sourceRequestId: studyRequest.id,
      candidateRequestId: studyPartnerRequest.id,
      score: 93,
      reasonSummary: "Одинаковый предмет и ритм",
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000)
    }
  });
  matchIds.push(studyMatch.id);
  const studyChat = await prisma.chat.create({
    data: {
      matchId: studyMatch.id,
      userAId: studyOwner.id,
      userBId: studyPartner.id,
      status: "ACTIVE",
      lastMessageAt: new Date(),
      staleAfterAt: new Date(Date.now() + 86_400_000)
    }
  });
  chatIds.push(studyChat.id);
  const firstSession = await studySessionService.scheduleFirst(studyOwner.id, studyMatch.id, {
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    format: "ONLINE",
    notes: "Первая встреча"
  });
  sessionIds.push(firstSession.id);
  const confirmed = await studySessionService.updateSession(
    studyPartner.id,
    firstSession.id,
    "CONFIRM"
  );
  assert.equal(confirmed.status, "CONFIRMED");
  const rescheduled = await studySessionService.updateSession(
    studyOwner.id,
    firstSession.id,
    "RESCHEDULE",
    {
      scheduledAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      notes: "Перенесли"
    }
  );
  assert.equal(rescheduled.status, "PROPOSED");
  await studySessionService.updateSession(studyPartner.id, firstSession.id, "CONFIRM");
  const completed = await studySessionService.updateSession(
    studyOwner.id,
    firstSession.id,
    "MARK_COMPLETED"
  );
  assert.equal(completed.nextAction, "SCHEDULE_NEXT");
  const next = await studySessionService.scheduleNext(studyOwner.id, firstSession.id, {
    scheduledAt: new Date(Date.now() + 9 * 86_400_000).toISOString(),
    format: "ONLINE",
    notes: "Следующая встреча"
  });
  sessionIds.push(next.id);
  assert.equal(next.sequenceNumber, 2);
  await studySessionService.findNewPartner(studyOwner.id, studyRequest.id);
  await studySessionService.stopSearching(studyOwner.id, studyRequest.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          "CASE request",
          "PROJECT request",
          "STUDY request",
          "R2R chat",
          "R2P invite",
          "messages",
          "stale/remind",
          "contact accept",
          "contact decline",
          "StudyBuddy lifecycle"
        ]
      },
      null,
      2
    )
  );
} finally {
  await prisma.message.deleteMany({ where: { chatId: { in: chatIds } } });
  await prisma.session.deleteMany({
    where: { OR: [{ id: { in: sessionIds } }, { chatId: { in: chatIds } }] }
  });
  await prisma.chat.deleteMany({
    where: { OR: [{ id: { in: chatIds } }, { matchId: { in: matchIds } }] }
  });
  await prisma.match.deleteMany({
    where: {
      OR: [
        { id: { in: matchIds } },
        { pairKey: { startsWith: prefix } },
        { sourceRequestId: { in: requestIds } },
        { candidateRequestId: { in: requestIds } },
        { candidateProfile: { is: { userId: { in: userIds } } } }
      ]
    }
  });
  await prisma.request.deleteMany({ where: { id: { in: requestIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
  await prisma.$disconnect();
}
