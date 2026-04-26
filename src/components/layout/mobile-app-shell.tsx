import type { ReactNode } from "react";

import { ShellNav } from "@/components/layout/shell-nav";

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
        <div className="shell-brand-row" aria-label="Aperly">
          <span className="shell-logo-mark">A.</span>
          <span className="shell-brand-name">Aperly</span>
        </div>
        <div className="shell-header-copy">
          <h1 className="shell-heading">
            {viewerName ? `Привет, ${viewerName}` : "Найдём людей под цель"}
          </h1>
          <p className="shell-subheading">
            Кейс, проект или StudyBuddy: сначала понятный запрос, затем подходящие люди, чат и контакты только по взаимному согласию.
          </p>
        </div>
      </header>

      <main className="shell-content">{children}</main>
      <ShellNav />
    </div>
  );
}
