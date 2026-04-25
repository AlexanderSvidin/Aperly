export type TelegramRuntimeSource = "telegram" | "dev" | "browser";

export type TelegramRuntimeUser = {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
};

export type TelegramRuntimeSession = {
  source: TelegramRuntimeSource;
  initData: string | null;
  user: TelegramRuntimeUser | null;
  platform: string | null;
  colorScheme: "light" | "dark";
  isAvailable: boolean;
};
