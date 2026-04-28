"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

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
        <div className="card-header">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="card-title">Не удалось загрузить данные</h1>
        </div>
        <p className="card-body-copy">
          Профиль временно недоступен — скорее всего, это сбой на стороне
          сервера. Попробуйте обновить страницу.
        </p>
        {error.digest ? (
          <p className="helper-text">Код ошибки: {error.digest}</p>
        ) : null}
        <Button fullWidth onClick={reset} type="button" variant="primary">
          Попробовать снова
        </Button>
      </div>
    </section>
  );
}
