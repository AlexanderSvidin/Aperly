"use client";

import { useState, useTransition } from "react";

import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTelegramApp } from "@/features/telegram/components/telegram-app-provider";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram/constants";

type AuthErrorState = {
  message: string;
};

function getRuntimeHint(
  source: "telegram" | "dev" | "browser",
  hasInitData: boolean,
  hasTelegramWebApp: boolean
) {
  if (source === "telegram" && hasInitData) {
    return "Приложение открыто в Telegram. Можно продолжить без отдельной регистрации.";
  }

  if (source === "telegram" || hasTelegramWebApp) {
    return "Telegram WebApp найден, но initData пустой. Откройте Aperly через кнопку Mini App в Telegram.";
  }

  if (source === "dev") {
    return "Включён локальный режим разработки. Он доступен только при явном серверном флаге.";
  }

  return "Откройте Aperly из Telegram или включите локальный режим разработки.";
}

export function AuthEntryCard() {
  const router = useRouter();
  const telegram = useTelegramApp();
  const liveWebApp =
    typeof window !== "undefined" ? window.Telegram?.WebApp : null;
  const hasTelegramWebApp =
    Boolean(liveWebApp);
  const telegramInitData = telegram.initData || liveWebApp?.initData || null;
  const [error, setError] = useState<AuthErrorState | null>(null);
  const [isPending, startTransition] = useTransition();

  // Enable as soon as the Telegram WebApp object is present.
  // We do NOT gate on initData here because webApp.initData can legitimately
  // be an empty string "" on first render (treated as falsy by ||), which
  // would leave the button permanently disabled.  initData is re-read fresh
  // at click time inside handleSubmit below.
  const canUseTelegramAuth = hasTelegramWebApp;
  const canUseDevAuth = telegram.source === "dev";
  const canAuthenticate = canUseTelegramAuth || canUseDevAuth;

  const primaryButtonLabel = canUseDevAuth
    ? "Войти в режиме разработки"
    : "Продолжить через Telegram";

  function handleSubmit() {
    startTransition(async () => {
      setError(null);

      const endpoint = canUseDevAuth ? "/api/auth/dev" : "/api/auth/telegram";
      const headers: HeadersInit = {};

      if (canUseTelegramAuth) {
        // Re-read initData at click time: the context value (telegram.initData)
        // may still be null on first render, but window.Telegram.WebApp.initData
        // is the authoritative live value populated by the Telegram SDK.
        const freshInitData =
          window.Telegram?.WebApp?.initData ||
          telegram.initData ||
          telegramInitData ||
          null;

        if (freshInitData) {
          headers[TELEGRAM_INIT_DATA_HEADER] = freshInitData;
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            redirectTo?: string;
          }
        | null;

      if (!response.ok) {
        if (payload?.redirectTo) {
          router.push(payload.redirectTo as Route);
          router.refresh();
          return;
        }

        setError({
          message:
            payload?.message ??
            "Не удалось войти. Проверьте, что приложение открыто в Telegram или включён локальный режим разработки."
        });
        return;
      }

      router.push((payload?.redirectTo ?? "/home") as Route);
      router.refresh();
    });
  }

  return (
    <Card eyebrow="Быстрый вход" title="Начать">
      <div className="screen-stack">
        <p className="card-body-copy" suppressHydrationWarning>
          {getRuntimeHint(
            telegram.source,
            Boolean(telegramInitData),
            hasTelegramWebApp
          )}
        </p>

        {error ? <p className="error-text">{error.message}</p> : null}

        <Button
          fullWidth
          disabled={!canAuthenticate || isPending}
          onClick={handleSubmit}
        >
          {isPending ? "Проверяем доступ..." : primaryButtonLabel}
        </Button>

        <p className="helper-text">
          Сначала вход, потом короткий профиль. После сохранения вы сможете
          выбрать сценарий и начать поиск.
        </p>
      </div>
    </Card>
  );
}
