import { redirect } from "next/navigation";

import { ProfileScreenShell } from "@/features/profile/components/profile-screen-shell";
import { requirePageUser } from "@/server/services/auth/current-user";
import { profileService } from "@/server/services/profile/profile-service";

export default async function ProfilePage() {
  const user = await requirePageUser();

  let editorData;

  try {
    editorData = await profileService.getEditorData(user.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка";
    console.error("[ProfilePage] getEditorData failed for user", user.id, "—", message);

    // Return an inline stub instead of crashing the whole page.
    // The error.tsx boundary is the next safety net if this component itself throws.
    return <ProfileLoadFailed />;
  }

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

function ProfileLoadFailed() {
  return (
    <section className="screen-stack">
      <div className="surface-card screen-stack">
        <div className="card-header">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="card-title">Не удалось загрузить данные</h1>
        </div>
        <p className="card-body-copy">
          Информация профиля временно недоступна. Скорее всего, это сбой базы
          данных или сетевая проблема. Попробуйте зайти снова через несколько
          секунд.
        </p>
        <a className="button button-primary button-full" href="/profile">
          Обновить страницу
        </a>
      </div>
    </section>
  );
}
