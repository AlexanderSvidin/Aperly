import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonClassOptions = {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export function buttonClassName({
  variant = "primary",
  fullWidth = false
}: ButtonClassOptions = {}) {
  const widthClass = fullWidth ? "button-full" : "";

  if (variant === "secondary") {
    return `button button-secondary ${widthClass}`.trim();
  }

  if (variant === "ghost") {
    return `button button-ghost ${widthClass}`.trim();
  }

  return `button button-primary ${widthClass}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonClassOptions & {
    isLoading?: boolean;
    loadingLabel?: string;
  };

export function Button({
  children,
  className,
  disabled,
  isLoading = false,
  loadingLabel,
  variant,
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  const composedClassName = [
    buttonClassName({ variant, fullWidth }),
    className ?? ""
  ]
    .join(" ")
    .trim();

  return (
    <button
      aria-busy={isLoading || undefined}
      className={composedClassName}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? (
        <>
          <span aria-hidden="true" className="button-spinner" />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
