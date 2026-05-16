"use client";

import { usePathname } from "next/navigation";

import { AperlyLogo } from "@/components/brand/aperly-logo";

const sectionTitles: { prefix: string; label: string }[] = [
  { prefix: "/opportunities", label: "Возможности" },
  { prefix: "/create", label: "Создать" },
  { prefix: "/connections", label: "Связи" },
  { prefix: "/profile", label: "Профиль" }
];

function getSectionLabel(pathname: string): string | null {
  for (const { prefix, label } of sectionTitles) {
    if (pathname === prefix) {
      return label;
    }
  }

  if (pathname.startsWith("/connections/")) {
    return "Связь";
  }

  if (pathname.startsWith("/opportunities/")) {
    return "Возможность";
  }

  if (pathname.startsWith("/requests/")) {
    return "Создать";
  }

  if (pathname.startsWith("/profile/")) {
    return "Профиль";
  }

  return null;
}

export function ShellHeader() {
  const pathname = usePathname();
  const sectionLabel = getSectionLabel(pathname);

  return (
    <header className="shell-header">
      <div className="shell-brand-row" aria-label="Aperly">
        <AperlyLogo size="md" />
        {sectionLabel ? (
          <>
            <span className="shell-header-divider" aria-hidden="true" />
            <span className="shell-section-label">{sectionLabel}</span>
          </>
        ) : null}
      </div>
    </header>
  );
}
