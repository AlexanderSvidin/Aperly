import { redirect } from "next/navigation";

import { MinimalOnboardingForm } from "@/features/profile/components/minimal-onboarding-form";
import { requirePageUser } from "@/server/services/auth/current-user";

export default async function OnboardingPage() {
  const user = await requirePageUser({
    allowIncompleteOnboarding: true
  });

  if (user.onboardingCompleted) {
    redirect("/opportunities");
  }

  const telegramIdentity = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");
  const defaultFullName = user.deletedAt
    ? telegramIdentity
    : (user.profile?.fullName ?? telegramIdentity);

  return (
    <main className="welcome-layout">
      <MinimalOnboardingForm
        defaultFullName={defaultFullName}
        defaultInstitution={user.profile?.campus ?? undefined}
      />
    </main>
  );
}
