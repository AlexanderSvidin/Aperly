import { NextResponse } from "next/server";

import {
  extractSessionCookieValue,
  getRequestSessionUser
} from "@/server/services/auth/current-user";
import { buildClearedAppSessionCookie } from "@/server/services/auth/session-service";

export class ApiUserAccessError extends Error {
  code: string;
  status: number;
  clearSession: boolean;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    clearSession?: boolean;
  }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
    this.clearSession = params.clearSession ?? false;
  }
}

export async function requireApiUserFromRequest(request: Request) {
  const user = await getRequestSessionUser(
    extractSessionCookieValue(request.headers.get("cookie"))
  );

  if (!user) {
    throw new ApiUserAccessError({
      code: "unauthenticated",
      message: "Требуется авторизация.",
      status: 401
    });
  }

  if (user.status === "BLOCKED" || user.status === "DELETED") {
    throw new ApiUserAccessError({
      code: user.status === "BLOCKED" ? "user_blocked" : "user_deleted",
      message:
        user.status === "BLOCKED"
          ? "Доступ к запросам ограничен."
          : "Аккаунт удалён и не может управлять запросами.",
      status: 403,
      clearSession: true
    });
  }

  return user;
}

export async function requireAdminApiUserFromRequest(request: Request) {
  const user = await requireApiUserFromRequest(request);

  if (user.role !== "ADMIN") {
    throw new ApiUserAccessError({
      code: "admin_only",
      message: "Доступен только администратору.",
      status: 403
    });
  }

  return user;
}

export function buildApiUserAccessErrorResponse(error: ApiUserAccessError) {
  const response = NextResponse.json(
    {
      code: error.code,
      message: error.message
    },
    {
      status: error.status
    }
  );

  if (error.clearSession) {
    response.cookies.set(buildClearedAppSessionCookie());
  }

  return response;
}
