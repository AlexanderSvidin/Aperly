"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", {
        method: "POST"
      });

      router.push("/");
      router.refresh();
    });
  }

  return (
    <Button fullWidth variant="ghost" disabled={isPending} onClick={handleLogout}>
      {isPending ? "Выходим..." : "Очистить сессию"}
    </Button>
  );
}
