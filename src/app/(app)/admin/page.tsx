import { AdminScreenShell } from "@/features/admin/components/admin-screen-shell";
import { requireAdminPageUser } from "@/server/services/auth/current-user";
import { moderationService } from "@/server/services/moderation/moderation-service";

export default async function AdminPage() {
  const admin = await requireAdminPageUser();
  const initialData = await moderationService.getDashboard(admin.id);

  return <AdminScreenShell initialData={initialData} />;
}
