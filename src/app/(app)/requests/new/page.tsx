import { RequestComposerShell } from "@/features/requests/components/request-composer-shell";
import type { RequestScenario } from "@/features/requests/lib/request-schema";
import { requirePageUser } from "@/server/services/auth/current-user";
import { requestService } from "@/server/services/requests/request-service";

type NewRequestPageProps = {
  searchParams?: Promise<{
    scenario?: string | string[];
  }>;
};

function resolveScenarioParam(value: string | string[] | undefined): RequestScenario | undefined {
  const rawScenario = Array.isArray(value) ? value[0] : value;

  if (rawScenario === "CASE" || rawScenario === "PROJECT" || rawScenario === "STUDY") {
    return rawScenario;
  }

  return undefined;
}

export default async function NewRequestPage({ searchParams }: NewRequestPageProps) {
  const user = await requirePageUser();
  const resolvedSearchParams = await searchParams;
  const composerData = await requestService.getComposerData(user.id);

  return (
    <RequestComposerShell
      initialScenario={resolveScenarioParam(resolvedSearchParams?.scenario)}
      initialRequests={composerData.requests}
      studyDefaults={composerData.studyDefaults}
      subjects={composerData.subjects}
    />
  );
}
