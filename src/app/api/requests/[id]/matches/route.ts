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
      message: "Не удалось загрузить подборы."
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
    const matches = await matchingService.listForOwnedRequest(
      user.id,
      resolvedParams.id
    );

    return NextResponse.json(matches);
  } catch (error) {
    return buildMatchingErrorResponse(error);
  }
}
