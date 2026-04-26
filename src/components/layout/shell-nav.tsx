"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const navItems: { href: Route; label: string; icon: string; primary?: boolean }[] = [
  { href: "/home", label: "Главная", icon: "⌂" },
  { href: "/matches", label: "Матчи", icon: "◎" },
  { href: "/requests/new", label: "Создать", icon: "+", primary: true },
  { href: "/chats", label: "Чаты", icon: "◌" },
  { href: "/profile", label: "Профиль", icon: "○" }
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
            data-primary={item.primary === true}
            href={item.href}
          >
            <span className="shell-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="shell-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
