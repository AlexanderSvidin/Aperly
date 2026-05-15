import { ArchiveScreen } from "@/features/archive/components/archive-screen";
import { requirePageUser } from "@/server/services/auth/current-user";
import { archiveService } from "@/server/services/archive/archive-service";

export default async function ProfileArchivePage() {
  const user = await requirePageUser();
  const archive = await archiveService.getForUser(user.id);

  return <ArchiveScreen initialData={archive} />;
}
