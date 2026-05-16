import { notFound } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { buttonClassName } from "@/components/ui/button";
import Link from "next/link";
import type { Route } from "next";
import { PreviewInviteAction } from "@/features/matching/components/preview-invite-action";
import { formatOptions } from "@/features/profile/lib/profile-options";
import {
  collaborationRoleOptions
} from "@/features/requests/lib/request-options";
import { getProgramLabel } from "@/features/study/lib/study-catalog";
import { requirePageUser } from "@/server/services/auth/current-user";
import { matchingService } from "@/server/services/matching/matching-service";
import { prisma } from "@/server/db/client";

const roleLabelByValue = Object.fromEntries(
  collaborationRoleOptions.map((option) => [option.value, option.label])
) as Record<string, string>;

type UserPreviewPageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams?: Promise<{
    matchId?: string | string[];
  }>;
};

const previewScenarioLabels: Record<string, string> = {
  STUDY: "Учёба",
  CASE: "Команда",
  PROJECT: "Проект",
  ACTIVITY: "Активность"
};

const formatLabelByValue = Object.fromEntries(
  formatOptions.map((option) => [option.value, option.label])
) as Record<(typeof formatOptions)[number]["value"], string>;

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildDisplayName(user: {
  firstName: string;
  lastName: string | null;
  profile: { fullName: string | null } | null;
}) {
  return (
    user.profile?.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "Студент HSE Perm"
  );
}

async function canPreviewThroughMatch(viewerUserId: string, targetUserId: string) {
  const match = await prisma.match.findFirst({
    where: {
      status: {
        in: ["READY", "PENDING_RECIPIENT_ACCEPTANCE"]
      },
      OR: [
        {
          sourceRequest: {
            is: {
              ownerId: viewerUserId
            }
          },
          candidateRequest: {
            is: {
              ownerId: targetUserId
            }
          }
        },
        {
          sourceRequest: {
            is: {
              ownerId: targetUserId
            }
          },
          candidateRequest: {
            is: {
              ownerId: viewerUserId
            }
          }
        },
        {
          sourceRequest: {
            is: {
              ownerId: viewerUserId
            }
          },
          candidateProfile: {
            is: {
              userId: targetUserId
            }
          }
        }
      ]
    },
    select: {
      id: true
    }
  });

  return Boolean(match);
}

export default async function UserPreviewPage({
  params,
  searchParams
}: UserPreviewPageProps) {
  const viewer = await requirePageUser();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const matchId = readSingleSearchParam(resolvedSearchParams?.matchId);
  const user = await prisma.user.findFirst({
    where: {
      id: resolvedParams.userId,
      status: "ACTIVE",
      blockedAt: null,
      deletedAt: null
    },
    include: {
      profile: true,
      userSkills: {
        include: {
          skill: true
        }
      },
      userSubjects: {
        include: {
          subject: true
        }
      }
    }
  });

  if (!user) {
    notFound();
  }

  const canPreview =
    user.id === viewer.id ||
    Boolean(user.profile?.isDiscoverable) ||
    (await canPreviewThroughMatch(viewer.id, user.id));

  if (!canPreview) {
    notFound();
  }

  const inviteContext = matchId
    ? await matchingService
        .getDetailForUser(viewer.id, matchId)
        .then((match) =>
          match.candidateProfile.userId === user.id ? match : null
        )
        .catch(() => null)
    : null;

  const displayName = buildDisplayName(user);
  const subjectsAsWants = user.userSubjects.slice(0, 8).map((e) => e.subject.name);
  const skillsAsCan = user.userSkills.slice(0, 10).map((e) => e.skill.name);

  // Build "Why fit" reasons from match context
  const matchReasons = inviteContext?.reasons ?? [];

  // Collect user roles from their profile (preferredRoles array)
  const userRoles: string[] = [];
  if (Array.isArray(user.profile?.preferredRoles)) {
    for (const role of user.profile.preferredRoles) {
      const label = roleLabelByValue[role] ?? role;
      if (!userRoles.includes(label)) userRoles.push(label);
    }
  }

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="user-preview-head">
          <Avatar name={displayName} size="lg" />
          <div className="screen-copy">
            <h1 className="page-title">{displayName}</h1>
            <p className="screen-description">
              {[
                getProgramLabel(user.profile?.program),
                user.profile?.courseYear ? `${user.profile.courseYear} курс` : null
              ]
                .filter(Boolean)
                .join(", ") || "Профиль заполнен частично"}
            </p>
          </div>
        </div>

        {user.profile?.bio ? (
          <p className="card-body-copy">{user.profile.bio}</p>
        ) : null}
      </section>

      {skillsAsCan.length > 0 ? (
        <section className="surface-card screen-stack">
          <div className="labeled-section">
            <h2 className="labeled-section-title">Умеет</h2>
            <div className="chip-row">
              {skillsAsCan.map((skill) => (
                <span className="info-chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {subjectsAsWants.length > 0 ? (
        <section className="surface-card screen-stack">
          <div className="labeled-section">
            <h2 className="labeled-section-title">Хочет подтянуть</h2>
            <div className="chip-row">
              {subjectsAsWants.map((subject) => (
                <span className="info-chip" key={subject}>
                  {subject}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {userRoles.length > 0 ? (
        <section className="surface-card screen-stack">
          <div className="labeled-section">
            <h2 className="labeled-section-title">Роли</h2>
            <div className="chip-row">
              {userRoles.map((role) => (
                <span className="info-chip" key={role}>
                  {role}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {matchReasons.length > 0 ? (
        <section className="surface-card screen-stack">
          <div className="labeled-section">
            <h2 className="labeled-section-title">Почему подходит</h2>
            <ul className="why-fit-list">
              {matchReasons.slice(0, 4).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="surface-card screen-stack">
        <div className="feedback-box">
          <p className="feedback-title">Telegram скрыт до активной связи.</p>
        </div>

        {inviteContext?.invitationState.status === "NONE" ? (
          <PreviewInviteAction
            invite={{
              matchId: inviteContext.id,
              candidateName: displayName,
              requestTitle: inviteContext.request.title,
              requestType: previewScenarioLabels[inviteContext.request.scenario],
              role:
                inviteContext.reasons.find((reason) =>
                  reason.toLowerCase().includes("роль")
                ) ?? null,
              format: inviteContext.request.preferredFormat
                ? formatLabelByValue[inviteContext.request.preferredFormat]
                : null
            }}
          />
        ) : inviteContext?.invitationState.status === "ACCEPTED" &&
          inviteContext.invitationState.connectionId ? (
          <Link
            className={buttonClassName()}
            href={`/connections/${inviteContext.invitationState.connectionId}` as Route}
          >
            Перейти в связь
          </Link>
        ) : inviteContext ? (
          <span className="button button-secondary button-full">
            {inviteContext.invitationState.label}
          </span>
        ) : null}

        <BackLink />
      </section>
    </section>
  );
}

function BackLink() {
  return (
    <Link
      className={buttonClassName({ variant: "secondary" })}
      href="/opportunities"
    >
      Назад
    </Link>
  );
}
