import { notFound } from "next/navigation";

import { IncomingInteractionShell } from "@/features/connections/components/incoming-interaction-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import {
  ConnectionDomainError,
  connectionService
} from "@/server/services/connections/connection-service";

type IncomingResponsePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function IncomingResponsePage({
  params
}: IncomingResponsePageProps) {
  const user = await requirePageUser();
  const resolvedParams = await params;

  try {
    const interaction = await connectionService.getInteractionForUser(
      user.id,
      resolvedParams.id
    );

    if (interaction.type !== "RESPONSE") {
      notFound();
    }

    return <IncomingInteractionShell interaction={interaction} key={user.id} />;
  } catch (error) {
    if (error instanceof ConnectionDomainError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
