import { NextResponse } from "next/server";

import {
  createAppSessionValue,
  buildAppSessionCookie
} from "@/server/services/auth/session-service";
import {
  TelegramAuthError,
  telegramAuthService
} from "@/server/services/auth/telegram-auth-service";
import { serializeSessionUser } from "@/server/services/auth/current-user";

export async function POST() {
  try {
    const user = await telegramAuthService.authenticateWithDevFallback();
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
        message: "Локальный вход сейчас недоступен."
      },
      {
        status: 500
      }
    );
  }
}
