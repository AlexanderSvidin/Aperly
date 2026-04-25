import studyCatalog from "@/features/study/lib/study-catalog.json";

export type StudyLevelId = "BACHELOR" | "MASTER";
export type EnglishLevelId = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type StudyProgramOption = {
  id: string;
  label: string;
  levelId: StudyLevelId;
};

export type StudyCatalogSubjectMeta = {
  slug: string;
  name: string;
  levelId: StudyLevelId;
  programId: string;
  courseYear: number;
};

export type StudySubjectLookup = {
  id: string;
  slug: string;
  name: string;
  levelId: StudyLevelId | null;
  programId: string | null;
  courseYear: number | null;
  kind: "PROGRAM" | "ENGLISH" | "CUSTOM" | "OTHER";
  englishLevel: EnglishLevelId | null;
  searchText: string;
};

export const studyLevelOptions = studyCatalog.levels.map((level) => ({
  value: level.id as StudyLevelId,
  label: level.label
})) as readonly {
  value: StudyLevelId;
  label: string;
}[];

export const englishLevelOptions = studyCatalog.englishLevels.map((entry) => ({
  value: entry.level as EnglishLevelId,
  label: entry.level
})) as readonly {
  value: EnglishLevelId;
  label: string;
}[];

export const studyProgramOptions = studyCatalog.levels.flatMap((level) =>
  level.programs.map((program) => ({
    id: program.id,
    label: program.label,
    levelId: level.id as StudyLevelId
  }))
) as StudyProgramOption[];

export const studyCatalogSubjects = studyCatalog.subjects as StudyCatalogSubjectMeta[];

const subjectMetaBySlug = new Map(
  studyCatalogSubjects.map((subject) => [subject.slug, subject])
);

const englishMetaBySlug = new Map(
  studyCatalog.englishLevels.map((entry) => [
    entry.slug,
    {
      slug: entry.slug,
      name: entry.name,
      englishLevel: entry.level as EnglishLevelId
    }
  ])
);

const programById = new Map(studyProgramOptions.map((program) => [program.id, program]));

const legacyProgramMap: Record<string, string> = {
  management: "ba-business-management",
  economics: "ba-international-business-economics",
  marketing: "ba-business-management",
  "computer science": "ba-software-engineering-business-informatics",
  sociology: "ba-business-management",
  "business informatics": "ba-software-engineering-business-informatics",
  "public policy": "ma-public-municipal-management",
  design: "ba-creative-industries-management",
  finance: "ma-financial-strategies-analytics"
};

const subjectSearchAliases: Record<string, string> = {
  "business-ethics-sustainability": "этика бизнеса устойчивое развитие",
  "english-course": "английский английский язык",
  "independent-english-exam": "английский независимый экзамен",
  "marketing": "маркетинг",
  "machine-learning-economics-finance": "машинное обучение экономика финансы",
  "strategic-management": "стратегический менеджмент",
  "finance-and-society": "финансы общество",
  "project-proposal": "проект проектное предложение",
  "managing-talent": "управление талантами персонал",
  "economic-growth": "экономический рост"
};

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function getProgramsForLevel(levelId: StudyLevelId) {
  return studyProgramOptions.filter((program) => program.levelId === levelId);
}

export function getProgramById(programId: string | null | undefined) {
  if (!programId) {
    return null;
  }

  return programById.get(programId) ?? null;
}

export function getProgramLabel(programId: string | null | undefined) {
  if (!programId) {
    return null;
  }

  return getProgramById(programId)?.label ?? null;
}

export function normalizeStoredProgramId(programId: string | null | undefined) {
  if (!programId) {
    return null;
  }

  if (programById.has(programId)) {
    return programId;
  }

  return legacyProgramMap[normalizeKey(programId)] ?? null;
}

export function getLevelForProgramId(programId: string | null | undefined) {
  const normalizedProgramId = normalizeStoredProgramId(programId);

  if (!normalizedProgramId) {
    return "BACHELOR" as StudyLevelId;
  }

  return getProgramById(normalizedProgramId)?.levelId ?? "BACHELOR";
}

export function getCourseOptionsForProgram(programId: string | null | undefined) {
  const normalizedProgramId = normalizeStoredProgramId(programId);

  if (!normalizedProgramId) {
    return [1, 2, 3, 4];
  }

  const courseYears = [
    ...new Set(
      studyCatalogSubjects
        .filter((subject) => subject.programId === normalizedProgramId)
        .map((subject) => subject.courseYear)
    )
  ].sort((left, right) => left - right);

  if (courseYears.length > 0) {
    return courseYears;
  }

  const levelId = getProgramById(normalizedProgramId)?.levelId;

  return levelId === "MASTER" ? [1, 2] : [1, 2, 3, 4];
}

export function enrichSubjectLookup(subject: {
  id: string;
  slug: string;
  name: string;
}): StudySubjectLookup {
  const programMeta = subjectMetaBySlug.get(subject.slug);
  const englishMeta = englishMetaBySlug.get(subject.slug);

  if (programMeta) {
    return {
      ...subject,
      levelId: programMeta.levelId,
      programId: programMeta.programId,
      courseYear: programMeta.courseYear,
      kind: "PROGRAM",
      englishLevel: null,
      searchText: normalizeSearchText(
        `${subject.name} ${programMeta.name} ${subjectSearchAliases[subject.slug] ?? ""}`
      )
    };
  }

  if (englishMeta) {
    return {
      ...subject,
      levelId: null,
      programId: null,
      courseYear: null,
      kind: "ENGLISH",
      englishLevel: englishMeta.englishLevel,
      searchText: normalizeSearchText(`${subject.name} английский ${englishMeta.englishLevel}`)
    };
  }

  return {
    ...subject,
    levelId: null,
    programId: null,
    courseYear: null,
    kind: subject.slug.startsWith("custom-") ? "CUSTOM" : "OTHER",
    englishLevel: null,
    searchText: normalizeSearchText(subject.name)
  };
}

export function buildSubjectSeedData() {
  return [
    ...studyCatalogSubjects.map((subject) => ({
      slug: subject.slug,
      name: subject.name
    })),
    ...studyCatalog.englishLevels.map((entry) => ({
      slug: entry.slug,
      name: entry.name
    }))
  ];
}

export function createCustomSubjectSlug(name: string) {
  const normalized = normalizeSearchText(name)
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `custom-${normalized || "subject"}`;
}
