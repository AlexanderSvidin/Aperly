import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/client";
import {
  APP_SESSION_COOKIE_NAME,
  readAppSessionValue
} from "@/server/services/auth/session-service";

const sessionUserInclude = {
  profile: true
};

async function loadSessionUserById(userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId
    },
    include: sessionUserInclude
  });
}

export type SessionUser = Awaited<ReturnType<typeof loadSessionUserById>>;

export function extractSessionCookieValue(cookieHeader: string | null | undefined) {
  return cookieHeader?.match(/aperly_session=([^;]+)/)?.[1];
}

export const getCurrentSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const session = readAppSessionValue(
    cookieStore.get(APP_SESSION_COOKIE_NAME)?.value
  );

  if (!session) {
    return null;
  }

  return loadSessionUserById(session.userId);
});

export async function getRequestSessionUser(cookieValue: string | null | undefined) {
  const session = readAppSessionValue(cookieValue);

  if (!session) {
    return null;
  }

  return loadSessionUserById(session.userId);
}

export function serializeSessionUser(user: NonNullable<SessionUser>) {
  const telegramIdentity = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return {
    id: user.id,
    role: user.role,
    status: user.status,
    telegramId: user.telegramId.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    onboardingCompleted: user.onboardingCompleted,
    displayName: user.profile?.fullName ?? telegramIdentity,
    hasProfile: Boolean(user.profile),
    isDiscoverable: user.profile?.isDiscoverable ?? false
  };
}

export async function requirePageUser(options?: {
  allowIncompleteOnboarding?: boolean;
}) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/");
  }

  if (user.status === "BLOCKED") {
    redirect("/blocked?reason=blocked");
  }

  if (user.status === "DELETED") {
    redirect("/blocked?reason=deleted");
  }

  if (!options?.allowIncompleteOnboarding && !user.onboardingCompleted) {
    redirect("/onboarding");
  }

  return user;
}

export async function requireAdminPageUser(options?: {
  allowIncompleteOnboarding?: boolean;
}) {
  const user = await requirePageUser(options);

  if (user.role !== "ADMIN") {
    redirect("/home");
  }

  return user;
}
