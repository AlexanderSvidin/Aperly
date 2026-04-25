import { NextResponse } from "next/server";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import { chatService } from "@/server/services/chat/chat-service";

function buildErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }
  return NextResponse.json(
    { message: "Не удалось загрузить список чатов." },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const result = await chatService.listForUser(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return buildErrorResponse(error);
  }
}
