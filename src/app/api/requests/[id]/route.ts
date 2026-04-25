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

type RequestRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function GET(request: Request, { params }: RequestRouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const resolvedParams = await params;
    const userRequest = await requestService.getById(user.id, resolvedParams.id);

    return NextResponse.json({
      request: userRequest
    });
  } catch (error) {
    return buildRequestErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RequestRouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const resolvedParams = await params;
    const payload = await request.json();
    const updatedRequest = await requestService.update(
      {
        id: user.id,
        status: user.status,
        onboardingCompleted: user.onboardingCompleted
      },
      resolvedParams.id,
      payload
    );

    return NextResponse.json({
      request: updatedRequest
    });
  } catch (error) {
    return buildRequestErrorResponse(error);
  }
}
