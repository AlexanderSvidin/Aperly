/**
 * Deprecated legacy in-app chat.
 * Disabled for Product Logic v2.0.
 * All /api/chats/** endpoints return 410 Gone.
 * Use Connection → Telegram handoff instead (/connections/:id).
 */
import { NextResponse } from "next/server";

export const legacyChatDisabledPayload = {
  error: "Legacy chat flow is disabled. Use connections flow."
};

export function legacyChatDisabledResponse() {
  return NextResponse.json(legacyChatDisabledPayload, {
    status: 410
  });
}
