"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const navItems: { href: Route; label: string }[] = [
  { href: "/home", label: "Главная" },
  { href: "/matches", label: "Матчи" },
  { href: "/requests/new", label: "Создать" },
  { href: "/chats", label: "Чаты" },
  { href: "/profile", label: "Профиль" }
];

export function ShellNav() {
  const pathname = usePathname();

  return (
    <nav className="shell-nav" aria-label="Основная навигация">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            className="shell-nav-link"
            data-active={isActive}
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
