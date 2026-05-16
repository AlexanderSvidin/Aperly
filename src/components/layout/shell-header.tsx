"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

const sectionTitles: { prefix: string; label: string }[] = [
  { prefix: "/opportunities", label: "Возможности" },
  { prefix: "/create", label: "Создать" },
  { prefix: "/connections", label: "Связи" },
  { prefix: "/profile", label: "Профиль" }
];

function getSectionLabel(pathname: string): string | null {
  for (const { prefix, label } of sectionTitles) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return label;
    }
  }

  return null;
}

export function ShellHeader() {
  const pathname = usePathname();
  const sectionLabel = getSectionLabel(pathname);

  return (
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
        {sectionLabel ? (
          <span className="shell-section-label" aria-hidden="true">
            {" | "}{sectionLabel}
          </span>
        ) : null}
      </div>
    </header>
  );
}
