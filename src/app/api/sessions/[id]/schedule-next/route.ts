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

const scheduleNextSchema = z.object({
  scheduledAt: z.string().datetime(),
  format: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
  notes: z.string().max(500).optional()
});

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
    { message: "Не удалось запланировать следующую сессию." },
    { status: 500 }
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id: sessionId } = await params;
    const body = scheduleNextSchema.parse(await request.json());
    const session = await studySessionService.scheduleNext(user.id, sessionId, body);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
