import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import { matchingService } from "@/server/services/matching/matching-service";
import { profileService } from "@/server/services/profile/profile-service";

function buildErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        message: "Проверьте поля навыков и интересов.",
        issues: error.issues
      },
      { status: 422 }
    );
  }

  return NextResponse.json(
    {
      message:
        error instanceof Error ? error.message : "Не удалось сохранить навыки."
    },
    { status: 400 }
  );
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const payload = await request.json().catch(() => null);
    const result = await profileService.updateSkillsSection(user.id, payload);

    if (result.matchingRelevantFieldsChanged) {
      await matchingService.recomputeForUser(user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
