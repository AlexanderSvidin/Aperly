import { redirect } from "next/navigation";

type MatchesPageProps = {
  searchParams: Promise<{
    created?: string | string[];
    requestId?: string | string[];
    matchId?: string | string[];
  }>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestId = readSingleSearchParam(resolvedSearchParams.requestId);
  const matchId = readSingleSearchParam(resolvedSearchParams.matchId);
  const created = readSingleSearchParam(resolvedSearchParams.created);
  const nextSearchParams = new URLSearchParams();

  if (matchId) {
    nextSearchParams.set("matchId", matchId);
  }

  if (created) {
    nextSearchParams.set("created", created);
  }

  if (requestId) {
    const queryString = nextSearchParams.toString();

    redirect(
      queryString
        ? `/requests/${requestId}/matches?${queryString}`
        : `/requests/${requestId}/matches`
    );
  }

  redirect("/connections");
}
