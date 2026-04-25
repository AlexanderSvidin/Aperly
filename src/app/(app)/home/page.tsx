import { HomeScreenShell } from "@/features/home/components/home-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { homeService } from "@/server/services/home/home-service";

type HomePageProps = {
  searchParams?: Promise<{
    welcome?: string | string[];
  }>;
};

function resolveWelcomeFlag(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue === "1" || rawValue === "true";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await requirePageUser();
  const resolvedSearchParams = await searchParams;
  const initialData = await homeService.getDashboardForUser(user.id);

  return (
    <HomeScreenShell
      initialData={initialData}
      showWelcomeSelector={resolveWelcomeFlag(resolvedSearchParams?.welcome)}
    />
  );
}
