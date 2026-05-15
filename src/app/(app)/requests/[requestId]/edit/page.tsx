import { notFound } from "next/navigation";

import { RequestComposerShell } from "@/features/requests/components/request-composer-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { requestService } from "@/server/services/requests/request-service";

type RequestEditPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function RequestEditPage({ params }: RequestEditPageProps) {
  const user = await requirePageUser();
  const { requestId } = await params;
  const data = await requestService.getComposerData(user.id);
  const request = data.requests.find((item) => item.id === requestId);

  if (!request || request.status !== "ACTIVE") {
    notFound();
  }

  return (
    <RequestComposerShell
      initialRequests={data.requests}
      initialScenario={request.scenario === "ACTIVITY" ? undefined : request.scenario}
      key={user.id}
      studyDefaults={data.studyDefaults}
      subjects={data.subjects}
    />
  );
}
