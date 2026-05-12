import { NextResponse } from "next/server";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import { homeService } from "@/server/services/home/home-service";

function resolveScenarioFilter(request: Request) {
  const url = new URL(request.url);
  const scenario = url.searchParams.get("scenario");

  if (scenario === "CASE" || scenario === "PROJECT" || scenario === "STUDY") {
    return scenario;
  }

  return "ALL";
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const data = await homeService.getFeedForUser(user.id, {
      scenario: resolveScenarioFilter(request)
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiUserAccessError) {
      return buildApiUserAccessErrorResponse(error);
    }

    return NextResponse.json(
      {
        message: "Не удалось загрузить домашний экран."
      },
      {
        status: 500
      }
    );
  }
}
