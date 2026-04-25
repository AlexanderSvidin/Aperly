import { createHmac, timingSafeEqual } from "node:crypto";

import { telegramServerEnv } from "@/lib/env/server";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

const appSessionPayloadSchema = {
  version: 1 as const
};

type AppSessionPayload = {
  version: typeof appSessionPayloadSchema.version;
  userId: string;
  telegramId: string;
  role: "USER" | "ADMIN";
  issuedAt: number;
  expiresAt: number;
};

export const APP_SESSION_COOKIE_NAME = "aperly_session";

function encodePayload(payload: AppSessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encodedPayload: string): AppSessionPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<AppSessionPayload>;

    if (
      parsed.version !== appSessionPayloadSchema.version ||
      typeof parsed.userId !== "string" ||
      typeof parsed.telegramId !== "string" ||
      (parsed.role !== "USER" && parsed.role !== "ADMIN") ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    return {
      version: parsed.version,
      userId: parsed.userId,
      telegramId: parsed.telegramId,
      role: parsed.role,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt
    };
  } catch {
    return null;
  }
}

function signValue(encodedPayload: string) {
  return createHmac("sha256", telegramServerEnv.APP_SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function hasValidSignature(encodedPayload: string, signature: string) {
  const expectedSignature = Buffer.from(signValue(encodedPayload));
  const receivedSignature = Buffer.from(signature);

  if (expectedSignature.length !== receivedSignature.length) {
    return false;
  }

  return timingSafeEqual(expectedSignature, receivedSignature);
}

export function createAppSessionValue(payload: {
  userId: string;
  telegramId: string;
  role: "USER" | "ADMIN";
}) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const encodedPayload = encodePayload({
    version: appSessionPayloadSchema.version,
    userId: payload.userId,
    telegramId: payload.telegramId,
    role: payload.role,
    issuedAt: nowInSeconds,
    expiresAt: nowInSeconds + SESSION_TTL_SECONDS
  });

  return `${encodedPayload}.${signValue(encodedPayload)}`;
}

export function readAppSessionValue(
  cookieValue: string | null | undefined
): AppSessionPayload | null {
  if (!cookieValue) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split(".");

  if (!encodedPayload || !signature || !hasValidSignature(encodedPayload, signature)) {
    return null;
  }

  const payload = decodePayload(encodedPayload);

  if (!payload) {
    return null;
  }

  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function buildAppSessionCookie(value: string) {
  return {
    name: APP_SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  };
}

export function buildClearedAppSessionCookie() {
  return {
    name: APP_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  };
}
