import { NextResponse } from "next/server";

import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram/constants";
import {
  createAppSessionValue,
  buildAppSessionCookie
} from "@/server/services/auth/session-service";
import {
  TelegramAuthError,
  telegramAuthService
} from "@/server/services/auth/telegram-auth-service";
import { serializeSessionUser } from "@/server/services/auth/current-user";
import { checkRateLimit } from "@/server/services/rate-limit/in-memory-rate-limit";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimit = checkRateLimit(`telegram-auth:${ip}`, {
      limit: 40,
      windowMs: 60_000
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Слишком много попыток входа. Попробуйте чуть позже." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const initData = request.headers.get(TELEGRAM_INIT_DATA_HEADER)?.trim();

    if (!initData) {
      return NextResponse.json(
        {
          message: "Telegram initData не передан."
        },
        {
          status: 400
        }
      );
    }

    const user = await telegramAuthService.authenticateWithTelegram(initData);
    const response = NextResponse.json({
      redirectTo: user.onboardingCompleted ? "/home" : "/onboarding",
      user: serializeSessionUser(user)
    });

    response.cookies.set(
      buildAppSessionCookie(
        createAppSessionValue({
          userId: user.id,
          telegramId: user.telegramId.toString(),
          role: user.role
        })
      )
    );

    return response;
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          redirectTo: error.redirectTo
        },
        {
          status: error.status
        }
      );
    }

    return NextResponse.json(
      {
        message: "Не удалось авторизоваться через Telegram."
      },
      {
        status: 500
      }
    );
  }
}
