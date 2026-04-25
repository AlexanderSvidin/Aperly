import { NextResponse } from "next/server";
import { z } from "zod";

const MINI_APP_URL = "https://aperly.vercel.app";
const START_MESSAGE =
  "Открой Aperly, чтобы найти команду для кейса, проекта или совместной учёбы";

const telegramMessageSchema = z.object({
  chat: z.object({
    id: z.union([z.string(), z.number()])
  }),
  text: z.string().optional()
});

const telegramUpdateSchema = z.object({
  message: telegramMessageSchema.optional()
});

function isStartCommand(text: string | undefined): boolean {
  if (!text) {
    return false;
  }

  const command = text.trim().split(/\s+/)[0];
  return command === "/start" || command.startsWith("/start@");
}

async function sendStartMessage(chatId: string | number): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: START_MESSAGE,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть Aperly",
                web_app: {
                  url: MINI_APP_URL
                }
              }
            ]
          ]
        }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
  }
}

export async function POST(request: Request) {
  const rawUpdate = await request.json().catch(() => null);
  const parsedUpdate = telegramUpdateSchema.safeParse(rawUpdate);

  if (!parsedUpdate.success) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const message = parsedUpdate.data.message;

  if (!message || !isStartCommand(message.text)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await sendStartMessage(message.chat.id);
  } catch (error) {
    console.error("Telegram webhook failed", error);
    return NextResponse.json(
      { ok: false, error: "telegram_send_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
