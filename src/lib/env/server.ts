import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

const telegramServerEnvSchema = z.object({
  APP_SESSION_SECRET: z.string().min(32),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
  ALLOW_DEV_TELEGRAM_FALLBACK: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DEV_TELEGRAM_INIT_DATA: z.string().optional(),
  DEV_TELEGRAM_USER_ID: z.coerce.number().int().positive().default(700099000),
  DEV_TELEGRAM_FIRST_NAME: z.string().default("Aperly"),
  DEV_TELEGRAM_LAST_NAME: z.string().default("Dev"),
  DEV_TELEGRAM_USERNAME: z.string().default("aperly_dev"),
  DEV_TELEGRAM_LANGUAGE_CODE: z.string().default("ru")
});

export const databaseEnv = databaseEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});

export const telegramServerEnv = telegramServerEnvSchema.parse({
  APP_SESSION_SECRET: process.env.APP_SESSION_SECRET,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS:
    process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
  ALLOW_DEV_TELEGRAM_FALLBACK: process.env.ALLOW_DEV_TELEGRAM_FALLBACK,
  DEV_TELEGRAM_INIT_DATA: process.env.DEV_TELEGRAM_INIT_DATA,
  DEV_TELEGRAM_USER_ID: process.env.DEV_TELEGRAM_USER_ID,
  DEV_TELEGRAM_FIRST_NAME: process.env.DEV_TELEGRAM_FIRST_NAME,
  DEV_TELEGRAM_LAST_NAME: process.env.DEV_TELEGRAM_LAST_NAME,
  DEV_TELEGRAM_USERNAME: process.env.DEV_TELEGRAM_USERNAME,
  DEV_TELEGRAM_LANGUAGE_CODE: process.env.DEV_TELEGRAM_LANGUAGE_CODE
});
