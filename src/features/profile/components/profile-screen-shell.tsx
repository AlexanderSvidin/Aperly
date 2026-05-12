import { ProfileForm } from "@/features/profile/components/profile-form";
import { DeleteProfilePanel } from "@/features/profile/components/delete-profile-panel";
import type { ProfileDraft } from "@/features/profile/lib/profile-schema";
import { buildHomeRequestSubtitle, buildHomeRequestTitle } from "@/server/services/home/home-presenters";
import type { SerializedRequest } from "@/features/requests/lib/request-schema";
import {
  formatRequestDate,
  requestScenarioOptions,
  requestStatusLabels,
  requestStatusTone
} from "@/features/requests/lib/request-options";

type ProfileScreenShellProps = {
  archivedRequests?: SerializedRequest[];
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
  archivedRequests = [],
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

      {mode === "edit" ? (
        <>
          <section className="surface-card screen-stack">
            <div className="card-header">
              <p className="card-eyebrow">История</p>
              <h2 className="card-title">Архив запросов</h2>
            </div>

            {archivedRequests.length === 0 ? (
              <p className="card-body-copy">
                Архив пуст. Закрытые и архивные запросы появятся здесь, когда вы
                завершите поиск.
              </p>
            ) : (
              <div className="request-history-list">
                {archivedRequests.map((request) => (
                  <div key={request.id} className="request-history-row">
                    <div className="request-history-copy">
                      <div className="request-history-head">
                        <strong>{buildHomeRequestTitle(request)}</strong>
                        <span
                          className="tone-pill"
                          data-tone={requestStatusTone[request.status]}
                        >
                          {requestStatusLabels[request.status]}
                        </span>
                      </div>
                      <p className="helper-text">
                        {requestScenarioOptions.find(
                          (scenario) => scenario.value === request.scenario
                        )?.label ?? request.scenario}
                        {". "}
                        {buildHomeRequestSubtitle(request)}
                      </p>
                      <p className="helper-text">
                        Активен до {formatRequestDate(request.expiresAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <DeleteProfilePanel />
        </>
      ) : null}
    </section>
  );
}
