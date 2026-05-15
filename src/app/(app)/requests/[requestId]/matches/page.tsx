import { MatchesScreenShell } from "@/features/matching/components/matches-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { matchingService } from "@/server/services/matching/matching-service";

type RequestMatchesPageProps = {
  params: Promise<{
    requestId: string;
  }>;
  searchParams?: Promise<{
    created?: string | string[];
    matchId?: string | string[];
  }>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RequestMatchesPage({
  params,
  searchParams
}: RequestMatchesPageProps) {
  const user = await requirePageUser();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const initialData = await matchingService.getScreenDataForUser(user.id, {
    requestId: resolvedParams.requestId,
    matchId: readSingleSearchParam(resolvedSearchParams?.matchId)
  });

  return (
    <MatchesScreenShell
      creationNotice={readSingleSearchParam(resolvedSearchParams?.created) === "1"}
      initialData={initialData}
      key={user.id}
    />
  );
}
