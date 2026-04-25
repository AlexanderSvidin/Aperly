import { NextResponse } from "next/server";

import {
  courseYearOptions,
  dayOfWeekOptions,
  formatOptions,
  scenarioOptions
} from "@/features/profile/lib/profile-options";
import {
  studyLevelOptions,
  studyProgramOptions
} from "@/features/study/lib/study-catalog";
import { profileService } from "@/server/services/profile/profile-service";

export async function GET() {
  const lookups = await profileService.getLookups();

  return NextResponse.json({
    ...lookups,
    courseYears: courseYearOptions,
    days: dayOfWeekOptions,
    formats: formatOptions,
    scenarios: scenarioOptions,
    studyLevels: studyLevelOptions,
    programs: studyProgramOptions
  });
}
