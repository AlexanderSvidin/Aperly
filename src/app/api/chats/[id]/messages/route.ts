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
import { checkRateLimit } from "@/server/services/rate-limit/in-memory-rate-limit";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const sendMessageBodySchema = z.object({
  text: z.string().min(1).max(4000)
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
    { message: "Не удалось выполнить операцию с сообщениями." },
    { status: 500 }
  );
}

export async function GET(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id: chatId } = await params;

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;

    const result = await chatService.getMessages(user.id, chatId, cursor);
    return NextResponse.json(result);
  } catch (error) {
    return buildErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id: chatId } = await params;
    const rateLimit = checkRateLimit(`chat-message:${user.id}:${chatId}`, {
      limit: 30,
      windowMs: 60_000
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Слишком много сообщений. Попробуйте чуть позже." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const body = await request.json();
    const parsed = sendMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Неверный формат запроса.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await chatService.sendMessage(user.id, chatId, parsed.data.text);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
