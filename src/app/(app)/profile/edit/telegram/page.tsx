import { ProfileScreenShell } from "@/features/profile/components/profile-screen-shell";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/services/auth/current-user";
import { profileService } from "@/server/services/profile/profile-service";

export default async function ProfileEditBasicPage() {
  const user = await requirePageUser();
  const data = await profileService.getEditorData(user.id);

  if (!data) {
    notFound();
  }

  return (
    <ProfileScreenShell
      initialValues={data.initialValues}
      key={user.id}
      lookups={data.lookups}
      mode="edit"
      viewer={data.viewer}
    />
  );
}
