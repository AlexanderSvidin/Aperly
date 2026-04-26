import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Aperly"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_MINI_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().default("aperly_dev_bot"),
  NEXT_PUBLIC_ENABLE_DEV_TELEGRAM_FALLBACK: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

const parsedClientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_MINI_APP_URL: process.env.NEXT_PUBLIC_MINI_APP_URL,
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME:
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
  NEXT_PUBLIC_ENABLE_DEV_TELEGRAM_FALLBACK:
    process.env.NEXT_PUBLIC_ENABLE_DEV_TELEGRAM_FALLBACK
});

export const clientEnv = {
  ...parsedClientEnv,
  NEXT_PUBLIC_MINI_APP_URL:
    parsedClientEnv.NEXT_PUBLIC_MINI_APP_URL ?? parsedClientEnv.NEXT_PUBLIC_APP_URL
};
