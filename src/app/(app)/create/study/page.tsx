import { requirePageUser } from "@/server/services/auth/current-user";
import { requestService } from "@/server/services/requests/request-service";
import { RequestComposerShell } from "@/features/requests/components/request-composer-shell";

export default async function CreateStudyPage() {
  const user = await requirePageUser();
  const composerData = await requestService.getComposerData(user.id);

  return (
    <RequestComposerShell
      initialRequests={composerData.requests}
      key={user.id}
      mode="create"
      singleScenario="STUDY"
      studyDefaults={composerData.studyDefaults}
      subjects={composerData.subjects}
    />
  );
}
