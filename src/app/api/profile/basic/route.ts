import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import { profileService } from "@/server/services/profile/profile-service";

function buildErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        message: "Проверьте обязательные поля.",
        issues: error.issues
      },
      { status: 422 }
    );
  }

  return NextResponse.json(
    {
      message:
        error instanceof Error ? error.message : "Не удалось сохранить профиль."
    },
    { status: 400 }
  );
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const payload = await request.json().catch(() => null);
    await profileService.updateBasicSection(user.id, payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
