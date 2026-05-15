"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { InviteConfirmSheet } from "@/features/matching/components/invite-confirm-sheet";

type PreviewInviteActionProps = {
  invite: {
    matchId: string;
    candidateName: string;
    requestTitle: string;
    requestType: string;
    role: string | null;
    format: string | null;
  };
};

export function PreviewInviteAction({ invite }: PreviewInviteActionProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSent, setIsSent] = useState(false);

  function handleSuccess() {
    setIsSent(true);
    router.refresh();
  }

  return (
    <>
      {isSent ? (
        <Button disabled fullWidth variant="secondary">
          Ждём ответ
        </Button>
      ) : (
        <Button fullWidth onClick={() => setIsOpen(true)}>
          Пригласить
        </Button>
      )}
      <InviteConfirmSheet
        invite={invite}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
