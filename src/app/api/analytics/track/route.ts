import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiUserAccessError,
  buildApiUserAccessErrorResponse,
  requireApiUserFromRequest
} from "@/server/services/auth/api-user-guard";
import { analyticsService } from "@/server/services/analytics/analytics-service";
import { checkRateLimit } from "@/server/services/rate-limit/in-memory-rate-limit";

const analyticsEventSchema = z.object({
  event: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({})
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUserFromRequest(request);
    const rateLimit = checkRateLimit(`analytics-track:${user.id}`, {
      limit: 120,
      windowMs: 60_000
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Слишком много событий аналитики. Попробуйте позже." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const body = analyticsEventSchema.parse(await request.json());

    await analyticsService.track(body.event, {
      ...body.payload,
      userId: user.id,
      source: "client"
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    if (error instanceof ApiUserAccessError) {
      return buildApiUserAccessErrorResponse(error);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "validation_error",
          message: "Неверный формат события аналитики.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Не удалось записать событие аналитики." },
      { status: 500 }
    );
  }
}
