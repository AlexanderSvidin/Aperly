import { ZodError } from "zod";
import { NextResponse } from "next/server";

import {
  extractSessionCookieValue,
  getRequestSessionUser
} from "@/server/services/auth/current-user";
import { buildClearedAppSessionCookie } from "@/server/services/auth/session-service";
import { matchingService } from "@/server/services/matching/matching-service";
import { profileService } from "@/server/services/profile/profile-service";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(
    extractSessionCookieValue(request.headers.get("cookie"))
  );

  if (!user) {
    return NextResponse.json(
      {
        message: "Требуется авторизация."
      },
      {
        status: 401
      }
    );
  }

  if (user.status === "BLOCKED" || user.status === "DELETED") {
    const response = NextResponse.json(
      {
        message: "Доступ к профилю ограничен."
      },
      {
        status: 403
      }
    );

    response.cookies.set(buildClearedAppSessionCookie());

    return response;
  }

  const editorData = await profileService.getEditorData(user.id);

  return NextResponse.json(editorData);
}

export async function PUT(request: Request) {
  const user = await getRequestSessionUser(
    extractSessionCookieValue(request.headers.get("cookie"))
  );

  if (!user) {
    return NextResponse.json(
      {
        message: "Требуется авторизация."
      },
      {
        status: 401
      }
    );
  }

  if (user.status === "BLOCKED" || user.status === "DELETED") {
    const response = NextResponse.json(
      {
        message: "Профиль недоступен для редактирования."
      },
      {
        status: 403
      }
    );

    response.cookies.set(buildClearedAppSessionCookie());

    return response;
  }

  try {
    const payload = await request.json();
    const result = await profileService.upsertProfile(user.id, payload);

    if (result.matchingRelevantFieldsChanged) {
      await matchingService.recomputeForUser(user.id);
    }

    return NextResponse.json({
      created: result.created,
      matchingRelevantFieldsChanged: result.matchingRelevantFieldsChanged,
      onboardingCompleted: result.user.onboardingCompleted
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Проверьте поля профиля.",
          issues: error.issues
        },
        {
          status: 422
        }
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Не удалось сохранить профиль."
      },
      {
        status: 400
      }
    );
  }
}
