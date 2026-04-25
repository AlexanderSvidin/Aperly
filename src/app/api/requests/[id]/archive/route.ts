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
      message: "Не удалось архивировать запрос."
    },
    {
      status: 500
    }
  );
}

export async function POST(request: Request, { params }: RequestRouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const resolvedParams = await params;
    const archivedRequest = await requestService.archive(
      {
        id: user.id,
        status: user.status,
        onboardingCompleted: user.onboardingCompleted
      },
      resolvedParams.id
    );

    return NextResponse.json({
      request: archivedRequest
    });
  } catch (error) {
    return buildRequestErrorResponse(error);
  }
}
