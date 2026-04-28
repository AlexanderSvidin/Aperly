"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error.message, error.digest);
  }, [error]);

  return (
    <section className="screen-stack">
      <div className="surface-card screen-stack">
        <div className="card-header">
          <p className="card-eyebrow">Ошибка</p>
          <h2 className="card-title">Что-то пошло не так</h2>
        </div>
        <p className="card-body-copy">
          Страница временно недоступна. Обычно это решается простым обновлением.
        </p>
        {error.digest ? (
          <p className="helper-text">Код: {error.digest}</p>
        ) : null}
        <Button fullWidth onClick={reset} type="button" variant="primary">
          Обновить страницу
        </Button>
      </div>
    </section>
  );
}
