import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TelegramAppProvider } from "@/features/telegram/components/telegram-app-provider";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Aperly",
  description:
    "Telegram Mini App MVP for structured student matching at HSE Perm."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <TelegramAppProvider>{children}</TelegramAppProvider>
      </body>
    </html>
  );
}
