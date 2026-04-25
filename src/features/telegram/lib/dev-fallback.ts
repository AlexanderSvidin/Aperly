import { clientEnv } from "@/lib/env/client";
import type { TelegramRuntimeSession } from "@/features/telegram/lib/types";

export function createDevTelegramSession(): TelegramRuntimeSession {
  return {
    source: "dev",
    initData: "dev-init-data",
    user: {
      id: 1000001,
      firstName: "Aperly",
      lastName: "Dev",
      username: clientEnv.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    },
    platform: "local-browser",
    colorScheme: "light",
    isAvailable: true
  };
}
