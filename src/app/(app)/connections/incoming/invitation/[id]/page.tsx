import { notFound } from "next/navigation";

import { IncomingInteractionShell } from "@/features/connections/components/incoming-interaction-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import {
  ConnectionDomainError,
  connectionService
} from "@/server/services/connections/connection-service";

type IncomingInvitationPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function IncomingInvitationPage({
  params
}: IncomingInvitationPageProps) {
  const user = await requirePageUser();
  const resolvedParams = await params;
  let interaction;

  try {
    interaction = await connectionService.getInteractionForUser(
      user.id,
      resolvedParams.id
    );

    if (interaction.type !== "INVITATION") {
      notFound();
    }
  } catch (error) {
    if (error instanceof ConnectionDomainError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return <IncomingInteractionShell interaction={interaction} key={user.id} />;
}
