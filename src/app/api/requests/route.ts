import { ZodError } from "zod";
import { NextResponse } from "next/server";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import {
  RequestDomainError,
  requestService
} from "@/server/services/requests/request-service";

function buildRequestErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        message: "Проверьте поля запроса.",
        issues: error.issues
      },
      {
        status: 422
      }
    );
  }

  if (error instanceof RequestDomainError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        meta: error.meta
      },
      {
        status: error.status
      }
    );
  }

  return NextResponse.json(
    {
      message: "Не удалось обработать запрос."
    },
    {
      status: 500
    }
  );
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const requests = await requestService.listForUser(user.id);

    return NextResponse.json({
      requests
    });
  } catch (error) {
    return buildRequestErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const payload = await request.json();
    const createdRequest = await requestService.create(
      {
        id: user.id,
        status: user.status,
        onboardingCompleted: user.onboardingCompleted
      },
      payload
    );

    return NextResponse.json(
      {
        request: createdRequest
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return buildRequestErrorResponse(error);
  }
}
