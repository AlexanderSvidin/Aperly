export const formatOptions = [
  {
    value: "ONLINE",
    label: "Онлайн"
  },
  {
    value: "OFFLINE",
    label: "Очно"
  },
  {
    value: "HYBRID",
    label: "Гибрид"
  }
] as const;

export const scenarioOptions = [
  {
    value: "CASE",
    label: "Команда на кейс / хакатон"
  },
  {
    value: "PROJECT",
    label: "Проект / стартап / пет-проект"
  },
  {
    value: "STUDY",
    label: "Совместная учёба"
  }
] as const;

export const dayOfWeekOptions = [
  {
    value: "MONDAY",
    label: "Понедельник"
  },
  {
    value: "TUESDAY",
    label: "Вторник"
  },
  {
    value: "WEDNESDAY",
    label: "Среда"
  },
  {
    value: "THURSDAY",
    label: "Четверг"
  },
  {
    value: "FRIDAY",
    label: "Пятница"
  },
  {
    value: "SATURDAY",
    label: "Суббота"
  },
  {
    value: "SUNDAY",
    label: "Воскресенье"
  }
] as const;

export const courseYearOptions = [1, 2, 3, 4, 5, 6] as const;

export const MAX_PROFILE_SKILLS = 6;
export const MAX_PROFILE_SUBJECTS = 6;
export const MAX_PROFILE_LANGUAGES = 1;
export const MAX_AVAILABILITY_SLOTS = 6;

export function minuteToTimeValue(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function timeValueToMinute(value: string) {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  return hours * 60 + minutes;
}
