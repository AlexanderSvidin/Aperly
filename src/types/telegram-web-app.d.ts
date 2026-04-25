declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }

  interface TelegramWebApp {
    initData: string;
    initDataUnsafe: {
      user?: TelegramWebAppUser;
      query_id?: string;
      auth_date?: string;
      hash?: string;
    };
    colorScheme: "light" | "dark";
    platform: string;
    themeParams: Partial<Record<TelegramThemeParamKey, string>>;
    viewportHeight?: number;
    viewportStableHeight?: number;
    isExpanded?: boolean;
    ready(): void;
    expand(): void;
    setHeaderColor?(color: string): void;
    setBackgroundColor?(color: string): void;
  }

  interface TelegramWebAppUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  }

  type TelegramThemeParamKey =
    | "bg_color"
    | "secondary_bg_color"
    | "text_color"
    | "hint_color"
    | "link_color"
    | "button_color"
    | "button_text_color"
    | "header_bg_color"
    | "section_bg_color"
    | "accent_text_color";
}

export {};
