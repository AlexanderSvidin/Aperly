"use client";

import { useTelegramApp } from "@/features/telegram/components/telegram-app-provider";

function getStatusLabel(source: "telegram" | "dev" | "browser") {
  if (source === "telegram") {
    return "Открыто в Telegram";
  }

  if (source === "dev") {
    return "Режим разработки";
  }

  return "Открыто вне Telegram";
}

export function TelegramStatusChip() {
  const telegram = useTelegramApp();

  return (
    <span className="status-pill" data-source={telegram.source}>
      {getStatusLabel(telegram.source)}
    </span>
  );
}
