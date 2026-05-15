import { legacyChatDisabledResponse } from "@/app/api/_legacy-disabled";

export async function GET() {
  return legacyChatDisabledResponse();
}
