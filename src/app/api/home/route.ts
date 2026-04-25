import { NextResponse } from "next/server";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import { homeService } from "@/server/services/home/home-service";

export async function GET(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const data = await homeService.getDashboardForUser(user.id);

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
