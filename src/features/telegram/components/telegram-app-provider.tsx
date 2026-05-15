"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";

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

// ------------------------------------------------------------------
// Context shape — carries both the resolved session and whether the
// SDK detection is still in progress.  Components that render a
// button or interactive element should wait for isDetecting = false
// before showing themselves; otherwise the user may tap during the
// window where Telegram has not yet received WebApp.ready() and the
// WebView's built-in loading overlay is still blocking all touches.
// ------------------------------------------------------------------
type TelegramAppContextValue = {
  session: TelegramRuntimeSession;
  /** true while we are polling for window.Telegram.WebApp */
  isDetecting: boolean;
};

const TelegramAppContext = createContext<TelegramAppContextValue>({
  session: defaultSession,
  isDetecting: true // matches server-render initial state — no hydration mismatch
});

const TELEGRAM_SDK_WAIT_MS = 1500;
const TELEGRAM_SDK_POLL_MS = 50;

type MeResponse =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      user: {
        telegramId: string;
      };
    };

async function clearServerSessionAndReload() {
  await fetch("/api/auth/logout", {
    method: "POST",
    cache: "no-store"
  }).catch(() => null);

  window.location.replace("/");
}

export function TelegramAppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<TelegramRuntimeSession>(defaultSession);
  // Starts true on both server and client so the first render is identical
  // (no hydration mismatch).  Becomes false once detection resolves.
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    let sessionUpdateId: number | null = null;
    let fallbackTimeoutId: number | null = null;
    let intervalId: number | null = null;

    /** Commit the resolved session and mark detection as done. */
    const scheduleSessionUpdate = (nextSession: TelegramRuntimeSession) => {
      sessionUpdateId = window.setTimeout(() => {
        setSession(nextSession);
        setIsDetecting(false);
      }, 0);
    };

    const cleanupTimers = () => {
      if (sessionUpdateId !== null) window.clearTimeout(sessionUpdateId);
      if (fallbackTimeoutId !== null) window.clearTimeout(fallbackTimeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };

    const hydrateFromTelegram = () => {
      if (typeof window === "undefined" || !window.Telegram?.WebApp) {
        return false;
      }

      const webApp = window.Telegram.WebApp!;

      // Signal to Telegram that the app is ready — removes the white loading
      // overlay and enables touch events inside the WebView.
      webApp.ready();
      webApp.expand();
      applyTelegramTheme(webApp);

      scheduleSessionUpdate(buildTelegramRuntimeSession(webApp));
      return true;
    };

    // Fast path: SDK already present (script was truly synchronous / cached)
    if (hydrateFromTelegram()) {
      return cleanupTimers;
    }

    // Slow path: script is still downloading — poll until it appears
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

    // Hard deadline: stop polling and resolve to fallback
    fallbackTimeoutId = window.setTimeout(() => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }

      // One last attempt before giving up
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

      // Not in Telegram — resolve with the default (browser) session
      scheduleSessionUpdate(defaultSession);
    }, TELEGRAM_SDK_WAIT_MS);

    return cleanupTimers;
  }, []);

  useEffect(() => {
    if (session.source !== "telegram" || !session.user) {
      return;
    }

    let isCancelled = false;

    async function verifyTelegramUserMatchesAppSession() {
      const liveWebApp = window.Telegram?.WebApp;
      const liveSession = liveWebApp
        ? buildTelegramRuntimeSession(liveWebApp)
        : session;
      const liveTelegramId = liveSession.user?.id
        ? String(liveSession.user.id)
        : null;

      if (!liveTelegramId) {
        return;
      }

      if (liveSession.user?.id !== session.user?.id) {
        setSession(liveSession);
      }

      const response = await fetch("/api/me", {
        cache: "no-store"
      });

      if (!response.ok || isCancelled) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | MeResponse
        | null;

      if (
        payload?.authenticated &&
        payload.user.telegramId !== liveTelegramId
      ) {
        await clearServerSessionAndReload();
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void verifyTelegramUserMatchesAppSession().then(() => router.refresh());
      }
    };

    void verifyTelegramUserMatchesAppSession();
    const handleFocus = () => {
      void verifyTelegramUserMatchesAppSession().then(() => router.refresh());
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, session]);

  return (
    <TelegramAppContext.Provider value={{ session, isDetecting }}>
      {children}
    </TelegramAppContext.Provider>
  );
}

/** Returns the resolved Telegram session (source, initData, user, …). */
export function useTelegramApp() {
  return useContext(TelegramAppContext).session;
}

/**
 * Returns true while the provider is still polling for window.Telegram.WebApp.
 * UI that depends on Telegram availability should render a skeleton/spinner
 * until this resolves to false.
 */
export function useTelegramDetecting() {
  return useContext(TelegramAppContext).isDetecting;
}
