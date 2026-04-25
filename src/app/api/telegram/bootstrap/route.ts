import { NextResponse } from "next/server";

import { telegramServerEnv } from "@/lib/env/server";
import { resolveTelegramRequestContext } from "@/lib/telegram/request";

export async function GET(request: Request) {
  const context = resolveTelegramRequestContext(request.headers);

  return NextResponse.json({
    source: context.source,
    hasInitData: Boolean(context.initData),
    devFallbackEnabled: telegramServerEnv.ALLOW_DEV_TELEGRAM_FALLBACK
  });
}
