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
      <path d="M4 14l3 3M14 4c4 0 6 2 6 6l-7 7-5-5 6-8z" />
      <circle cx="15" cy="9" r="1.4" />
      <path d="M5 19c-1 0-2 1-2 2 1 0 2-1 2-2z" />
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
