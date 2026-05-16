type AperlyLogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  withWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { mark: 24, font: "1.05rem" },
  md: { mark: 32, font: "1.35rem" },
  lg: { mark: 44, font: "1.7rem" },
  xl: { mark: 64, font: "2.4rem" }
};

export function AperlyLogo({
  size = "md",
  withWordmark = true,
  className
}: AperlyLogoProps) {
  const { mark, font } = sizeMap[size];

  return (
    <span
      className={["aperly-logo", className].filter(Boolean).join(" ")}
      aria-label="Aperly"
      role="img"
    >
      <AperlyMark size={mark} />
      {withWordmark ? (
        <span
          className="aperly-logo-wordmark"
          style={{ fontSize: font }}
          aria-hidden="true"
        >
          Aperly
        </span>
      ) : null}
    </span>
  );
}

function AperlyMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="aperly-mark-grad" x1="6" y1="8" x2="58" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7B5BFB" />
          <stop offset="100%" stopColor="#5B3FE0" />
        </linearGradient>
      </defs>
      <path
        d="M8 54 L26 12 C28 8 32 8 34 12 L42 30"
        stroke="url(#aperly-mark-grad)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 38 L40 38"
        stroke="url(#aperly-mark-grad)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="52" cy="52" r="5" fill="url(#aperly-mark-grad)" />
    </svg>
  );
}
