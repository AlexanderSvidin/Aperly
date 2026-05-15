import { ProfileRequestsScreen } from "@/features/requests/components/profile-requests-screen";
import { requirePageUser } from "@/server/services/auth/current-user";
import { requestService } from "@/server/services/requests/request-service";

export default async function ProfileRequestsPage() {
  const user = await requirePageUser();
  const requests = await requestService.listForUser(user.id);

  return <ProfileRequestsScreen initialRequests={requests} />;
}
