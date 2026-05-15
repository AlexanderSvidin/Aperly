import { notFound } from "next/navigation";

import { OpportunityDetailShell } from "@/features/opportunities/components/opportunity-detail-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { opportunityService } from "@/server/services/opportunities/opportunity-service";

type OpportunityDetailPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function OpportunityDetailPage({
  params
}: OpportunityDetailPageProps) {
  const user = await requirePageUser();
  const resolvedParams = await params;
  const opportunity = await opportunityService.getDetailForUser(
    user.id,
    resolvedParams.requestId
  );

  if (!opportunity) {
    notFound();
  }

  return <OpportunityDetailShell opportunity={opportunity} key={user.id} />;
}
