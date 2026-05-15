"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import type { Route } from "next";

import { Button, buttonClassName } from "@/components/ui/button";

type EmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  icon?: ReactNode;
  onAction?: () => void;
  text: string;
  title: string;
};

export function EmptyState({
  actionHref,
  actionLabel,
  icon,
  onAction,
  text,
  title
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="screen-copy">
        <h2 className="card-title">{title}</h2>
        <p className="card-body-copy">{text}</p>
      </div>
      {actionLabel && actionHref ? (
        <Link
          className={buttonClassName({ fullWidth: true })}
          href={actionHref as Route}
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <Button fullWidth onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
