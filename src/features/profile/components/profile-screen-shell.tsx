import { ProfileForm } from "@/features/profile/components/profile-form";
import type { ProfileDraft } from "@/features/profile/lib/profile-schema";

type ProfileScreenShellProps = {
  initialValues: ProfileDraft;
  lookups: {
    skills: {
      id: string;
      name: string;
      slug: string;
    }[];
    subjects: {
      id: string;
      name: string;
      slug: string;
      levelId: "BACHELOR" | "MASTER" | null;
      programId: string | null;
      courseYear: number | null;
      kind: "PROGRAM" | "CUSTOM" | "OTHER";
      searchText: string;
    }[];
  };
  mode: "onboarding" | "edit";
  viewer: {
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
};

export function ProfileScreenShell({
  initialValues,
  lookups,
  mode,
  viewer
}: ProfileScreenShellProps) {
  const greetingName = initialValues.fullName || viewer.firstName;

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <h1 className="screen-title">
          {mode === "onboarding" ? `Привет, ${greetingName}` : "Профиль"}
        </h1>
        <p className="screen-description">
          {mode === "onboarding"
            ? "Несколько полей — и система сразу начнёт подбирать людей."
            : "Профиль можно обновлять в любой момент. Изменения сохраняются без пересоздания аккаунта."}
        </p>
      </div>

      <ProfileForm initialValues={initialValues} lookups={lookups} mode={mode} />
    </section>
  );
}
