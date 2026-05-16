import { prisma } from "@/server/db/client";
import {
  basicProfileInputSchema,
  onboardingProfileInputSchema,
  profileInputSchema,
  rolesProfileInputSchema,
  skillsProfileInputSchema,
  type ProfileDraft
} from "@/features/profile/lib/profile-schema";
import {
  getLevelForProgramId,
  normalizeStoredProgramId
} from "@/features/study/lib/study-catalog";
import { resolveSkillIdsWithCustomNames } from "@/server/services/profile/profile-skill-service";
import {
  loadStudySubjectLookups,
  resolveSubjectIdsWithCustomNames
} from "@/server/services/study/study-subject-service";

function buildMatchingFingerprint(input: {
  skillIds: string[];
  subjectIds: string[];
  preferredFormats: string[];
  availabilitySlots: {
    dayOfWeek: string;
    startMinute: number;
    endMinute: number;
  }[];
  isDiscoverable: boolean;
  discoverableScenarios: string[];
}) {
  return JSON.stringify({
    skillIds: [...input.skillIds].sort(),
    subjectIds: [...input.subjectIds].sort(),
    preferredFormats: [...input.preferredFormats].sort(),
    availabilitySlots: [...input.availabilitySlots]
      .map((slot) => `${slot.dayOfWeek}:${slot.startMinute}:${slot.endMinute}`)
      .sort(),
    isDiscoverable: input.isDiscoverable,
    discoverableScenarios: [...input.discoverableScenarios].sort()
  });
}

export interface ProfileEditorData {
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
  viewer: {
    firstName: string;
    lastName: string | null;
    username: string | null;
    onboardingCompleted: boolean;
  };
}

async function loadLookups() {
  const [skills, subjects] = await Promise.all([
    prisma.skill.findMany({
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    }),
    loadStudySubjectLookups(prisma)
  ]);

  return {
    skills,
    subjects
  };
}

export const profileService = {
  async getLookups() {
    return loadLookups();
  },

  async getEditorData(userId: string): Promise<ProfileEditorData | null> {
    const [user, lookups] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId
        },
        include: {
          profile: {
            include: {
              availabilitySlots: {
                orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }]
              }
            }
          },
          userSkills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          },
          userSubjects: {
            include: {
              subject: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          },
          languageSkills: {
            select: {
              language: true,
              level: true
            }
          }
        }
      }),
      loadLookups()
    ]);

    if (!user) {
      return null;
    }

    const telegramIdentity = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ");
    const normalizedProgramId =
      normalizeStoredProgramId(user.profile?.program) ??
      "ba-international-business-economics";
    const selectedSubjects = user.userSubjects.map((entry) => entry.subject);
    const selectedSkills = user.userSkills.map((entry) => entry.skill);

    return {
      initialValues: {
        fullName: user.profile?.fullName ?? telegramIdentity,
        bio: user.profile?.bio ?? "",
        campus: user.profile?.campus ?? "",
        studyLevel: getLevelForProgramId(normalizedProgramId),
        programId: normalizedProgramId,
        courseYear: user.profile?.courseYear ?? 1,
        skillIds: selectedSkills
          .filter((skill) => !skill.slug.startsWith("custom-"))
          .map((skill) => skill.id),
        customSkillNames: selectedSkills
          .filter((skill) => skill.slug.startsWith("custom-"))
          .map((skill) => skill.name),
        subjectIds: selectedSubjects
          .filter((subject) => !subject.slug.startsWith("custom-"))
          .map((subject) => subject.id),
        customSubjectNames: selectedSubjects
          .filter((subject) => subject.slug.startsWith("custom-"))
          .map((subject) => subject.name),
        languageSkills: user.languageSkills.map((languageSkill) => ({
          language: languageSkill.language,
          level: languageSkill.level
        })),
        preferredFormats: user.profile?.preferredFormats ?? [],
        preferredRoles: user.profile?.preferredRoles ?? [],
        availabilitySlots:
          user.profile?.availabilitySlots.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startMinute: slot.startMinute,
            endMinute: slot.endMinute
          })) ?? [],
        isDiscoverable: user.profile?.isDiscoverable ?? false,
        discoverableScenarios: user.profile?.discoverableScenarios ?? []
      },
      lookups,
      viewer: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        onboardingCompleted: user.onboardingCompleted
      }
    };
  },

  async upsertMinimalProfile(userId: string, rawInput: unknown) {
    const input = onboardingProfileInputSchema.parse(rawInput);

    const currentUser = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        status: true,
        username: true,
        profile: {
          select: {
            id: true
          }
        }
      }
    });

    if (!currentUser) {
      throw new Error("Пользователь не найден.");
    }

    if (currentUser.status === "BLOCKED" || currentUser.status === "DELETED") {
      throw new Error(
        "Анкета недоступна для заблокированного или удалённого пользователя."
      );
    }

    const normalizedProgram = input.program
      ? (normalizeStoredProgramId(input.program) ?? input.program)
      : input.direction;

    const result = await prisma.$transaction(async (transaction) => {
      const profile = await transaction.profile.upsert({
        where: {
          userId
        },
        create: {
          userId,
          fullName: input.fullName,
          bio: null,
          campus: input.institution,
          program: normalizedProgram,
          courseYear: input.courseYear,
          telegramUsername: currentUser.username
            ? `@${currentUser.username}`
            : null
        },
        update: {
          fullName: input.fullName,
          campus: input.institution,
          program: normalizedProgram,
          courseYear: input.courseYear
        }
      });

      const user = await transaction.user.update({
        where: {
          id: userId
        },
        data: {
          status: "ACTIVE",
          onboardingCompleted: true,
          deletedAt: null
        },
        include: {
          profile: true
        }
      });

      return {
        created: !currentUser.profile,
        profile,
        user
      };
    });

    return result;
  },

  async upsertProfile(userId: string, rawInput: unknown) {
    const input = profileInputSchema.parse(rawInput);

    const currentUser = await prisma.user.findUnique({
      where: {
        id: userId
      },
      include: {
        profile: {
          include: {
            availabilitySlots: true
          }
        },
        userSkills: {
          select: {
            skillId: true,
            skill: {
              select: {
                id: true
              }
            }
          }
        },
        userSubjects: {
          include: {
            subject: {
              select: {
                id: true,
                slug: true
              }
            }
          }
        },
        languageSkills: {
          select: {
            language: true,
            level: true
          }
        }
      }
    });

    if (!currentUser) {
      throw new Error("Пользователь не найден.");
    }

    if (currentUser.status === "BLOCKED" || currentUser.status === "DELETED") {
      throw new Error(
        "Анкета недоступна для заблокированного или удалённого пользователя."
      );
    }

    const beforeFingerprint = buildMatchingFingerprint({
      skillIds: currentUser.userSkills.map((entry) => entry.skillId),
      subjectIds: currentUser.userSubjects.map((entry) => entry.subject.id),
      preferredFormats: currentUser.profile?.preferredFormats ?? [],
      availabilitySlots:
        currentUser.profile?.availabilitySlots.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute
        })) ?? [],
      isDiscoverable: currentUser.profile?.isDiscoverable ?? false,
      discoverableScenarios: currentUser.profile?.discoverableScenarios ?? []
    });

    const sanitizedDiscoverableScenarios = input.isDiscoverable
      ? input.discoverableScenarios
      : [];

    const result = await prisma.$transaction(async (transaction) => {
      const resolvedSkillIds = await resolveSkillIdsWithCustomNames(
        transaction,
        {
          skillIds: input.skillIds,
          customSkillNames: input.customSkillNames
        }
      );

      const skillsCount = await transaction.skill.count({
        where: {
          id: {
            in: resolvedSkillIds
          }
        }
      });

      if (skillsCount !== resolvedSkillIds.length) {
        throw new Error("Некоторые выбранные навыки не существуют.");
      }

      const resolvedSubjectIds = await resolveSubjectIdsWithCustomNames(
        transaction,
        {
          subjectIds: input.subjectIds,
          customSubjectNames: input.customSubjectNames
        }
      );

      const subjectsCount = await transaction.subject.count({
        where: {
          id: {
            in: resolvedSubjectIds
          }
        }
      });

      if (subjectsCount !== resolvedSubjectIds.length) {
        throw new Error("Некоторые выбранные предметы не существуют.");
      }

      const profile = await transaction.profile.upsert({
        where: {
          userId
        },
        create: {
          userId,
          fullName: input.fullName,
          bio: input.bio,
          program: input.programId,
          courseYear: input.courseYear,
          preferredFormats: input.preferredFormats,
          isDiscoverable: input.isDiscoverable,
          discoverableScenarios: sanitizedDiscoverableScenarios,
          telegramUsername:
            currentUser.profile?.telegramUsername ??
            (currentUser.username ? `@${currentUser.username}` : null)
        },
        update: {
          fullName: input.fullName,
          bio: input.bio,
          program: input.programId,
          courseYear: input.courseYear,
          preferredFormats: input.preferredFormats,
          isDiscoverable: input.isDiscoverable,
          discoverableScenarios: sanitizedDiscoverableScenarios
        }
      });

      await Promise.all([
        transaction.userSkill.deleteMany({
          where: {
            userId
          }
        }),
        transaction.userSubject.deleteMany({
          where: {
            userId
          }
        }),
        transaction.availabilitySlot.deleteMany({
          where: {
            profileId: profile.id
          }
        }),
        transaction.languageSkill.deleteMany({
          where: {
            userId
          }
        })
      ]);

      if (resolvedSkillIds.length > 0) {
        await transaction.userSkill.createMany({
          data: resolvedSkillIds.map((skillId) => ({
            userId,
            skillId
          }))
        });
      }

      if (resolvedSubjectIds.length > 0) {
        await transaction.userSubject.createMany({
          data: resolvedSubjectIds.map((subjectId) => ({
            userId,
            subjectId
          }))
        });
      }

      if (input.languageSkills.length > 0) {
        await transaction.languageSkill.createMany({
          data: input.languageSkills.map((languageSkill) => ({
            userId,
            language: languageSkill.language,
            level: languageSkill.level
          }))
        });
      }

      if (input.availabilitySlots.length > 0) {
        await transaction.availabilitySlot.createMany({
          data: input.availabilitySlots.map((slot) => ({
            profileId: profile.id,
            dayOfWeek: slot.dayOfWeek,
            startMinute: slot.startMinute,
            endMinute: slot.endMinute
          }))
        });
      }

      const updatedUser = await transaction.user.update({
        where: {
          id: userId
        },
        data: {
          status: "ACTIVE",
          onboardingCompleted: true,
          deletedAt: null
        },
        include: {
          profile: {
            include: {
              availabilitySlots: true
            }
          },
          userSkills: {
            select: {
              skillId: true
            }
          },
          userSubjects: {
            include: {
              subject: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      });

      return {
        created: !currentUser.profile,
        user: updatedUser
      };
    });

    const afterFingerprint = buildMatchingFingerprint({
      skillIds: result.user.userSkills.map((entry) => entry.skillId),
      subjectIds: result.user.userSubjects.map((entry) => entry.subject.id),
      preferredFormats: result.user.profile?.preferredFormats ?? [],
      availabilitySlots:
        result.user.profile?.availabilitySlots.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute
        })) ?? [],
      isDiscoverable: result.user.profile?.isDiscoverable ?? false,
      discoverableScenarios: result.user.profile?.discoverableScenarios ?? []
    });

    return {
      created: result.created,
      matchingRelevantFieldsChanged: beforeFingerprint !== afterFingerprint,
      user: result.user
    };
  },

  async updateBasicSection(userId: string, rawInput: unknown) {
    const input = basicProfileInputSchema.parse(rawInput);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, profile: { select: { id: true } } }
    });

    if (!currentUser) {
      throw new Error("Пользователь не найден.");
    }

    if (currentUser.status === "BLOCKED" || currentUser.status === "DELETED") {
      throw new Error("Профиль недоступен для редактирования.");
    }

    const normalizedProgram = input.program
      ? (normalizeStoredProgramId(input.program) ?? input.program)
      : input.direction;

    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: input.fullName,
        campus: input.institution,
        program: normalizedProgram,
        courseYear: input.courseYear
      },
      update: {
        fullName: input.fullName,
        campus: input.institution,
        program: normalizedProgram,
        courseYear: input.courseYear
      }
    });

    return { ok: true as const };
  },

  async updateSkillsSection(userId: string, rawInput: unknown) {
    const input = skillsProfileInputSchema.parse(rawInput);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, profile: { select: { id: true } } }
    });

    if (!currentUser) {
      throw new Error("Пользователь не найден.");
    }

    if (currentUser.status === "BLOCKED" || currentUser.status === "DELETED") {
      throw new Error("Профиль недоступен для редактирования.");
    }

    if (!currentUser.profile) {
      throw new Error(
        "Сначала заполните основные данные профиля."
      );
    }

    await prisma.$transaction(async (transaction) => {
      const resolvedSkillIds = await resolveSkillIdsWithCustomNames(
        transaction,
        {
          skillIds: input.skillIds,
          customSkillNames: input.customSkillNames
        }
      );

      const resolvedSubjectIds = await resolveSubjectIdsWithCustomNames(
        transaction,
        {
          subjectIds: input.subjectIds,
          customSubjectNames: input.customSubjectNames
        }
      );

      await Promise.all([
        transaction.userSkill.deleteMany({ where: { userId } }),
        transaction.userSubject.deleteMany({ where: { userId } }),
        transaction.languageSkill.deleteMany({ where: { userId } })
      ]);

      if (resolvedSkillIds.length > 0) {
        await transaction.userSkill.createMany({
          data: resolvedSkillIds.map((skillId) => ({ userId, skillId }))
        });
      }

      if (resolvedSubjectIds.length > 0) {
        await transaction.userSubject.createMany({
          data: resolvedSubjectIds.map((subjectId) => ({ userId, subjectId }))
        });
      }

      if (input.languageSkills.length > 0) {
        await transaction.languageSkill.createMany({
          data: input.languageSkills.map((languageSkill) => ({
            userId,
            language: languageSkill.language,
            level: languageSkill.level
          }))
        });
      }
    });

    return { ok: true as const, matchingRelevantFieldsChanged: true };
  },

  async updateRolesSection(userId: string, rawInput: unknown) {
    const input = rolesProfileInputSchema.parse(rawInput);

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, profile: { select: { id: true } } }
    });

    if (!currentUser) {
      throw new Error("Пользователь не найден.");
    }

    if (currentUser.status === "BLOCKED" || currentUser.status === "DELETED") {
      throw new Error("Профиль недоступен для редактирования.");
    }

    if (!currentUser.profile) {
      throw new Error("Сначала заполните основные данные профиля.");
    }

    await prisma.profile.update({
      where: { userId },
      data: {
        preferredRoles: input.preferredRoles
      }
    });

    return { ok: true as const };
  },

  async deleteProfile(userId: string) {
    const now = new Date();

    await prisma.$transaction(async (transaction) => {
      await transaction.request.updateMany({
        where: {
          ownerId: userId,
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
                  ownerId: userId
                }
              }
            },
            {
              candidateRequest: {
                is: {
                  ownerId: userId
                }
              }
            },
            {
              candidateProfile: {
                is: {
                  userId
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
          OR: [{ userAId: userId }, { userBId: userId }],
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
            userId
          }
        }),
        transaction.userSubject.deleteMany({
          where: {
            userId
          }
        }),
        transaction.languageSkill.deleteMany({
          where: {
            userId
          }
        }),
        transaction.availabilitySlot.deleteMany({
          where: {
            profile: {
              is: {
                userId
              }
            }
          }
        })
      ]);

      await transaction.profile.updateMany({
        where: {
          userId
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

      await transaction.user.update({
        where: {
          id: userId
        },
        data: {
          status: "INACTIVE",
          onboardingCompleted: false,
          deletedAt: now
        }
      });
    });

    return { deleted: true as const };
  }
};
