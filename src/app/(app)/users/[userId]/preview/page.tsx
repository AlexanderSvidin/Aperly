import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/button";
import Link from "next/link";
import { getProgramLabel } from "@/features/study/lib/study-catalog";
import { requirePageUser } from "@/server/services/auth/current-user";
import { prisma } from "@/server/db/client";

type UserPreviewPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

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

export default async function UserPreviewPage({ params }: UserPreviewPageProps) {
  await requirePageUser();
  const resolvedParams = await params;
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

  if (!user || !user.profile?.isDiscoverable) {
    notFound();
  }

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="screen-title">{buildDisplayName(user)}</h1>
          <p className="screen-description">
            {[getProgramLabel(user.profile.program), user.profile.courseYear
              ? `${user.profile.courseYear} курс`
              : null]
              .filter(Boolean)
              .join(", ") || "Профиль заполнен частично"}
          </p>
        </div>

        {user.profile.bio ? (
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
