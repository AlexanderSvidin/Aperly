import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import {
  SessionDomainError,
  studySessionService
} from "@/server/services/study-sessions/study-session-service";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const sessionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CONFIRM") }),
  z.object({ action: z.literal("CANCEL") }),
  z.object({ action: z.literal("MARK_COMPLETED") }),
  z.object({ action: z.literal("MARK_MISSED") }),
  z.object({
    action: z.literal("RESCHEDULE"),
    scheduledAt: z.string().datetime(),
    notes: z.string().max(500).optional()
  })
]);

function buildErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }
  if (error instanceof SessionDomainError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.status }
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { code: "validation_error", message: "Неверные данные запроса.", issues: error.issues },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { message: "Не удалось обновить сессию." },
    { status: 500 }
  );
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id: sessionId } = await params;
    const body = sessionActionSchema.parse(await request.json());

    const extraData =
      body.action === "RESCHEDULE"
        ? { scheduledAt: body.scheduledAt, notes: body.notes }
        : undefined;

    const session = await studySessionService.updateSession(
      user.id,
      sessionId,
      body.action,
      extraData
    );

    return NextResponse.json(session);
  } catch (error) {
    return buildErrorResponse(error);
  }
}
