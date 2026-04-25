import { redirect } from "next/navigation";

import { WelcomeScreen } from "@/features/home/components/welcome-screen";
import { getCurrentSessionUser } from "@/server/services/auth/current-user";

export default async function LandingPage() {
  const currentUser = await getCurrentSessionUser();

  if (currentUser?.status === "BLOCKED") {
    redirect("/blocked?reason=blocked");
  }

  if (currentUser?.status === "DELETED") {
    redirect("/blocked?reason=deleted");
  }

  if (currentUser) {
    redirect(currentUser.onboardingCompleted ? "/home" : "/onboarding");
  }

  return <WelcomeScreen />;
}
