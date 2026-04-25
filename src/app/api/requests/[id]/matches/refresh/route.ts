import { NextResponse } from "next/server";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import {
  MatchingDomainError,
  matchingService
} from "@/server/services/matching/matching-service";

type RequestRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function buildMatchingErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }

  if (error instanceof MatchingDomainError) {
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
      message: "Не удалось обновить подборы."
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
    const result = await matchingService.refreshForOwnedRequest(
      user.id,
      resolvedParams.id
    );

    return NextResponse.json(result);
  } catch (error) {
    return buildMatchingErrorResponse(error);
  }
}
