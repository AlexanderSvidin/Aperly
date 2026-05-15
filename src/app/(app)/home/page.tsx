import { redirect } from "next/navigation";

type HomePageProps = {
  searchParams?: Promise<{
    scenario?: string | string[];
    welcome?: string | string[];
  }>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  const scenario = readSingle(resolvedSearchParams?.scenario);
  const welcome = readSingle(resolvedSearchParams?.welcome);

  if (scenario) {
    params.set("scenario", scenario);
  }

  if (welcome) {
    params.set("welcome", welcome);
  }

  const query = params.toString();

  redirect(query ? `/opportunities?${query}` : "/opportunities");
}
