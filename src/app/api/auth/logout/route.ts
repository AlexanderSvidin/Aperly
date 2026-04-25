import { NextResponse } from "next/server";

import { buildClearedAppSessionCookie } from "@/server/services/auth/session-service";

export async function POST() {
  const response = NextResponse.json({
    ok: true
  });

  response.cookies.set(buildClearedAppSessionCookie());

  return response;
}
