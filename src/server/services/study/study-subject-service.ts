import { prisma } from "@/server/db/client";
import {
  buildSubjectSeedData,
  createCustomSubjectSlug,
  enrichSubjectLookup,
  type StudySubjectLookup
} from "@/features/study/lib/study-catalog";

type SubjectClient = Pick<typeof prisma, "subject">;

const catalogSubjectSeeds = buildSubjectSeedData();
const languageSubjectSlugs = [
  "english-a1",
  "english-a2",
  "english-b1",
  "english-b2",
  "english-c1",
  "english-c2",
  "english-course",
  "independent-english-exam"
];

function normalizeCustomSubjectName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function syncStudyCatalogSubjects(client: SubjectClient = prisma) {
  const catalogSlugs = catalogSubjectSeeds.map((subject) => subject.slug);
  const existingSubjects = await client.subject.findMany({
    where: {
      slug: {
        in: catalogSlugs
      }
    },
    select: {
      slug: true,
      name: true
    }
  });

  const existingBySlug = new Map(
    existingSubjects.map((subject) => [subject.slug, subject.name])
  );

  const missingSubjects = catalogSubjectSeeds.filter(
    (subject) => !existingBySlug.has(subject.slug)
  );

  if (missingSubjects.length > 0) {
    await client.subject.createMany({
      data: missingSubjects,
      skipDuplicates: true
    });
  }

  for (const subject of catalogSubjectSeeds) {
    const existingName = existingBySlug.get(subject.slug);

    if (existingName && existingName !== subject.name) {
      await client.subject.update({
        where: {
          slug: subject.slug
        },
        data: {
          name: subject.name
        }
      });
    }
  }
}

export async function loadStudySubjectLookups(
  client: SubjectClient = prisma
): Promise<StudySubjectLookup[]> {
  await syncStudyCatalogSubjects(client);

  const subjects = await client.subject.findMany({
    where: {
      slug: {
        notIn: languageSubjectSlugs
      }
    },
    orderBy: {
      name: "asc"
    },
    select: {
      id: true,
      name: true,
      slug: true
    }
  });

  return subjects.map(enrichSubjectLookup);
}

async function createUniqueCustomSubject(
  client: SubjectClient,
  name: string
) {
  const baseSlug = createCustomSubjectSlug(name);
  let attempt = 0;

  while (attempt < 5) {
    const slug =
      attempt === 0 ? baseSlug : `${baseSlug}-${Date.now().toString(36)}-${attempt}`;

    try {
      return await client.subject.create({
        data: {
          slug,
          name
        }
      });
    } catch (error) {
      attempt += 1;

      if (attempt >= 5) {
        throw error;
      }
    }
  }

  throw new Error("Не удалось создать пользовательский предмет.");
}

export async function resolveSubjectIdsWithCustomNames(
  client: SubjectClient,
  input: {
    subjectIds: string[];
    customSubjectNames?: string[];
  }
) {
  const customSubjectNames = [...new Set((input.customSubjectNames ?? []).map(normalizeCustomSubjectName))].filter(
    Boolean
  );

  if (customSubjectNames.length === 0) {
    return [...new Set(input.subjectIds)];
  }

  const customSubjectIds: string[] = [];

  for (const name of customSubjectNames) {
    const existingSubject = await client.subject.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive"
        }
      },
      select: {
        id: true
      }
    });

    if (existingSubject) {
      customSubjectIds.push(existingSubject.id);
      continue;
    }

    const createdSubject = await createUniqueCustomSubject(client, name);
    customSubjectIds.push(createdSubject.id);
  }

  return [...new Set([...input.subjectIds, ...customSubjectIds])];
}
