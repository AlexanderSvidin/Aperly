"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store"
      });

      window.location.replace("/");
    });
  }

  return (
    <Button fullWidth variant="ghost" disabled={isPending} onClick={handleLogout}>
      {isPending ? "Выходим..." : "Очистить сессию"}
    </Button>
  );
}
