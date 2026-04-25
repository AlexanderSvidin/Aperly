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

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonClassOptions;

export function Button({
  className,
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

  return <button className={composedClassName} type={type} {...props} />;
}
