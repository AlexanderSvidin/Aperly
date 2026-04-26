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
import { checkRateLimit } from "@/server/services/rate-limit/in-memory-rate-limit";

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
    { message: "Не удалось отправить напоминание." },
    { status: 500 }
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id: chatId } = await params;
    const rateLimit = checkRateLimit(`chat-reminder:${user.id}:${chatId}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Напоминание уже отправлялось недавно. Попробуйте позже." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const result = await chatService.sendReminder(user.id, chatId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
