import { prisma } from "@/server/db/client";
import {
  profileInputSchema,
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
  availabilitySlots: { dayOfWeek: string; startMinute: number; endMinute: number }[];
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
      kind: "PROGRAM" | "ENGLISH" | "CUSTOM" | "OTHER";
      englishLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;
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
          }
        }
      }),
      loadLookups()
    ]);

    if (!user) {
      return null;
    }

    const telegramIdentity = [user.firstName, user.lastName].filter(Boolean).join(" ");
    const normalizedProgramId =
      normalizeStoredProgramId(user.profile?.program) ??
      "ba-international-business-economics";
    const selectedSubjects = user.userSubjects.map((entry) => entry.subject);
    const selectedSkills = user.userSkills.map((entry) => entry.skill);

    return {
      initialValues: {
        fullName: user.profile?.fullName ?? telegramIdentity,
        bio: user.profile?.bio ?? "",
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
        preferredFormats: user.profile?.preferredFormats ?? [],
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
          }
        }
      });

    if (!currentUser) {
      throw new Error("������������ �� ������.");
    }

    if (currentUser.status === "BLOCKED" || currentUser.status === "DELETED") {
      throw new Error(
        "������� ������ �������� ��� ���������������� ��� ��������� ������������."
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
      const resolvedSkillIds = await resolveSkillIdsWithCustomNames(transaction, {
        skillIds: input.skillIds,
        customSkillNames: input.customSkillNames
      });

      const skillsCount = await transaction.skill.count({
        where: {
          id: {
            in: resolvedSkillIds
          }
        }
      });

      if (skillsCount !== resolvedSkillIds.length) {
        throw new Error("��������� ������ ������ �� ����������.");
      }

      const resolvedSubjectIds = await resolveSubjectIdsWithCustomNames(transaction, {
        subjectIds: input.subjectIds,
        customSubjectNames: input.customSubjectNames
      });

      const subjectsCount = await transaction.subject.count({
        where: {
          id: {
            in: resolvedSubjectIds
          }
        }
      });

      if (subjectsCount !== resolvedSubjectIds.length) {
        throw new Error("��������� �������� ������ �� ����������.");
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
          onboardingCompleted: true
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
  }
};
