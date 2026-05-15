import { NextResponse } from "next/server";

export const legacyChatDisabledPayload = {
  error: "Legacy chat flow is disabled. Use connections flow."
};

export function legacyChatDisabledResponse() {
  return NextResponse.json(legacyChatDisabledPayload, {
    status: 410
  });
}
