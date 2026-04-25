import type { Prisma } from "@prisma/client";

export const MATCH_ACTIVE_USER_STATUS = "ACTIVE";
export const MATCH_ACTIVE_REQUEST_STATUS = "ACTIVE";

export function buildEligibleRequestWhere(
  now = new Date()
): Prisma.RequestWhereInput {
  return {
    status: MATCH_ACTIVE_REQUEST_STATUS,
    expiresAt: {
      gt: now
    },
    owner: {
      is: {
        status: MATCH_ACTIVE_USER_STATUS,
        blockedAt: null,
        deletedAt: null
      }
    }
  };
}

export function buildDiscoverableFallbackProfileWhere(
  scenario: "CASE" | "PROJECT" | "STUDY",
  requestingUserId?: string,
  now = new Date()
): Prisma.ProfileWhereInput {
  return {
    isDiscoverable: true,
    discoverableScenarios: {
      has: scenario
    },
    user: {
      is: {
        status: MATCH_ACTIVE_USER_STATUS,
        blockedAt: null,
        deletedAt: null,
        ...(requestingUserId
          ? {
              id: {
                not: requestingUserId
              }
            }
          : {}),
        requests: {
          none: {
            scenario,
            status: MATCH_ACTIVE_REQUEST_STATUS,
            expiresAt: {
              gt: now
            }
          }
        }
      }
    }
  };
}
