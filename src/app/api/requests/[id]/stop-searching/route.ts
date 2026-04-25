import { NextResponse } from "next/server";

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
  return NextResponse.json(
    { message: "Не удалось остановить поиск." },
    { status: 500 }
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id: requestId } = await params;
    await studySessionService.stopSearching(user.id, requestId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
