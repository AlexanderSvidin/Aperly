import { notFound } from "next/navigation";

import { BasicProfileForm } from "@/features/profile/components/basic-profile-form";
import { requirePageUser } from "@/server/services/auth/current-user";
import { profileService } from "@/server/services/profile/profile-service";

export default async function ProfileEditBasicPage() {
  const user = await requirePageUser();
  const data = await profileService.getEditorData(user.id);

  if (!data) {
    notFound();
  }

  return (
    <BasicProfileForm
      defaultFullName={data.initialValues.fullName}
      defaultInstitution={data.initialValues.campus}
      defaultProgramType={data.initialValues.studyLevel}
      defaultDirection={data.initialValues.programId}
      defaultProgramId={data.initialValues.programId}
      defaultCourseYear={data.initialValues.courseYear}
    />
  );
}
