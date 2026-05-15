import { ConnectionsScreenShell } from "@/features/connections/components/connections-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { connectionService } from "@/server/services/connections/connection-service";

export default async function ConnectionsPage() {
  const user = await requirePageUser();
  const initialData = await connectionService.listForUser(user.id);

  return <ConnectionsScreenShell initialData={initialData} key={user.id} />;
}
