import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import {
  ConnectionDomainError,
  connectionService
} from "@/server/services/connections/connection-service";

type RouteProps = {
  params: Promise<{
    requestId: string;
  }>;
};

const responseBodySchema = z.object({
  message: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .nullable()
    .transform((value) => value || "Привет! Мне интересно подключиться.")
});

function buildErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }

  if (error instanceof ConnectionDomainError) {
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

  return NextResponse.json(
    {
      message: "Не удалось отправить отклик."
    },
    {
      status: 500
    }
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { requestId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = responseBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Сообщение слишком длинное. Сократите его и попробуйте ещё раз.",
          errors: parsed.error.flatten()
        },
        {
          status: 400
        }
      );
    }

    const interaction = await connectionService.createResponseForRequest(
      user.id,
      requestId,
      parsed.data.message
    );

    return NextResponse.json({ interaction });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
