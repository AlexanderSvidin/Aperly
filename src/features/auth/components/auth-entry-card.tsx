"use client";

import { useState, useTransition } from "react";

import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useTelegramApp,
  useTelegramDetecting
} from "@/features/telegram/components/telegram-app-provider";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/telegram/constants";

type AuthErrorState = {
  message: string;
};

function getRuntimeHint(source: "telegram" | "dev" | "browser") {
  if (source === "telegram") {
    return "Приложение открыто в Telegram. Можно продолжить без отдельной регистрации.";
  }

  if (source === "dev") {
    return "Включён локальный режим разработки. Он доступен только при явном серверном флаге.";
  }

  return "Откройте Aperly через кнопку Mini App в Telegram.";
}

export function AuthEntryCard() {
  const router = useRouter();
  const telegram = useTelegramApp();
  const isDetecting = useTelegramDetecting();
  const [error, setError] = useState<AuthErrorState | null>(null);
  const [isPending, startTransition] = useTransition();

  // ------------------------------------------------------------------
  // Loading skeleton — shown while we poll for window.Telegram.WebApp.
  // This prevents Telegram's white loading overlay from appearing empty
  // and ensures the button is never visible before WebApp.ready() has
  // been called (which would leave touches blocked by the WebView).
  // Both the SSR render and the first client render see isDetecting=true
  // (the context default), so there is no hydration mismatch.
  // ------------------------------------------------------------------
  if (isDetecting) {
    return (
      <Card eyebrow="Быстрый вход" title="Начать">
        <div className="screen-stack">
          <p className="card-body-copy auth-card-loading-hint">
            Инициализируем Telegram…
          </p>
          <div className="button button-primary button-full auth-card-loading-btn" aria-hidden="true" />
        </div>
      </Card>
    );
  }

  // ------------------------------------------------------------------
  // Resolved state — SDK detection is complete
  // ------------------------------------------------------------------
  const canUseDevAuth = telegram.source === "dev";
  const canUseTelegramAuth = telegram.source === "telegram";
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
        // Re-read initData at click time — it is the most authoritative source
        // and may have been set after the initial provider snapshot.
        const freshInitData =
          window.Telegram?.WebApp?.initData || telegram.initData || null;

        if (freshInitData) {
          headers[TELEGRAM_INIT_DATA_HEADER] = freshInitData;
        }
      }

      const response = await fetch(endpoint, {
        cache: "no-store",
        method: "POST",
        headers
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; redirectTo?: string }
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
            "Не удалось войти. Проверьте, что приложение открыто через Telegram."
        });
        return;
      }

      window.location.assign(payload?.redirectTo ?? "/opportunities");
    });
  }

  return (
    <Card eyebrow="Быстрый вход" title="Начать">
      <div className="screen-stack">
        <p className="card-body-copy">
          {getRuntimeHint(telegram.source)}
        </p>

        {error ? <p className="error-text">{error.message}</p> : null}

        <Button
          fullWidth
          disabled={!canAuthenticate || isPending}
          onClick={handleSubmit}
          type="button"
        >
          {isPending ? "Проверяем доступ…" : primaryButtonLabel}
        </Button>

        <p className="helper-text">
          Сначала вход, потом короткий профиль. После сохранения вы сможете
          выбрать сценарий и начать поиск.
        </p>
      </div>
    </Card>
  );
}
