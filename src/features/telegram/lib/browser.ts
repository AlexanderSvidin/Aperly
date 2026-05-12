import type {
  TelegramRuntimeSession,
  TelegramRuntimeUser
} from "@/features/telegram/lib/types";

function mapTelegramUser(user?: TelegramWebAppUser): TelegramRuntimeUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username
  };
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
}

export function buildTelegramRuntimeSession(
  webApp: TelegramWebApp
): TelegramRuntimeSession {
  return {
    source: "telegram",
    initData: webApp.initData || null,
    user: mapTelegramUser(webApp.initDataUnsafe?.user),
    platform: webApp.platform ?? null,
    colorScheme: webApp.colorScheme ?? "light",
    isAvailable: true
  };
}

export function applyTelegramTheme(webApp: TelegramWebApp): void {
  if (typeof document === "undefined") {
    return;
  }

  // Match the Telegram native header / bottom bar to the app background so
  // they don't appear as a white block above the page content.
  try {
    webApp.setHeaderColor?.("#f7f4ed");
    webApp.setBackgroundColor?.("#f7f4ed");
  } catch {
    // setHeaderColor / setBackgroundColor may be absent in older clients — ignore
  }

  const themeParams = webApp.themeParams ?? {};

  // The app uses a fixed light theme with hardcoded white/beige surfaces.
  // Overriding any colour variables from Telegram's dark theme would produce
  // unreadable combinations (e.g. dark input backgrounds, white text on white
  // cards).  All colours are set to WCAG-AA-compliant values in globals.css
  // and are NOT overridden here.
  void themeParams; // suppress unused-variable lint if tree-shaken
}
