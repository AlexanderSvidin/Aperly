import { redirect } from "next/navigation";

type NewRequestPageProps = {
  searchParams?: Promise<{
    scenario?: string | string[];
  }>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewRequestPage({
  searchParams
}: NewRequestPageProps) {
  const resolvedSearchParams = await searchParams;
  const scenario = readSingleSearchParam(resolvedSearchParams?.scenario);

  redirect(scenario ? `/create?scenario=${scenario}` : "/create");
}
