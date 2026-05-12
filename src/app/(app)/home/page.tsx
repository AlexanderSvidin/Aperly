import { HomeScreenShell } from "@/features/home/components/home-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { homeService } from "@/server/services/home/home-service";

type HomePageProps = {
  searchParams?: Promise<{
    scenario?: string | string[];
    welcome?: string | string[];
  }>;
};

function resolveWelcomeFlag(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue === "1" || rawValue === "true";
}

function resolveScenarioFilter(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === "CASE" || rawValue === "PROJECT" || rawValue === "STUDY") {
    return rawValue;
  }

  return "ALL";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await requirePageUser();
  const resolvedSearchParams = await searchParams;
  const initialData = await homeService.getFeedForUser(user.id, {
    scenario: resolveScenarioFilter(resolvedSearchParams?.scenario)
  });

  return (
    <HomeScreenShell
      initialData={initialData}
      key={user.id}
      showWelcomeSelector={resolveWelcomeFlag(resolvedSearchParams?.welcome)}
      viewerName={user.profile?.fullName ?? user.firstName}
    />
  );
}
