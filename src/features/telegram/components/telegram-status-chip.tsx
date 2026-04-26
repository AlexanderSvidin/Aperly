"use client";

import { useTelegramApp } from "@/features/telegram/components/telegram-app-provider";

function getStatusLabel(
  source: "telegram" | "dev" | "browser",
  hasTelegramWebApp: boolean
) {
  if (source === "telegram" || hasTelegramWebApp) {
    return "Открыто в Telegram";
  }

  if (source === "dev") {
    return "Режим разработки";
  }

  return "Telegram не найден";
}

export function TelegramStatusChip() {
  const telegram = useTelegramApp();
  const hasTelegramWebApp =
    typeof window !== "undefined" && Boolean(window.Telegram?.WebApp);
  const dataSource = hasTelegramWebApp ? "telegram" : telegram.source;

  return (
    <span
      className="status-pill"
      data-source={dataSource}
      suppressHydrationWarning
    >
      {getStatusLabel(telegram.source, hasTelegramWebApp)}
    </span>
  );
}
