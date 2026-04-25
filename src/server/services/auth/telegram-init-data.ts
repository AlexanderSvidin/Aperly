import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

type ValidatedTelegramInitData = {
  authDate: Date;
  queryId: string | null;
  raw: string;
  user: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
  };
};

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional()
});

function buildDataCheckString(params: URLSearchParams) {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function createExpectedHash(dataCheckString: string, botToken: string) {
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();

  return createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

function compareHashes(expectedHash: string, receivedHash: string) {
  const expected = Buffer.from(expectedHash, "utf8");
  const received = Buffer.from(receivedHash, "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export function validateTelegramInitData(params: {
  botToken: string;
  initData: string;
  maxAgeSeconds: number;
}): ValidatedTelegramInitData {
  const query = new URLSearchParams(params.initData);
  const receivedHash = query.get("hash");

  if (!receivedHash) {
    throw new Error("Telegram initData missing hash.");
  }

  const authDateRaw = query.get("auth_date");
  const authDateNumber = Number(authDateRaw);

  if (!Number.isInteger(authDateNumber) || authDateNumber <= 0) {
    throw new Error("Telegram initData contains invalid auth_date.");
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (nowInSeconds - authDateNumber > params.maxAgeSeconds) {
    throw new Error("Telegram initData is stale.");
  }

  const userRaw = query.get("user");

  if (!userRaw) {
    throw new Error("Telegram initData missing user payload.");
  }

  const parsedUser = telegramUserSchema.parse(JSON.parse(userRaw));
  const dataCheckString = buildDataCheckString(query);
  const expectedHash = createExpectedHash(dataCheckString, params.botToken);

  if (!compareHashes(expectedHash, receivedHash)) {
    throw new Error("Telegram initData signature mismatch.");
  }

  return {
    authDate: new Date(authDateNumber * 1000),
    queryId: query.get("query_id"),
    raw: params.initData,
    user: {
      id: parsedUser.id,
      firstName: parsedUser.first_name,
      lastName: parsedUser.last_name,
      username: parsedUser.username,
      languageCode: parsedUser.language_code
    }
  };
}
