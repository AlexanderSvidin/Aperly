import {
  dayOfWeekOptions,
  formatOptions,
  minuteToTimeValue,
  timeValueToMinute
} from "@/features/profile/lib/profile-options";

export const requestScenarioOptions = [
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

export const collaborationRoleOptions = [
  {
    value: "ANALYST",
    label: "Аналитик"
  },
  {
    value: "DEVELOPER",
    label: "Разработчик"
  },
  {
    value: "DESIGNER",
    label: "Дизайнер"
  },
  {
    value: "PRODUCT_MANAGER",
    label: "Продакт"
  },
  {
    value: "RESEARCHER",
    label: "Исследователь"
  },
  {
    value: "MARKETER",
    label: "Маркетолог"
  },
  {
    value: "FINANCE",
    label: "Финансы"
  },
  {
    value: "PRESENTER",
    label: "Презентующий"
  },
  {
    value: "OTHER",
    label: "Другое"
  }
] as const;

export const projectStageOptions = [
  {
    value: "IDEA",
    label: "Идея"
  },
  {
    value: "MVP",
    label: "Первый рабочий вариант"
  },
  {
    value: "EARLY_TRACTION",
    label: "Первые пользователи"
  },
  {
    value: "OPERATING",
    label: "Уже работает"
  }
] as const;

export const commitmentOptions = [
  {
    value: "LIGHT",
    label: "Небольшая нагрузка"
  },
  {
    value: "PART_TIME",
    label: "Частичная занятость"
  },
  {
    value: "HEAVY",
    label: "Серьёзная вовлечённость"
  },
  {
    value: "FLEXIBLE",
    label: "Гибко"
  }
] as const;

export const studyFrequencyOptions = [
  {
    value: "ONCE",
    label: "Один раз"
  },
  {
    value: "WEEKLY",
    label: "Раз в неделю"
  },
  {
    value: "TWICE_WEEKLY",
    label: "Два раза в неделю"
  },
  {
    value: "FLEXIBLE",
    label: "Гибко"
  }
] as const;

export const preferredTimeOptions = [
  {
    value: "MORNING",
    label: "Утром"
  },
  {
    value: "AFTERNOON",
    label: "Днём"
  },
  {
    value: "EVENING",
    label: "Вечером"
  },
  {
    value: "FLEXIBLE",
    label: "Гибко"
  }
] as const;

export const requestStatusLabels: Record<string, string> = {
  ACTIVE: "Активен",
  EXPIRED: "Истёк",
  CLOSED: "В архиве",
  DELETED: "Удалён"
};

export const requestStatusTone: Record<string, "neutral" | "warning" | "success"> = {
  ACTIVE: "success",
  EXPIRED: "warning",
  CLOSED: "neutral",
  DELETED: "neutral"
};

export const requestExpiryDays = {
  CASE: 21,
  PROJECT: 21,
  STUDY: 14
} as const;

export const maxRequestAvailabilitySlots = 4;

export const requestFormatOptions = formatOptions;
export const requestDayOfWeekOptions = dayOfWeekOptions;

export function getDefaultExpiryDaysForScenario(
  scenario: keyof typeof requestExpiryDays
) {
  return requestExpiryDays[scenario];
}

export function minuteRangeToLabel(startMinute: number, endMinute: number) {
  return `${minuteToTimeValue(startMinute)}-${minuteToTimeValue(endMinute)}`;
}

export function timeLabelToMinute(value: string) {
  return timeValueToMinute(value);
}

export function toDateInputValue(dateString: string | null | undefined) {
  if (!dateString) {
    return "";
  }

  return new Date(dateString).toISOString().slice(0, 10);
}

export function formatRequestDate(dateString: string | null | undefined) {
  if (!dateString) {
    return "Не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long"
  }).format(new Date(dateString));
}
