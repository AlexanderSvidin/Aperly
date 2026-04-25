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

function getRuntimeHint(source: "telegram" | "dev" | "browser", hasInitData: boolean) {
  if (source === "telegram" && hasInitData) {
    return "Приложение открыто в Telegram. Можно продолжить без отдельной регистрации.";
  }

  if (source === "dev") {
    return "Включён локальный режим разработки. Он доступен только при явном серверном флаге.";
  }

  return "Откройте Aperly из Telegram или включите локальный режим разработки.";
}

export function AuthEntryCard() {
  const router = useRouter();
  const telegram = useTelegramApp();
  const [error, setError] = useState<AuthErrorState | null>(null);
  const [isPending, startTransition] = useTransition();

  const canUseTelegramAuth =
    telegram.source === "telegram" && Boolean(telegram.initData);
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

      if (canUseTelegramAuth && telegram.initData) {
        headers[TELEGRAM_INIT_DATA_HEADER] = telegram.initData;
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
        <p className="card-body-copy">
          {getRuntimeHint(telegram.source, Boolean(telegram.initData))}
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
