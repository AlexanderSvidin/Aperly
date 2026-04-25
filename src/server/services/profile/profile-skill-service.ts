import { prisma } from "@/server/db/client";

type SkillClient = Pick<typeof prisma, "skill">;

function normalizeCustomSkillName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function createCustomSkillSlug(name: string) {
  const normalized = normalizeCustomSkillName(name)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `custom-${normalized || "skill"}`;
}

async function createUniqueCustomSkill(client: SkillClient, name: string) {
  const baseSlug = createCustomSkillSlug(name);
  let attempt = 0;

  while (attempt < 5) {
    const slug =
      attempt === 0 ? baseSlug : `${baseSlug}-${Date.now().toString(36)}-${attempt}`;

    try {
      return await client.skill.create({
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

  throw new Error("Не удалось создать пользовательский навык.");
}

export async function resolveSkillIdsWithCustomNames(
  client: SkillClient,
  input: {
    skillIds: string[];
    customSkillNames?: string[];
  }
) {
  const customSkillNames = [
    ...new Set((input.customSkillNames ?? []).map(normalizeCustomSkillName))
  ].filter(Boolean);

  if (customSkillNames.length === 0) {
    return [...new Set(input.skillIds)];
  }

  const customSkillIds: string[] = [];

  for (const name of customSkillNames) {
    const existingSkill = await client.skill.findFirst({
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

    if (existingSkill) {
      customSkillIds.push(existingSkill.id);
      continue;
    }

    const createdSkill = await createUniqueCustomSkill(client, name);
    customSkillIds.push(createdSkill.id);
  }

  return [...new Set([...input.skillIds, ...customSkillIds])];
}
