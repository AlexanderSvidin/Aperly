import { RequestComposerShell } from "@/features/requests/components/request-composer-shell";
import type { RequestScenario } from "@/features/requests/lib/request-schema";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/services/auth/current-user";
import { requestService } from "@/server/services/requests/request-service";

type CreatePageProps = {
  searchParams?: Promise<{
    scenario?: string | string[];
  }>;
};

function resolveScenarioParam(
  value: string | string[] | undefined
): RequestScenario | undefined {
  const rawScenario = Array.isArray(value) ? value[0] : value;

  if (rawScenario === "ACTIVITY") {
    redirect("/create/activity");
  }

  if (rawScenario === "CASE" || rawScenario === "PROJECT" || rawScenario === "STUDY") {
    return rawScenario;
  }

  return undefined;
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const user = await requirePageUser();
  const resolvedSearchParams = await searchParams;
  const composerData = await requestService.getComposerData(user.id);

  return (
    <RequestComposerShell
      initialScenario={resolveScenarioParam(resolvedSearchParams?.scenario)}
      initialRequests={composerData.requests}
      key={user.id}
      studyDefaults={composerData.studyDefaults}
      subjects={composerData.subjects}
    />
  );
}
