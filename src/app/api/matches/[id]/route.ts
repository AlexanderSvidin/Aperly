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

type MatchRouteProps = {
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
      message: "Не удалось загрузить карточку матча."
    },
    {
      status: 500
    }
  );
}

export async function GET(request: Request, { params }: MatchRouteProps) {
  try {
    const user = await requireApiUserFromRequest(request);
    const resolvedParams = await params;
    const match = await matchingService.getDetailForUser(user.id, resolvedParams.id);

    return NextResponse.json({
      match
    });
  } catch (error) {
    return buildMatchingErrorResponse(error);
  }
}
