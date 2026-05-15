"use client";

import { useEffect } from "react";

import { EmptyState } from "@/components/ui/empty-state";

export default function ProfileError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ProfileError]", error.message, error.digest);
  }, [error]);

  return (
    <section className="screen-stack">
      <div className="surface-card screen-stack">
        <EmptyState
          actionLabel="Повторить"
          onAction={reset}
          title="Не удалось загрузить данные"
          text="Проверьте интернет и попробуйте снова."
        />
        {error.digest ? (
          <p className="helper-text">Код ошибки: {error.digest}</p>
        ) : null}
      </div>
    </section>
  );
}
