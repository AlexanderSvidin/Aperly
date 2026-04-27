import { z } from "zod";

import {
  MAX_AVAILABILITY_SLOTS,
  MAX_PROFILE_LANGUAGES,
  MAX_PROFILE_SKILLS,
  MAX_PROFILE_SUBJECTS
} from "@/features/profile/lib/profile-options";
import {
  type EnglishLevelId,
  studyLevelOptions,
  studyProgramOptions,
  type StudyLevelId
} from "@/features/study/lib/study-catalog";

const formatValues = ["ONLINE", "OFFLINE", "HYBRID"] as const;
const scenarioValues = ["CASE", "PROJECT", "STUDY"] as const;
const languageValues = ["ENGLISH"] as const;
const languageLevelValues = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const dayOfWeekValues = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
] as const;

const availabilitySlotSchema = z
  .object({
    dayOfWeek: z.enum(dayOfWeekValues),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440)
  })
  .refine((slot) => slot.endMinute > slot.startMinute, {
    message: "Время окончания должно быть позже времени начала.",
    path: ["endMinute"]
  });

export type ProfileAvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export type ProfileLanguageSkill = {
  language: (typeof languageValues)[number];
  level: EnglishLevelId;
};

export type ProfileDraft = {
  fullName: string;
  bio: string;
  studyLevel: StudyLevelId;
  programId: string;
  courseYear: number;
  skillIds: string[];
  customSkillNames: string[];
  subjectIds: string[];
  customSubjectNames: string[];
  languageSkills: ProfileLanguageSkill[];
  preferredFormats: (typeof formatValues)[number][];
  availabilitySlots: ProfileAvailabilitySlot[];
  isDiscoverable: boolean;
  discoverableScenarios: (typeof scenarioValues)[number][];
};

const studyLevelValues = studyLevelOptions.map((option) => option.value) as [
  StudyLevelId,
  ...StudyLevelId[]
];
const allowedProgramIds = new Set(studyProgramOptions.map((program) => program.id));

export const profileInputSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160),
    bio: z.string().trim().min(10).max(400),
    studyLevel: z.enum(studyLevelValues),
    programId: z
      .string()
      .trim()
      .min(1)
      .refine((value) => allowedProgramIds.has(value), {
        message: "Выберите программу из списка."
      }),
    courseYear: z.number().int().min(1).max(4),
    skillIds: z.array(z.string().uuid()).max(MAX_PROFILE_SKILLS),
    customSkillNames: z
      .array(z.string().trim().min(2).max(120))
      .max(MAX_PROFILE_SKILLS),
    subjectIds: z.array(z.string().uuid()).max(MAX_PROFILE_SUBJECTS),
    customSubjectNames: z
      .array(z.string().trim().min(2).max(120))
      .max(MAX_PROFILE_SUBJECTS),
    languageSkills: z
      .array(
        z.object({
          language: z.enum(languageValues),
          level: z.enum(languageLevelValues)
        })
      )
      .max(MAX_PROFILE_LANGUAGES),
    preferredFormats: z.array(z.enum(formatValues)).min(1).max(formatValues.length),
    availabilitySlots: z
      .array(availabilitySlotSchema)
      .min(1)
      .max(MAX_AVAILABILITY_SLOTS),
    isDiscoverable: z.boolean(),
    discoverableScenarios: z.array(z.enum(scenarioValues)).max(scenarioValues.length)
  })
  .superRefine((value, context) => {
    const totalSkills =
      new Set(value.skillIds).size +
      new Set(value.customSkillNames.map((name) => name.toLowerCase())).size;
    const totalSubjects =
      new Set(value.subjectIds).size +
      new Set(value.customSubjectNames.map((name) => name.toLowerCase())).size;

    if (totalSkills === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["skillIds"],
        message: "Нужен хотя бы один навык."
      });
    }

    if (totalSkills > MAX_PROFILE_SKILLS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["skillIds"],
        message: `Можно выбрать не больше ${MAX_PROFILE_SKILLS} навыков.`
      });
    }

    if (totalSubjects === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subjectIds"],
        message: "Нужен хотя бы один предмет."
      });
    }

    if (totalSubjects > MAX_PROFILE_SUBJECTS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subjectIds"],
        message: `Можно выбрать не больше ${MAX_PROFILE_SUBJECTS} предметов.`
      });
    }

    if (new Set(value.languageSkills.map((skill) => skill.language)).size !== value.languageSkills.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["languageSkills"],
        message: "Каждый язык можно указать только один раз."
      });
    }

    if (value.studyLevel === "MASTER" && value.courseYear > 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["courseYear"],
        message: "Для магистратуры доступны 1 и 2 курс."
      });
    }

    if (value.isDiscoverable && value.discoverableScenarios.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discoverableScenarios"],
        message:
          "Если профиль открыт для резервного подбора, выберите хотя бы один сценарий."
      });
    }

    if (!value.isDiscoverable && value.discoverableScenarios.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discoverableScenarios"],
        message:
          "Сценарии резервного подбора можно выбрать только если профиль открыт для показа."
      });
    }
  })
  .transform((value) => ({
    ...value,
    bio: value.bio.trim(),
    customSkillNames: [...new Set(value.customSkillNames.map(normalizeSkillName))],
    customSubjectNames: [...new Set(value.customSubjectNames.map(normalizeSubjectName))],
    languageSkills: [...value.languageSkills],
    discoverableScenarios: [...new Set(value.discoverableScenarios)],
    preferredFormats: [...new Set(value.preferredFormats)],
    skillIds: [...new Set(value.skillIds)],
    subjectIds: [...new Set(value.subjectIds)],
    availabilitySlots: [...value.availabilitySlots].sort((left, right) => {
      if (left.dayOfWeek === right.dayOfWeek) {
        return left.startMinute - right.startMinute;
      }

      return left.dayOfWeek.localeCompare(right.dayOfWeek);
    })
  }));

export type ProfileInput = z.infer<typeof profileInputSchema>;

function normalizeSubjectName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSkillName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
