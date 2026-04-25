import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireAdminApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import {
  ModerationDomainError,
  moderationService
} from "@/server/services/moderation/moderation-service";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const statusActionSchema = z.object({
  action: z.enum(["BLOCK", "DISABLE", "UNBLOCK"]),
  notes: z.string().max(500).optional()
});

function buildErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }

  if (error instanceof ModerationDomainError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message
      },
      {
        status: error.status
      }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        code: "validation_error",
        message: "Некорректные данные moderation-действия.",
        issues: error.issues
      },
      {
        status: 400
      }
    );
  }

  return NextResponse.json(
    {
      message: "Не удалось обновить статус пользователя."
    },
    {
      status: 500
    }
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const admin = await requireAdminApiUserFromRequest(request);
    const body = statusActionSchema.parse(await request.json());
    const { id: targetUserId } = await params;

    const result = await moderationService.updateUserStatus(
      admin.id,
      targetUserId,
      body.action,
      body.notes
    );

    return NextResponse.json(result);
  } catch (error) {
    return buildErrorResponse(error);
  }
}
