import { NextResponse } from "next/server";
import { z } from "zod";

import { reportReasonOptions } from "@/features/moderation/lib/report-options";
import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import {
  ModerationDomainError,
  moderationService
} from "@/server/services/moderation/moderation-service";

const createReportSchema = z
  .object({
    targetUserId: z.string().uuid().optional(),
    chatId: z.string().uuid().optional(),
    matchId: z.string().uuid().optional(),
    requestId: z.string().uuid().optional(),
    reasonCode: z.enum(reportReasonOptions.map((option) => option.value) as [
      (typeof reportReasonOptions)[number]["value"],
      ...(typeof reportReasonOptions)[number]["value"][]
    ]),
    details: z.string().trim().max(1000).optional()
  })
  .refine(
    (value) =>
      Boolean(value.targetUserId || value.chatId || value.matchId || value.requestId),
    {
      message: "Нужно выбрать хотя бы один контекст для репорта.",
      path: ["targetUserId"]
    }
  );

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
        message: "Некорректные данные репорта.",
        issues: error.issues
      },
      {
        status: 400
      }
    );
  }

  return NextResponse.json(
    {
      message: "Не удалось отправить репорт."
    },
    {
      status: 500
    }
  );
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const body = createReportSchema.parse(await request.json());
    const result = await moderationService.createReport({
      reporterUserId: user.id,
      targetUserId: body.targetUserId,
      chatId: body.chatId,
      matchId: body.matchId,
      requestId: body.requestId,
      reasonCode: body.reasonCode,
      details: body.details
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
