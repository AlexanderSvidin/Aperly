import { notFound } from "next/navigation";

import { ConnectionDetailShell } from "@/features/connections/components/connection-detail-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import {
  ConnectionDomainError,
  connectionService
} from "@/server/services/connections/connection-service";

type ConnectionDetailPageProps = {
  params: Promise<{
    connectionId: string;
  }>;
};

export default async function ConnectionDetailPage({
  params
}: ConnectionDetailPageProps) {
  const user = await requirePageUser();
  const resolvedParams = await params;
  let connection;

  try {
    connection = await connectionService.getConnectionForUser(
      user.id,
      resolvedParams.connectionId
    );
  } catch (error) {
    if (error instanceof ConnectionDomainError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return <ConnectionDetailShell connection={connection} key={user.id} />;
}
