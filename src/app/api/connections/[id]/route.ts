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

const patchBodySchema = z.object({
  action: z.literal("END")
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
      message: "Не удалось обработать связь."
    },
    {
      status: 500
    }
  );
}

export async function GET(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id } = await params;
    const connection = await connectionService.getConnectionForUser(user.id, id);

    return NextResponse.json(connection);
  } catch (error) {
    return buildErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = patchBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Неверный формат действия.",
          errors: parsed.error.flatten()
        },
        {
          status: 400
        }
      );
    }

    const connection = await connectionService.endConnection(user.id, id);

    return NextResponse.json({ connection });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
