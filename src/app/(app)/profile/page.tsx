import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteProfilePanel } from "@/features/profile/components/delete-profile-panel";
import { collaborationRoleOptions } from "@/features/requests/lib/request-options";
import type { SerializedRequest } from "@/features/requests/lib/request-schema";
import { getProgramLabel } from "@/features/study/lib/study-catalog";
import { requirePageUser } from "@/server/services/auth/current-user";
import { profileService } from "@/server/services/profile/profile-service";
import { requestService } from "@/server/services/requests/request-service";

const roleLabelByValue = Object.fromEntries(
  collaborationRoleOptions.map((option) => [option.value, option.label])
) as Record<(typeof collaborationRoleOptions)[number]["value"], string>;

function formatProgram(program: string | null | undefined) {
  return getProgramLabel(program) ?? program ?? null;
}

function formatCourse(courseYear: number | null | undefined) {
  return courseYear ? `${courseYear} курс` : "Курс не указан";
}

function collectRequestRoles(requests: SerializedRequest[]) {
  const roles = requests.flatMap((request) => {
    if (request.status !== "ACTIVE") {
      return [];
    }

    if (request.details.type === "CASE" || request.details.type === "PROJECT") {
      return request.details.neededRoles;
    }

    return [];
  });

  return [...new Set(roles)].map((role) => roleLabelByValue[role] ?? role);
}

function getInitial(name: string | null | undefined) {
  return (name?.trim().charAt(0) || "A").toUpperCase();
}

function MenuLink({
  count,
  href,
  label
}: {
  count?: number;
  href: Route;
  label: string;
}) {
  return (
    <Link className="profile-menu-row" href={href}>
      <span>{label}</span>
      <span className="profile-menu-trailing">
        {typeof count === "number" ? <span>{count}</span> : null}
        <span aria-hidden="true">›</span>
      </span>
    </Link>
  );
}

function ValueRow({
  actionHref,
  actionLabel,
  label,
  values
}: {
  actionHref?: Route;
  actionLabel?: string;
  label: string;
  values: string[];
}) {
  return (
    <div className="profile-value-row">
      <p className="field-label">{label}</p>
      {values.length > 0 ? (
        <p className="profile-value-text">{values.join(" · ")}</p>
      ) : actionHref && actionLabel ? (
        <Link className="soft-cta-link" href={actionHref}>
          {actionLabel}
        </Link>
      ) : (
        <p className="helper-text">Пока не указано</p>
      )}
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requirePageUser();

  let editorData;
  let requests: SerializedRequest[] = [];

  try {
    [editorData, requests] = await Promise.all([
      profileService.getEditorData(user.id),
      requestService.listForUser(user.id)
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка";
    console.error("[ProfilePage] load failed for user", user.id, "-", message);

    return <ProfileLoadFailed />;
  }

  if (!editorData) {
    redirect("/");
  }

  const profile = user.profile;
  const skillNameById = new Map(
    editorData.lookups.skills.map((skill) => [skill.id, skill.name])
  );
  const subjectNameById = new Map(
    editorData.lookups.subjects.map((subject) => [subject.id, subject.name])
  );
  const skillsCan = [
    ...editorData.initialValues.skillIds
      .map((skillId) => skillNameById.get(skillId))
      .filter(Boolean),
    ...editorData.initialValues.customSkillNames
  ] as string[];
  const skillsWant = [
    ...editorData.initialValues.subjectIds
      .map((subjectId) => subjectNameById.get(subjectId))
      .filter(Boolean),
    ...editorData.initialValues.customSubjectNames
  ] as string[];
  const roles = collectRequestRoles(requests);
  const displayName = profile?.fullName ?? editorData.initialValues.fullName;
  const program = formatProgram(profile?.program);
  const activeRequestCount = requests.filter(
    (request) => request.status === "ACTIVE"
  ).length;

  return (
    <section className="screen-stack">
      <section className="surface-card profile-summary-card">
        <span className="profile-avatar" aria-hidden="true">
          {getInitial(displayName)}
        </span>
        <div className="profile-summary-copy">
          <div className="screen-copy">
            <h2 className="screen-title">
              {displayName || "Студент HSE Perm"}
            </h2>
            <p className="screen-description">
              {[
                profile?.campus ?? "Вуз не указан",
                formatCourse(profile?.courseYear)
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="card-body-copy">
              {program ? program : "Направление или программа не указаны"}
            </p>
          </div>
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href="/profile/edit"
          >
            Редактировать
          </Link>
        </div>
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Для подбора</p>
          <h2 className="card-title">Что помогает находить людей</h2>
        </div>

        <ValueRow
          actionHref="/profile/edit/skills"
          actionLabel="Добавить навыки"
          label="Умею"
          values={skillsCan}
        />
        <ValueRow
          actionHref="/profile/edit/skills"
          actionLabel="Добавить интересы"
          label="Хочу"
          values={skillsWant}
        />
        <ValueRow
          actionHref="/profile/edit/roles"
          actionLabel="Добавить роли"
          label="Роли"
          values={roles.length > 0 ? [roles[0]!, ...roles.slice(1)] : []}
        />
      </section>

      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Меню</p>
          <h2 className="card-title">Настройки и история</h2>
        </div>

        <div className="profile-menu-list">
          <MenuLink
            count={activeRequestCount}
            href="/profile/requests"
            label="Мои запросы"
          />
          <MenuLink href="/profile/archive" label="Архив" />
          <MenuLink href="/profile/edit/telegram" label="Telegram-контакт" />
          <a className="profile-menu-row" href="#delete-account">
            <span>Удалить аккаунт</span>
            <span className="profile-menu-trailing" aria-hidden="true">
              ›
            </span>
          </a>
        </div>
      </section>

      <div id="delete-account">
        <DeleteProfilePanel />
      </div>
    </section>
  );
}

function ProfileLoadFailed() {
  return (
    <section className="screen-stack">
      <div className="surface-card screen-stack">
        <EmptyState
          actionHref="/profile"
          actionLabel="Повторить"
          title="Не удалось загрузить данные"
          text="Проверьте интернет и попробуйте снова."
        />
      </div>
    </section>
  );
}
