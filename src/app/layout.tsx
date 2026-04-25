import type { Metadata } from "next";
import Script from "next/script";
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
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <TelegramAppProvider>{children}</TelegramAppProvider>
      </body>
    </html>
  );
}
