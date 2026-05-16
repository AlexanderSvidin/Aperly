"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import {
  NavIconConnections,
  NavIconCreate,
  NavIconOpportunities,
  NavIconProfile
} from "@/components/layout/nav-icons";

type IconComponent = ComponentType<{ size?: number }>;

const navItems: {
  href: Route;
  label: string;
  Icon: IconComponent;
  primary?: boolean;
}[] = [
  { href: "/opportunities", label: "Возможности", Icon: NavIconOpportunities },
  { href: "/create", label: "Создать", Icon: NavIconCreate, primary: true },
  { href: "/connections", label: "Связи", Icon: NavIconConnections },
  { href: "/profile", label: "Профиль", Icon: NavIconProfile }
];

export function ShellNav() {
  const pathname = usePathname();

  return (
    <nav className="shell-nav" aria-label="Основная навигация">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.Icon;

        return (
          <Link
            key={item.href}
            className="shell-nav-link"
            data-active={isActive}
            data-primary={item.primary === true}
            href={item.href}
          >
            <span className="shell-nav-icon" aria-hidden="true">
              <Icon size={item.primary ? 28 : 24} />
            </span>
            <span className="shell-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
