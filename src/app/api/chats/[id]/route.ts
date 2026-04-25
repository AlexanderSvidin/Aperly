import { NextResponse } from "next/server";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import {
  ChatDomainError,
  chatService
} from "@/server/services/chat/chat-service";

type RouteProps = {
  params: Promise<{ id: string }>;
};

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
    { message: "Не удалось загрузить метаданные чата." },
    { status: 500 }
  );
}

export async function GET(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id: chatId } = await params;
    const result = await chatService.getChatMetadata(user.id, chatId);
    return NextResponse.json(result);
  } catch (error) {
    return buildErrorResponse(error);
  }
}
