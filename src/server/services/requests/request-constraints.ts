import type { Prisma } from "@prisma/client";

export const MAX_ACTIVE_REQUESTS_PER_USER_PER_SCENARIO = 1;
export const ACTIVE_REQUEST_STATUS = "ACTIVE";

export function buildActiveRequestDuplicateWhere(
  ownerId: string,
  scenario: "CASE" | "PROJECT" | "STUDY",
  excludeRequestId?: string
): Prisma.RequestWhereInput {
  return {
    ownerId,
    scenario,
    status: ACTIVE_REQUEST_STATUS,
    ...(excludeRequestId
      ? {
          id: {
            not: excludeRequestId
          }
        }
      : {})
  };
}
