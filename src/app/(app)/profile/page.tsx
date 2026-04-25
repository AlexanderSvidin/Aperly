import { redirect } from "next/navigation";

import { ProfileScreenShell } from "@/features/profile/components/profile-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { profileService } from "@/server/services/profile/profile-service";

export default async function ProfilePage() {
  const user = await requirePageUser();
  const editorData = await profileService.getEditorData(user.id);

  if (!editorData) {
    redirect("/");
  }

  return (
    <ProfileScreenShell
      initialValues={editorData.initialValues}
      lookups={editorData.lookups}
      mode="edit"
      viewer={editorData.viewer}
    />
  );
}
