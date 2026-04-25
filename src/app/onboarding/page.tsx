import { redirect } from "next/navigation";

import { ProfileScreenShell } from "@/features/profile/components/profile-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { profileService } from "@/server/services/profile/profile-service";

export default async function OnboardingPage() {
  const user = await requirePageUser({
    allowIncompleteOnboarding: true
  });

  if (user.onboardingCompleted) {
    redirect("/home");
  }

  const editorData = await profileService.getEditorData(user.id);

  if (!editorData) {
    redirect("/");
  }

  return (
    <main className="welcome-layout">
      <ProfileScreenShell
        initialValues={editorData.initialValues}
        lookups={editorData.lookups}
        mode="onboarding"
        viewer={editorData.viewer}
      />
    </main>
  );
}
