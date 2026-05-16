import type { ReactNode } from "react";

import { ShellHeader } from "@/components/layout/shell-header";
import { ShellNav } from "@/components/layout/shell-nav";

export function MobileAppShell({
  children
}: {
  children: ReactNode;
  viewerName?: string;
}) {
  return (
    <div className="mobile-shell">
      <ShellHeader />
      <main className="shell-content">{children}</main>
      <ShellNav />
    </div>
  );
}
