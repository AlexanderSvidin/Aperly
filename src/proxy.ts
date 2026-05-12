import { NextResponse } from "next/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Expires: "0",
  Pragma: "no-cache",
  Vary: "Cookie, x-telegram-init-data"
} as const;

export function proxy() {
  const response = NextResponse.next();

  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(name, value);
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"]
};
