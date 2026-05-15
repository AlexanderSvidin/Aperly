import { NextResponse } from "next/server";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import { archiveService } from "@/server/services/archive/archive-service";

function buildErrorResponse(error: unknown) {
  if (error instanceof ApiUserAccessError) {
    return buildApiUserAccessErrorResponse(error);
  }

  return NextResponse.json(
    {
      message: "Не удалось загрузить архив."
    },
    {
      status: 500
    }
  );
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const archive = await archiveService.getForUser(user.id);

    return NextResponse.json(archive);
  } catch (error) {
    return buildErrorResponse(error);
  }
}
