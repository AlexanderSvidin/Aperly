import type { HTMLAttributes, ReactNode, Ref } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

export function Card({ title, eyebrow, children, className, ...props }: CardProps) {
  const composedClassName = ["surface-card", className ?? ""].join(" ").trim();

  return (
    <div className={composedClassName} {...props}>
      {(eyebrow || title) && (
        <div className="card-header">
          {eyebrow ? <p className="card-eyebrow">{eyebrow}</p> : null}
          {title ? <h2 className="card-title">{title}</h2> : null}
        </div>
      )}
      {children}
    </div>
  );
}
