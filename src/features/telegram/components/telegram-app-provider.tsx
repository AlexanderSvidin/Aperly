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
  buildTelegramRuntimeSession,
  getTelegramWebApp
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

    const webApp = getTelegramWebApp();

    if (webApp) {
      webApp.ready();
      webApp.expand();
      applyTelegramTheme(webApp);

      scheduleSessionUpdate(buildTelegramRuntimeSession(webApp));
      return () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    if (clientEnv.NEXT_PUBLIC_ENABLE_DEV_TELEGRAM_FALLBACK) {
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
