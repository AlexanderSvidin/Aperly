"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type MePayload =
  | {
      authenticated: false;
      reason?: string;
    }
  | {
      authenticated: true;
      user: {
        onboardingCompleted: boolean;
        status: string;
      };
    };

export default function LoadingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkSession = useCallback(async () => {
    setError(null);
    setIsRetrying(true);

    try {
      const response = await fetch("/api/me", {
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => null)) as MePayload | null;

      if (!response.ok || !payload) {
        if (payload && !payload.authenticated && payload.reason) {
          router.replace("/blocked");
          return;
        }

        throw new Error("Не удалось проверить Telegram-сессию.");
      }

      if (!payload.authenticated) {
        router.replace("/onboarding");
        return;
      }

      if (payload.user.status === "BLOCKED" || payload.user.status === "DELETED") {
        router.replace("/blocked");
        return;
      }

      router.replace(payload.user.onboardingCompleted ? "/opportunities" : "/onboarding");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки.");
    } finally {
      setIsRetrying(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkSession();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [checkSession]);

  return (
    <main className="welcome-layout">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Aperly</p>
          <h1 className="screen-title">Ищем ваш профиль в Telegram</h1>
          <p className="screen-description">
            Проверяем сессию и обновляем данные, чтобы не показать профиль другого аккаунта.
          </p>
        </div>
        {error ? (
          <div className="feedback-box error-box">
            <p className="feedback-title">{error}</p>
          </div>
        ) : (
          <div className="feedback-box">
            <p className="feedback-title">Загрузка...</p>
          </div>
        )}
        {error ? (
          <Button isLoading={isRetrying} loadingLabel="Проверяем..." onClick={checkSession}>
            Повторить
          </Button>
        ) : null}
      </section>
    </main>
  );
}
