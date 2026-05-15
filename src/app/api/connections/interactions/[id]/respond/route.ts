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
    id: string;
  }>;
};

const respondBodySchema = z.object({
  decision: z.enum(["ACCEPT", "DECLINE"])
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
      message: "Не удалось ответить на входящее взаимодействие."
    },
    {
      status: 500
    }
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = respondBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Неверный формат ответа.",
          errors: parsed.error.flatten()
        },
        {
          status: 400
        }
      );
    }

    const result = await connectionService.respondToInteraction(
      user.id,
      id,
      parsed.data.decision
    );

    return NextResponse.json(result);
  } catch (error) {
    return buildErrorResponse(error);
  }
}
