import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/button";
import Link from "next/link";
import type { Route } from "next";
import { PreviewInviteAction } from "@/features/matching/components/preview-invite-action";
import { formatOptions } from "@/features/profile/lib/profile-options";
import { getProgramLabel } from "@/features/study/lib/study-catalog";
import { requirePageUser } from "@/server/services/auth/current-user";
import { matchingService } from "@/server/services/matching/matching-service";
import { prisma } from "@/server/db/client";

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

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="screen-title">{buildDisplayName(user)}</h1>
          <p className="screen-description">
            {[getProgramLabel(user.profile?.program), user.profile?.courseYear
              ? `${user.profile.courseYear} курс`
              : null]
              .filter(Boolean)
              .join(", ") || "Профиль заполнен частично"}
          </p>
        </div>

        {user.profile?.bio ? (
          <p className="card-body-copy">{user.profile.bio}</p>
        ) : null}

        <div className="chip-row">
          {user.userSkills.slice(0, 8).map((entry) => (
            <span className="info-chip" key={entry.skillId}>
              {entry.skill.name}
            </span>
          ))}
          {user.userSubjects.slice(0, 6).map((entry) => (
            <span className="info-chip" key={entry.subjectId}>
              {entry.subject.name}
            </span>
          ))}
        </div>

        <div className="feedback-box">
          <p className="feedback-title">Telegram скрыт до активной связи.</p>
        </div>

        {inviteContext?.invitationState.status === "NONE" ? (
          <PreviewInviteAction
            invite={{
              matchId: inviteContext.id,
              candidateName: buildDisplayName(user),
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

        <Link
          className={buttonClassName({ variant: "secondary" })}
          href="/opportunities"
        >
          К возможностям
        </Link>
      </section>
    </section>
  );
}
