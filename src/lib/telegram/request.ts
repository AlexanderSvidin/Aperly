import { telegramServerEnv } from "@/lib/env/server";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram/constants";

export type TelegramRequestContext = {
  source: "telegram" | "dev" | "missing";
  initData: string | null;
};

export function resolveTelegramRequestContext(
  requestHeaders: Headers
): TelegramRequestContext {
  const initData = requestHeaders.get(TELEGRAM_INIT_DATA_HEADER)?.trim();

  if (initData) {
    return {
      source: "telegram",
      initData
    };
  }

  if (
    telegramServerEnv.ALLOW_DEV_TELEGRAM_FALLBACK &&
    telegramServerEnv.DEV_TELEGRAM_INIT_DATA
  ) {
    return {
      source: "dev",
      initData: telegramServerEnv.DEV_TELEGRAM_INIT_DATA
    };
  }

  return {
    source: "missing",
    initData: null
  };
}

export function createTelegramRequestHeaders(
  initData: string | null | undefined
): HeadersInit {
  if (!initData) {
    return {};
  }

  return {
    [TELEGRAM_INIT_DATA_HEADER]: initData
  };
}
