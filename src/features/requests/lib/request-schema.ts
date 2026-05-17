import { z } from "zod";

import { maxRequestAvailabilitySlots } from "@/features/requests/lib/request-options";

const scenarioValues = ["CASE", "PROJECT", "STUDY", "ACTIVITY"] as const;
const activitySubtypeValues = ["CLUB", "MEETING", "SPORT", "HOBBY", "OTHER"] as const;
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
  notes: z.string().trim().optional().nullable()
});

const caseRequestSchema = baseRequestSchema.extend({
  scenario: z.literal("CASE"),
  availabilitySlots: z.array(availabilitySlotSchema).max(maxRequestAvailabilitySlots).default([]),
  details: z.object({
    eventName: z.string().trim().min(2).max(240),
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
      .default([]),
    teamGapSize: z.number().int().min(1).max(8),
    preferredFormat: z.enum(formatValues)
  })
}).superRefine((value, context) => {
  if (value.details.neededRoles.length === 0 && !value.notes?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["details", "neededRoles"],
      message: "Добавьте хотя бы одну роль или короткий комментарий к запросу."
    });
  }
});

const projectRequestSchema = baseRequestSchema.extend({
  scenario: z.literal("PROJECT"),
  availabilitySlots: z.array(availabilitySlotSchema).max(maxRequestAvailabilitySlots).default([]),
  details: z.object({
    projectTitle: z.string().trim().min(2).max(240),
    shortDescription: z.string().trim().optional().default(""),
    stage: z.enum(projectStageValues),
    neededRoles: z
      .array(z.enum(collaborationRoleValues))
      .default([]),
    expectedCommitment: z.enum(commitmentValues),
    preferredFormat: z.enum(formatValues)
  })
}).superRefine((value, context) => {
  if (
    value.details.neededRoles.length === 0 &&
    value.details.shortDescription.trim().length < 2 &&
    !value.notes?.trim()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["details", "neededRoles"],
      message: "Добавьте хотя бы одну роль или коротко опишите, кто нужен."
    });
  }
});

const studyDetailsSchema = z
  .object({
    subjectIds: z.array(z.string().uuid()).optional().default([]),
    customSubjectNames: z
      .array(z.string().trim().min(2).max(240))
      .optional()
      .default([]),
    subjectId: z.string().uuid().optional().nullable(),
    customSubjectName: z.string().trim().min(2).max(240).optional().nullable(),
    currentContext: z.string().trim().optional().default(""),
    goal: z.string().trim().optional().default(""),
    desiredFrequency: z.enum(studyFrequencyValues),
    preferredTime: z.enum(preferredTimeValues),
    preferredFormat: z.enum(formatValues)
  })
  .transform((details) => ({
    ...details,
    subjectIds: [
      ...new Set([
        ...details.subjectIds,
        ...(details.subjectId ? [details.subjectId] : [])
      ])
    ],
    customSubjectNames: [
      ...new Set(
        [
          ...details.customSubjectNames,
          ...(details.customSubjectName ? [details.customSubjectName] : [])
        ].map((name) => name.replace(/\s+/g, " ").trim())
      )
    ].filter(Boolean)
  }));

const studyRequestSchema = baseRequestSchema.extend({
  scenario: z.literal("STUDY"),
  availabilitySlots: z.array(availabilitySlotSchema).max(maxRequestAvailabilitySlots).default([]),
  details: studyDetailsSchema
}).superRefine((value, context) => {
  const hasSubjects =
    value.details.subjectIds.length > 0 ||
    value.details.customSubjectNames.length > 0;
  const hasComment =
    Boolean(value.details.currentContext.trim()) ||
    Boolean(value.details.goal.trim()) ||
    Boolean(value.notes?.trim());

  if (!hasSubjects && !hasComment) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["details", "subjectIds"],
      message: "Выберите хотя бы один предмет или добавьте комментарий к учебному запросу."
    });
  }
});

const activityRequestSchema = baseRequestSchema.extend({
  scenario: z.literal("ACTIVITY"),
  availabilitySlots: z.array(availabilitySlotSchema).max(maxRequestAvailabilitySlots).default([]),
  details: z.object({
    title: z.string().trim().min(2).max(240),
    activitySubtype: z.enum(activitySubtypeValues),
    time: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value ? value : null))
      .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
        message: "Дата активности некорректна."
      }),
    preferredFormat: z.enum(formatValues),
    location: z.string().trim().max(240).optional().nullable(),
    peopleCount: z.number().int().min(1).max(50),
    recurrence: z.enum(studyFrequencyValues),
    comment: z.string().trim().optional().nullable()
  })
}).superRefine((value, context) => {
  if (!value.details.time && value.details.recurrence === "ONCE") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["details", "time"],
      message: "Для разовой активности укажите дату или выберите регулярность."
    });
  }
});

export const requestInputSchema = z
  .discriminatedUnion("scenario", [
    caseRequestSchema,
    projectRequestSchema,
    studyRequestSchema,
    activityRequestSchema
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
  status:
    | "DRAFT"
    | "ACTIVE"
    | "EXPIRED"
    | "PAUSED"
    | "CLOSED"
    | "ARCHIVED"
    | "DELETED";
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
        subjects: {
          id: string;
          name: string;
          slug: string;
        }[];
        currentContext: string;
        goal: string;
        desiredFrequency: (typeof studyFrequencyValues)[number];
        preferredTime: (typeof preferredTimeValues)[number];
        preferredFormat: (typeof formatValues)[number];
      }
    | {
        type: "ACTIVITY";
        title: string;
        activitySubtype: (typeof activitySubtypeValues)[number];
        time: string | null;
        preferredFormat: (typeof formatValues)[number];
        location: string | null;
        peopleCount: number;
        recurrence: (typeof studyFrequencyValues)[number];
        comment: string | null;
      };
};
