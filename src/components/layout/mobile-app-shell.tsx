import type { ReactNode } from "react";

import Image from "next/image";

import { ShellNav } from "@/components/layout/shell-nav";

export function MobileAppShell({
  children
}: {
  children: ReactNode;
  viewerName?: string;
}) {
  return (
    <div className="mobile-shell">
      <header className="shell-header">
        <div className="shell-brand-row" aria-label="Aperly">
          <Image
            alt="Aperly"
            className="shell-logo-image"
            height={36}
            priority
            src="/aperly-logo.png"
            width={128}
          />
        </div>
      </header>

      <main className="shell-content">{children}</main>
      <ShellNav />
    </div>
  );
}
