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
import { analyticsService } from "@/server/services/analytics/analytics-service";

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
  let userId: string | null = null;
  let requestId: string | null = null;

  try {
    const user = await requireApiUserFromRequest(request);
    userId = user.id;
    const resolvedParams = await params;
    requestId = resolvedParams.id;
    await analyticsService.track("match_refresh_clicked", {
      requestId,
      userId
    });
    const result = await matchingService.refreshForOwnedRequest(
      user.id,
      resolvedParams.id
    );

    return NextResponse.json(result);
  } catch (error) {
    if (userId && requestId) {
      await analyticsService.track("match_refresh_completed", {
        requestId,
        userId,
        success: false
      });
    }

    return buildMatchingErrorResponse(error);
  }
}
