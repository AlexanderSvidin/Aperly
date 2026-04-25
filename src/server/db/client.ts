import { PrismaClient } from "@prisma/client";

import { databaseEnv } from "@/lib/env/server";

declare global {
  var __aperlyPrisma__: PrismaClient | undefined;
}

void databaseEnv;

export const prisma =
  globalThis.__aperlyPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__aperlyPrisma__ = prisma;
}
