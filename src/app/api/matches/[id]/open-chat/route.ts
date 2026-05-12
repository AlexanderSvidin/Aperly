import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import {
  ChatDomainError,
  chatService
} from "@/server/services/chat/chat-service";
import { analyticsService } from "@/server/services/analytics/analytics-service";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const introBodySchema = z.object({
  introMessage: z.string().trim().min(10).max(500)
});

function buildErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }
  if (error instanceof ChatDomainError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.status }
    );
  }
  return NextResponse.json(
    { message: "Не удалось отправить отклик." },
    { status: 500 }
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  let userId: string | null = null;
  let matchId: string | null = null;

  try {
    const user = await requireApiUserFromRequest(request);
    userId = user.id;
    const resolvedParams = await params;
    matchId = resolvedParams.id;
    const body = await request.json().catch(() => null);
    const parsed = introBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Коротко напишите, почему хотите присоединиться.",
          errors: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const result = await chatService.openFromMatch(
      user.id,
      matchId,
      parsed.data.introMessage
    );
    return NextResponse.json(result);
  } catch (error) {
    if (userId && matchId) {
      await analyticsService.track("invite_failed", {
        matchId,
        userId
      });
    }

    return buildErrorResponse(error);
  }
}
