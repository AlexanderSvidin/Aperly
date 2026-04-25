import { MatchesScreenShell } from "@/features/matching/components/matches-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { matchingService } from "@/server/services/matching/matching-service";

type MatchesPageProps = {
  searchParams: Promise<{
    requestId?: string | string[];
    matchId?: string | string[];
  }>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const user = await requirePageUser();
  const resolvedSearchParams = await searchParams;
  const initialData = await matchingService.getScreenDataForUser(user.id, {
    requestId: readSingleSearchParam(resolvedSearchParams.requestId),
    matchId: readSingleSearchParam(resolvedSearchParams.matchId)
  });

  return <MatchesScreenShell initialData={initialData} />;
}
