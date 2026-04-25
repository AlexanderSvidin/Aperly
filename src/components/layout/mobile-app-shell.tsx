import type { ReactNode } from "react";

import { ShellNav } from "@/components/layout/shell-nav";
import { TelegramStatusChip } from "@/features/telegram/components/telegram-status-chip";

export function MobileAppShell({
  children,
  viewerName
}: {
  children: ReactNode;
  viewerName?: string;
}) {
  return (
    <div className="mobile-shell">
      <header className="shell-header">
        <div>
          <p className="shell-kicker">Aperly</p>
          <h1 className="shell-heading">
            {viewerName ? `Привет, ${viewerName}` : "Подбор под конкретную цель"}
          </h1>
          <p className="shell-subheading">
            Структурированный поиск для кейсов, проектов и совместной учёбы.
          </p>
        </div>
        <TelegramStatusChip />
      </header>

      <main className="shell-content">{children}</main>
      <ShellNav />
    </div>
  );
}
