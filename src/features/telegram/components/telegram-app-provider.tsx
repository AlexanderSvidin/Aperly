"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";

import {
  applyTelegramTheme,
  buildTelegramRuntimeSession
} from "@/features/telegram/lib/browser";
import { createDevTelegramSession } from "@/features/telegram/lib/dev-fallback";
import type { TelegramRuntimeSession } from "@/features/telegram/lib/types";
import { clientEnv } from "@/lib/env/client";

const defaultSession: TelegramRuntimeSession = {
  source: "browser",
  initData: null,
  user: null,
  platform: "browser",
  colorScheme: "light",
  isAvailable: false
};

const TelegramAppContext =
  createContext<TelegramRuntimeSession>(defaultSession);

const TELEGRAM_SDK_WAIT_MS = 1500;
const TELEGRAM_SDK_POLL_MS = 50;

export function TelegramAppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TelegramRuntimeSession>(defaultSession);

  useEffect(() => {
    let sessionUpdateId: number | null = null;
    let fallbackTimeoutId: number | null = null;
    let intervalId: number | null = null;
    const scheduleSessionUpdate = (nextSession: TelegramRuntimeSession) => {
      sessionUpdateId = window.setTimeout(() => {
        setSession(nextSession);
      }, 0);
    };

    const cleanupTimers = () => {
      if (sessionUpdateId !== null) {
        window.clearTimeout(sessionUpdateId);
      }

      if (fallbackTimeoutId !== null) {
        window.clearTimeout(fallbackTimeoutId);
      }

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };

    const hydrateFromTelegram = () => {
      if (typeof window === "undefined" || !window.Telegram?.WebApp) {
        return false;
      }

      const Telegram = window.Telegram;
      const webApp = Telegram.WebApp!;

      console.log("Telegram WebApp detected", webApp.initData);
      console.log("Telegram WebApp initDataUnsafe", webApp.initDataUnsafe);

      webApp.ready();
      webApp.expand();
      applyTelegramTheme(webApp);

      scheduleSessionUpdate(buildTelegramRuntimeSession(webApp));
      return true;
    };

    if (hydrateFromTelegram()) {
      return cleanupTimers;
    }

    intervalId = window.setInterval(() => {
      if (hydrateFromTelegram()) {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
        if (fallbackTimeoutId !== null) {
          window.clearTimeout(fallbackTimeoutId);
          fallbackTimeoutId = null;
        }
      }
    }, TELEGRAM_SDK_POLL_MS);

    fallbackTimeoutId = window.setTimeout(() => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }

      if (hydrateFromTelegram()) {
        return;
      }

      if (
        process.env.NODE_ENV !== "production" &&
        clientEnv.NEXT_PUBLIC_ENABLE_DEV_TELEGRAM_FALLBACK
      ) {
        scheduleSessionUpdate(createDevTelegramSession());
        return;
      }

      scheduleSessionUpdate(defaultSession);
    }, TELEGRAM_SDK_WAIT_MS);

    return cleanupTimers;
  }, []);

  return (
    <TelegramAppContext.Provider value={session}>
      {children}
    </TelegramAppContext.Provider>
  );
}

export function useTelegramApp() {
  return useContext(TelegramAppContext);
}
