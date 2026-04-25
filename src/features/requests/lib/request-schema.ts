import { z } from "zod";

import { maxRequestAvailabilitySlots } from "@/features/requests/lib/request-options";

const scenarioValues = ["CASE", "PROJECT", "STUDY"] as const;
const collaborationRoleValues = [
  "ANALYST",
  "DEVELOPER",
  "DESIGNER",
  "PRODUCT_MANAGER",
  "RESEARCHER",
  "MARKETER",
  "FINANCE",
  "PRESENTER",
  "OTHER"
] as const;
const formatValues = ["ONLINE", "OFFLINE", "HYBRID"] as const;
const projectStageValues = [
  "IDEA",
  "MVP",
  "EARLY_TRACTION",
  "OPERATING"
] as const;
const commitmentValues = ["LIGHT", "PART_TIME", "HEAVY", "FLEXIBLE"] as const;
const studyFrequencyValues = [
  "ONCE",
  "WEEKLY",
  "TWICE_WEEKLY",
  "FLEXIBLE"
] as const;
const preferredTimeValues = [
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "FLEXIBLE"
] as const;
const dayOfWeekValues = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
] as const;

export type RequestScenario = (typeof scenarioValues)[number];

const availabilitySlotSchema = z
  .object({
    dayOfWeek: z.enum(dayOfWeekValues),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440)
  })
  .refine((slot) => slot.endMinute > slot.startMinute, {
    message: "Окончание слота должно быть позже начала.",
    path: ["endMinute"]
  });

const baseRequestSchema = z.object({
  scenario: z.enum(scenarioValues),
  notes: z.string().trim().max(600).optional().nullable()
});

const caseRequestSchema = baseRequestSchema.extend({
  scenario: z.literal("CASE"),
  availabilitySlots: z.array(availabilitySlotSchema).min(1).max(maxRequestAvailabilitySlots),
  details: z.object({
    eventName: z.string().trim().min(2).max(160),
    deadline: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value ? value : null))
      .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
        message: "Дата дедлайна некорректна."
      }),
    neededRoles: z
      .array(z.enum(collaborationRoleValues))
      .min(1)
      .max(collaborationRoleValues.length),
    teamGapSize: z.number().int().min(1).max(8),
    preferredFormat: z.enum(formatValues)
  })
});

const projectRequestSchema = baseRequestSchema.extend({
  scenario: z.literal("PROJECT"),
  availabilitySlots: z.array(availabilitySlotSchema).max(maxRequestAvailabilitySlots).default([]),
  details: z.object({
    projectTitle: z.string().trim().min(2).max(160),
    shortDescription: z.string().trim().min(10).max(500),
    stage: z.enum(projectStageValues),
    neededRoles: z
      .array(z.enum(collaborationRoleValues))
      .min(1)
      .max(collaborationRoleValues.length),
    expectedCommitment: z.enum(commitmentValues),
    preferredFormat: z.enum(formatValues)
  })
});

const studyRequestSchema = baseRequestSchema.extend({
  scenario: z.literal("STUDY"),
  availabilitySlots: z.array(availabilitySlotSchema).max(maxRequestAvailabilitySlots).default([]),
  details: z.object({
    subjectId: z.string().uuid().optional().nullable(),
    customSubjectName: z.string().trim().min(2).max(120).optional().nullable(),
    currentContext: z.string().trim().min(10).max(500),
    goal: z.string().trim().min(10).max(500),
    desiredFrequency: z.enum(studyFrequencyValues),
    preferredTime: z.enum(preferredTimeValues),
    preferredFormat: z.enum(formatValues)
  })
}).superRefine((value, context) => {
  if (!value.details.subjectId && !value.details.customSubjectName?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["details", "subjectId"],
      message: "Выберите предмет или укажите свой вариант."
    });
  }
});

export const requestInputSchema = z
  .discriminatedUnion("scenario", [
    caseRequestSchema,
    projectRequestSchema,
    studyRequestSchema
  ])
  .transform((value) => ({
    ...value,
    notes: value.notes?.trim() || null,
    availabilitySlots: [...value.availabilitySlots]
      .map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startMinute: slot.startMinute,
        endMinute: slot.endMinute
      }))
      .sort((left, right) => {
        if (left.dayOfWeek === right.dayOfWeek) {
          return left.startMinute - right.startMinute;
        }

        return left.dayOfWeek.localeCompare(right.dayOfWeek);
      })
  }));

export type RequestInput = z.infer<typeof requestInputSchema>;

export type SerializedRequest = {
  id: string;
  scenario: RequestScenario;
  status: "ACTIVE" | "EXPIRED" | "CLOSED" | "DELETED";
  notes: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  lastMatchedAt: string | null;
  closedAt: string | null;
  availabilitySlots: {
    dayOfWeek: (typeof dayOfWeekValues)[number];
    startMinute: number;
    endMinute: number;
  }[];
  details:
    | {
        type: "CASE";
        eventName: string;
        deadline: string | null;
        neededRoles: (typeof collaborationRoleValues)[number][];
        teamGapSize: number;
        preferredFormat: (typeof formatValues)[number];
      }
    | {
        type: "PROJECT";
        projectTitle: string;
        shortDescription: string;
        stage: (typeof projectStageValues)[number];
        neededRoles: (typeof collaborationRoleValues)[number][];
        expectedCommitment: (typeof commitmentValues)[number];
        preferredFormat: (typeof formatValues)[number];
      }
    | {
        type: "STUDY";
        subjectId: string;
        subjectName: string;
        subjectSlug: string;
        currentContext: string;
        goal: string;
        desiredFrequency: (typeof studyFrequencyValues)[number];
        preferredTime: (typeof preferredTimeValues)[number];
        preferredFormat: (typeof formatValues)[number];
      };
};
