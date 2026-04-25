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

export function TelegramAppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TelegramRuntimeSession>(defaultSession);

  useEffect(() => {
    let timeoutId: number | null = null;
    const scheduleSessionUpdate = (nextSession: TelegramRuntimeSession) => {
      timeoutId = window.setTimeout(() => {
        setSession(nextSession);
      }, 0);
    };

    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const Telegram = window.Telegram;
      const webApp = Telegram.WebApp!;

      console.log("Telegram WebApp detected", Telegram.WebApp!.initData);
      console.log(
        "Telegram WebApp initDataUnsafe",
        Telegram.WebApp!.initDataUnsafe
      );

      Telegram.WebApp!.ready();
      Telegram.WebApp!.expand();
      applyTelegramTheme(webApp);

      scheduleSessionUpdate(buildTelegramRuntimeSession(webApp));
      return () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    if (
      process.env.NODE_ENV !== "production" &&
      clientEnv.NEXT_PUBLIC_ENABLE_DEV_TELEGRAM_FALLBACK
    ) {
      scheduleSessionUpdate(createDevTelegramSession());
      return () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    scheduleSessionUpdate(defaultSession);
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
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
