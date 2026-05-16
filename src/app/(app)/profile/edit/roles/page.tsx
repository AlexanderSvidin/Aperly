import { notFound } from "next/navigation";

import { RolesProfileForm } from "@/features/profile/components/roles-profile-form";
import { collaborationRoleOptions } from "@/features/requests/lib/request-options";
import { requirePageUser } from "@/server/services/auth/current-user";
import { profileService } from "@/server/services/profile/profile-service";

type RoleValue = (typeof collaborationRoleOptions)[number]["value"];

const ALLOWED_ROLES = new Set<RoleValue>(
  collaborationRoleOptions.map((option) => option.value)
);

export default async function ProfileEditRolesPage() {
  const user = await requirePageUser();
  const data = await profileService.getEditorData(user.id);

  if (!data) {
    notFound();
  }

  const initialRoles = data.initialValues.preferredRoles.filter(
    (role): role is RoleValue => ALLOWED_ROLES.has(role as RoleValue)
  );

  return <RolesProfileForm initialRoles={initialRoles} />;
}
