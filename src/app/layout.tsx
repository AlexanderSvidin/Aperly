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
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/*
          Telegram WebApp SDK must execute synchronously — before React hydrates —
          so that window.Telegram.WebApp is available on the very first render and
          WebApp.ready() can be called immediately.

          A raw <script> tag without async/defer is a blocking parser script:
          the browser downloads and runs it before advancing past this point in
          the HTML, which guarantees the SDK is present when React mounts.

          next/script with strategy="beforeInteractive" was replaced because in
          Next.js App Router it can be converted to a non-blocking script in some
          build configurations, causing a race condition that leaves a white screen
          and unresponsive button until the SDK eventually loads.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body>
        <TelegramAppProvider>{children}</TelegramAppProvider>
      </body>
    </html>
  );
}
