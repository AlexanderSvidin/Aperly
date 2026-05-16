import { prisma } from "@/server/db/client";

type MaybeRecoverableUser = {
  blockedAt: Date | null;
  onboardingCompleted: boolean;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED";
};

type TelegramIdentityUpdate = {
  firstName: string;
  languageCode?: string;
  lastName?: string;
  username?: string;
};

export function isRecoverableSelfDeletedUser(
  user: MaybeRecoverableUser | null | undefined
) {
  return (
    user?.status === "DELETED" &&
    user.role === "USER" &&
    !user.blockedAt &&
    !user.onboardingCompleted
  );
}

export async function recoverSelfDeletedUserForOnboarding(params: {
  telegramIdentity?: TelegramIdentityUpdate;
  userId: string;
}) {
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    await transaction.request.updateMany({
      where: {
        ownerId: params.userId,
        status: "ACTIVE"
      },
      data: {
        status: "DELETED",
        closedAt: now
      }
    });

    await transaction.match.updateMany({
      where: {
        OR: [
          {
            sourceRequest: {
              is: {
                ownerId: params.userId
              }
            }
          },
          {
            candidateRequest: {
              is: {
                ownerId: params.userId
              }
            }
          },
          {
            candidateProfile: {
              is: {
                userId: params.userId
              }
            }
          }
        ],
        status: {
          in: ["READY", "PENDING_RECIPIENT_ACCEPTANCE"]
        }
      },
      data: {
        status: "CLOSED",
        expiresAt: now
      }
    });

    await transaction.chat.updateMany({
      where: {
        OR: [{ userAId: params.userId }, { userBId: params.userId }],
        status: {
          in: ["ACTIVE", "STALE"]
        }
      },
      data: {
        status: "CLOSED",
        closedAt: now
      }
    });

    await Promise.all([
      transaction.userSkill.deleteMany({
        where: {
          userId: params.userId
        }
      }),
      transaction.userSubject.deleteMany({
        where: {
          userId: params.userId
        }
      }),
      transaction.languageSkill.deleteMany({
        where: {
          userId: params.userId
        }
      }),
      transaction.availabilitySlot.deleteMany({
        where: {
          profile: {
            is: {
              userId: params.userId
            }
          }
        }
      })
    ]);

    await transaction.profile.updateMany({
      where: {
        userId: params.userId
      },
      data: {
        fullName: "Удалённый профиль",
        bio: null,
        campus: null,
        program: null,
        courseYear: null,
        isDiscoverable: false,
        discoverableScenarios: [],
        telegramUsername: null,
        phone: null,
        preferredFormats: [],
        preferredRoles: []
      }
    });

    return transaction.user.update({
      where: {
        id: params.userId
      },
      data: {
        status: "INACTIVE",
        onboardingCompleted: false,
        deletedAt: now,
        ...(params.telegramIdentity
          ? {
              firstName: params.telegramIdentity.firstName,
              lastName: params.telegramIdentity.lastName ?? null,
              languageCode: params.telegramIdentity.languageCode ?? null,
              username: params.telegramIdentity.username ?? null
            }
          : {})
      },
      include: {
        profile: true
      }
    });
  });
}
