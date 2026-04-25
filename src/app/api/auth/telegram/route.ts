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

export async function POST(request: Request) {
  try {
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
