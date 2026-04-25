import { NextResponse } from "next/server";

import {
  extractSessionCookieValue,
  getRequestSessionUser,
  serializeSessionUser
} from "@/server/services/auth/current-user";
import { buildClearedAppSessionCookie } from "@/server/services/auth/session-service";

export async function GET(request: Request) {
  const user = await getRequestSessionUser(
    extractSessionCookieValue(request.headers.get("cookie"))
  );

  if (!user) {
    return NextResponse.json({
      authenticated: false
    });
  }

  if (user.status === "BLOCKED" || user.status === "DELETED") {
    const response = NextResponse.json(
      {
        authenticated: false,
        reason: user.status === "BLOCKED" ? "blocked" : "deleted"
      },
      {
        status: 403
      }
    );

    response.cookies.set(buildClearedAppSessionCookie());

    return response;
  }

  return NextResponse.json({
    authenticated: true,
    user: serializeSessionUser(user)
  });
}
