const technicalMessagePatterns = [
  /invalid/i,
  /required/i,
  /expected/i,
  /received/i,
  /uuid/i,
  /failed/i,
  /error/i,
  /prisma/i,
  /stack/i,
  /zod/i
];

const messageByCode: Record<string, string> = {
  interaction_message_too_long:
    "Сообщение слишком длинное. Сократите его и попробуйте ещё раз.",
  match_request_not_found:
    "Не удалось найти запрос. Обновите экран и попробуйте ещё раз.",
  request_not_found:
    "Не удалось найти запрос. Обновите экран и попробуйте ещё раз.",
  request_not_editable:
    "Этот запрос уже нельзя изменить. Обновите экран и попробуйте ещё раз.",
  request_onboarding_required:
    "Сначала завершите профиль, затем попробуйте ещё раз."
};

export function getUserErrorMessage(
  input: {
    code?: string | null;
    message?: string | null;
  } | null | undefined,
  fallback = "Не удалось выполнить действие. Попробуйте ещё раз."
) {
  if (input?.code && messageByCode[input.code]) {
    return messageByCode[input.code];
  }

  const message = input?.message?.trim();

  if (!message) {
    return fallback;
  }

  if (technicalMessagePatterns.some((pattern) => pattern.test(message))) {
    console.warn("[Aperly] technical error hidden from UI", input);
    return fallback;
  }

  return message;
}

export function getUserIssueMessages(issues: unknown[] | undefined) {
  if (!issues) {
    return [];
  }

  return issues
    .map((issue) => {
      if (
        issue &&
        typeof issue === "object" &&
        "message" in issue &&
        typeof issue.message === "string"
      ) {
        return getUserErrorMessage(
          { message: issue.message },
          "Проверьте это поле и попробуйте ещё раз."
        );
      }

      return null;
    })
    .filter(Boolean) as string[];
}
