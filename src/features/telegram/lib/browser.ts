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

  const root = document.documentElement;
  const themeParams = webApp.themeParams ?? {};

  if (themeParams.bg_color) {
    root.style.setProperty("--tg-bg-color", themeParams.bg_color);
  }

  if (themeParams.secondary_bg_color) {
    root.style.setProperty(
      "--tg-secondary-bg-color",
      themeParams.secondary_bg_color
    );
  }

  if (themeParams.text_color) {
    root.style.setProperty("--tg-text-color", themeParams.text_color);
  }

  if (themeParams.hint_color) {
    root.style.setProperty("--tg-hint-color", themeParams.hint_color);
  }
}
