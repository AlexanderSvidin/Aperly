import type { ComponentType } from "react";

type ScenarioKey = "STUDY" | "CASE" | "PROJECT" | "ACTIVITY";

type ScenarioIconProps = {
  scenario: ScenarioKey;
  size?: number;
};

function Cap({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 9l10-5 10 5-10 5L2 9z" />
      <path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4" />
      <line x1="22" y1="9" x2="22" y2="15" />
    </svg>
  );
}

function People({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.5 14.2c2.8.5 5 2.9 5.5 5.8" />
    </svg>
  );
}

function Rocket({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function Heart({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 8.5a4.5 4.5 0 0 0-7.5-3.5l-1 .9-1-.9a4.5 4.5 0 0 0-7.5 3.5c0 5 8.5 11 8.5 11s8.5-6 8.5-11z" />
    </svg>
  );
}

const iconMap: Record<ScenarioKey, ComponentType<{ size?: number }>> = {
  STUDY: Cap,
  CASE: People,
  PROJECT: Rocket,
  ACTIVITY: Heart
};

export function ScenarioIcon({ scenario, size = 22 }: ScenarioIconProps) {
  const Icon = iconMap[scenario];
  return <Icon size={size} />;
}

export function ScenarioIconBadge({
  scenario,
  variant = "tile"
}: {
  scenario: ScenarioKey;
  variant?: "tile" | "inline";
}) {
  return (
    <span
      className={
        variant === "tile" ? "scenario-icon-tile" : "scenario-icon-inline"
      }
      aria-hidden="true"
    >
      <ScenarioIcon scenario={scenario} size={variant === "tile" ? 26 : 16} />
    </span>
  );
}
