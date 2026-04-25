/**
 * Telegram Bot push-notification helpers.
 *
 * Rules:
 *  - All functions are fire-and-forget at the call site — errors are caught
 *    here and logged but never propagated, so a notification failure can never
 *    break user-facing flows.
 *  - Notifications are skipped when the recipient was active in the last 60 s
 *    (determined by their last outgoing message timestamp) to avoid spamming
 *    users who are already looking at the chat.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

// --------------------------------------------------------------------------
// Core send function
// --------------------------------------------------------------------------

export interface NotifyNewMessageParams {
  /** Numeric Telegram user ID of the person who should receive the push. */
  recipientTelegramId: string;
  /** Display name of the message sender shown in the notification text. */
  senderName: string;
  /** Aperly chat ID — used to build the deep-link into the Mini App. */
  chatId: string;
  /** Bot token from @BotFather (TELEGRAM_BOT_TOKEN env var). */
  botToken: string;
  /** Public HTTPS URL of the Mini App (NEXT_PUBLIC_MINI_APP_URL env var). */
  miniAppUrl: string;
}

/**
 * Send a Telegram push notification when a new chat message arrives.
 *
 * Throws on network / API errors — wrap in try/catch at the call site
 * if you want silent failure.
 */
export async function notifyNewMessage(
  params: NotifyNewMessageParams
): Promise<void> {
  const { recipientTelegramId, senderName, chatId, botToken, miniAppUrl } =
    params;

  // Strip trailing slash from the base URL so the deep-link is always clean.
  const baseUrl = miniAppUrl.replace(/\/$/, "");
  const deepLink = `${baseUrl}?startapp=chat_${chatId}`;

  const payload = {
    chat_id: recipientTelegramId,
    text: `💬 ${senderName} написал(а) тебе в Aperly`,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Открыть чат",
            url: deepLink
          }
        ]
      ]
    }
  };

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    throw new Error(
      `Telegram sendMessage failed [${response.status}]: ${body}`
    );
  }
}

// --------------------------------------------------------------------------
// Integration helper — called from chat-service.ts (fire-and-forget)
// --------------------------------------------------------------------------

import { prisma } from "@/server/db/client";

/** How recent (ms) the recipient's last message must be to skip notification. */
const ACTIVE_WINDOW_MS = 60_000; // 60 seconds

/**
 * Look up the recipient's Telegram ID and the sender's display name, check
 * for recent activity, then dispatch a push notification.
 *
 * This function never throws — all errors are swallowed so callers can use
 * `void tryNotifyRecipient(...)` without risk.
 */
export async function tryNotifyRecipient(
  senderId: string,
  chatId: string,
  userAId: string,
  userBId: string
): Promise<void> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL;

    // Skip silently if the bot is not configured (local dev without token).
    if (!botToken || !miniAppUrl) return;

    const recipientId = userAId === senderId ? userBId : userAId;

    // Check whether the recipient sent a message in the last 60 seconds.
    // If so, they're likely still looking at the chat — skip the notification.
    const activeWindowStart = new Date(Date.now() - ACTIVE_WINDOW_MS);
    const recentActivity = await prisma.message.findFirst({
      where: {
        chatId,
        senderId: recipientId,
        type: "USER",
        createdAt: { gte: activeWindowStart }
      },
      select: { id: true }
    });

    if (recentActivity) return;

    // Fetch recipient's Telegram ID and sender's display name in parallel.
    const [recipient, sender] = await Promise.all([
      prisma.user.findUnique({
        where: { id: recipientId },
        select: { telegramId: true, status: true }
      }),
      prisma.user.findUnique({
        where: { id: senderId },
        select: {
          firstName: true,
          lastName: true,
          profile: { select: { fullName: true } }
        }
      })
    ]);

    // Skip if the recipient doesn't exist or is blocked/deleted.
    if (
      !recipient?.telegramId ||
      recipient.status === "BLOCKED" ||
      recipient.status === "DELETED"
    ) {
      return;
    }

    const senderName =
      sender?.profile?.fullName ||
      [sender?.firstName, sender?.lastName].filter(Boolean).join(" ").trim() ||
      "Пользователь";

    await notifyNewMessage({
      recipientTelegramId: recipient.telegramId.toString(),
      senderName,
      chatId,
      botToken,
      miniAppUrl
    });
  } catch {
    // Intentionally silent — notification failures must never surface to users.
  }
}
