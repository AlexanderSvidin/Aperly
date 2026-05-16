import { notFound } from "next/navigation";

import { SkillsProfileForm } from "@/features/profile/components/skills-profile-form";
import { requirePageUser } from "@/server/services/auth/current-user";
import { profileService } from "@/server/services/profile/profile-service";

export default async function ProfileEditSkillsPage() {
  const user = await requirePageUser();
  const data = await profileService.getEditorData(user.id);

  if (!data) {
    notFound();
  }

  return (
    <SkillsProfileForm
      initialSkillIds={data.initialValues.skillIds}
      initialCustomSkillNames={data.initialValues.customSkillNames}
      initialSubjectIds={data.initialValues.subjectIds}
      initialCustomSubjectNames={data.initialValues.customSubjectNames}
      initialLanguageSkills={data.initialValues.languageSkills}
      lookups={{
        skills: data.lookups.skills.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug
        })),
        subjects: data.lookups.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug
        }))
      }}
    />
  );
}
