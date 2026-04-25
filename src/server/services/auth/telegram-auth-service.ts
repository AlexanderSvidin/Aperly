import { prisma } from "@/server/db/client";
import { telegramServerEnv } from "@/lib/env/server";
import { validateTelegramInitData } from "@/server/services/auth/telegram-init-data";

type TelegramAuthBootstrap = {
  source: "telegram" | "dev" | "missing";
  initData: string | null;
};

async function loadAuthenticatedUserByTelegramId(telegramId: bigint) {
  return prisma.user.findUnique({
    where: {
      telegramId
    },
    include: {
      profile: true
    }
  });
}

type AuthenticatedUser = Awaited<ReturnType<typeof loadAuthenticatedUserByTelegramId>>;

export class TelegramAuthError extends Error {
  code: string;
  status: number;
  redirectTo?: string;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    redirectTo?: string;
  }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
    this.redirectTo = params.redirectTo;
  }
}

async function ensureTelegramVerification(userId: string) {
  const now = new Date();

  await prisma.verification.upsert({
    where: {
      userId_type: {
        userId,
        type: "TELEGRAM"
      }
    },
    update: {
      status: "VERIFIED",
      verifiedAt: now
    },
    create: {
      userId,
      type: "TELEGRAM",
      status: "VERIFIED",
      verifiedAt: now
    }
  });
}

async function loadUserByTelegramId(telegramId: bigint) {
  return loadAuthenticatedUserByTelegramId(telegramId);
}

function blockedRedirectForStatus(status: "BLOCKED" | "DELETED") {
  return `/blocked?reason=${status === "BLOCKED" ? "blocked" : "deleted"}`;
}

async function persistIdentity(params: {
  firstName: string;
  lastName?: string;
  languageCode?: string;
  telegramId: bigint;
  username?: string;
}): Promise<NonNullable<AuthenticatedUser>> {
  const existingUser = await loadUserByTelegramId(params.telegramId);

  if (existingUser?.status === "BLOCKED" || existingUser?.status === "DELETED") {
    throw new TelegramAuthError({
      code: existingUser.status === "BLOCKED" ? "user_blocked" : "user_deleted",
      message:
        existingUser.status === "BLOCKED"
          ? "Ваш доступ к Aperly ограничен."
          : "Аккаунт удалён и не может быть восстановлен.",
      status: 403,
      redirectTo: blockedRedirectForStatus(existingUser.status)
    });
  }

  const user = existingUser
    ? await prisma.user.update({
        where: {
          id: existingUser.id
        },
        data: {
          firstName: params.firstName,
          lastName: params.lastName ?? null,
          languageCode: params.languageCode ?? null,
          username: params.username ?? null
        },
        include: {
          profile: true
        }
      })
    : await prisma.user.create({
        data: {
          telegramId: params.telegramId,
          username: params.username ?? null,
          firstName: params.firstName,
          lastName: params.lastName ?? null,
          languageCode: params.languageCode ?? null,
          onboardingCompleted: false,
          verifications: {
            create: {
              type: "TELEGRAM",
              status: "VERIFIED",
              verifiedAt: new Date()
            }
          }
        },
        include: {
          profile: true
        }
      });

  await ensureTelegramVerification(user.id);

  return user;
}

export interface TelegramAuthService {
  bootstrap(initData: string | null): Promise<TelegramAuthBootstrap>;
  authenticateWithTelegram(initData: string): Promise<NonNullable<AuthenticatedUser>>;
  authenticateWithDevFallback(): Promise<NonNullable<AuthenticatedUser>>;
}

export const telegramAuthService: TelegramAuthService = {
  async bootstrap(initData) {
    return {
      source: initData ? "telegram" : "missing",
      initData
    };
  },

  async authenticateWithTelegram(initData) {
    if (!telegramServerEnv.TELEGRAM_BOT_TOKEN) {
      throw new TelegramAuthError({
        code: "telegram_not_configured",
        message: "TELEGRAM_BOT_TOKEN не настроен.",
        status: 500
      });
    }

    const validated = validateTelegramInitData({
      botToken: telegramServerEnv.TELEGRAM_BOT_TOKEN,
      initData,
      maxAgeSeconds: telegramServerEnv.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS
    });

    return persistIdentity({
      telegramId: BigInt(validated.user.id),
      firstName: validated.user.firstName,
      lastName: validated.user.lastName,
      username: validated.user.username,
      languageCode: validated.user.languageCode
    });
  },

  async authenticateWithDevFallback() {
    // Safety net: this fallback must never be active in production.
    // If someone accidentally sets ALLOW_DEV_TELEGRAM_FALLBACK=true on Vercel,
    // the app will throw loudly rather than silently bypassing auth.
    if (
      process.env.ALLOW_DEV_TELEGRAM_FALLBACK === "true" &&
      process.env.NODE_ENV === "production"
    ) {
      throw new Error(
        "ALLOW_DEV_TELEGRAM_FALLBACK cannot be enabled in production. " +
          "Remove this env variable from your production environment."
      );
    }

    if (!telegramServerEnv.ALLOW_DEV_TELEGRAM_FALLBACK) {
      throw new TelegramAuthError({
        code: "dev_fallback_disabled",
        message: "Локальный режим разработки отключён.",
        status: 403
      });
    }

    if (telegramServerEnv.DEV_TELEGRAM_INIT_DATA && telegramServerEnv.TELEGRAM_BOT_TOKEN) {
      const validated = validateTelegramInitData({
        botToken: telegramServerEnv.TELEGRAM_BOT_TOKEN,
        initData: telegramServerEnv.DEV_TELEGRAM_INIT_DATA,
        maxAgeSeconds: Number.MAX_SAFE_INTEGER
      });

      return persistIdentity({
        telegramId: BigInt(validated.user.id),
        firstName: validated.user.firstName,
        lastName: validated.user.lastName,
        username: validated.user.username,
        languageCode: validated.user.languageCode
      });
    }

    return persistIdentity({
      telegramId: BigInt(telegramServerEnv.DEV_TELEGRAM_USER_ID),
      firstName: telegramServerEnv.DEV_TELEGRAM_FIRST_NAME,
      lastName: telegramServerEnv.DEV_TELEGRAM_LAST_NAME,
      username: telegramServerEnv.DEV_TELEGRAM_USERNAME,
      languageCode: telegramServerEnv.DEV_TELEGRAM_LANGUAGE_CODE
    });
  }
};
