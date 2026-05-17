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
  /zod/i,
  /undefined/i,
  /null/i,
  /cannot read/i,
  /is not a function/i,
  /\bat\s+\w/,
  /\bTypeError\b/,
  /\bSyntaxError\b/,
  /\bRangeError\b/
];

const messageByCode: Record<string, string> = {
  // Запросы
  request_not_found:
    "Запрос не найден. Обновите экран и попробуйте ещё раз.",
  request_not_editable:
    "Этот запрос уже нельзя изменить. Обновите экран и попробуйте ещё раз.",
  request_not_pausable:
    "Поставить на паузу можно только активный запрос.",
  request_not_resumable:
    "Возобновить можно только запрос на паузе или истёкший запрос.",
  request_archived:
    "Архивный или удалённый запрос нельзя изменить.",
  request_scenario_locked:
    "Тип запроса нельзя изменить после создания.",
  request_actor_forbidden:
    "Для этого действия нужен активный профиль.",
  request_onboarding_required:
    "Сначала завершите профиль, затем попробуйте ещё раз.",
  request_rate_limit:
    "Слишком много запросов подряд. Подождите немного и попробуйте ещё раз.",
  // Матчинг
  match_request_not_found:
    "Не удалось найти запрос для подбора. Обновите экран.",
  match_already_invited:
    "Вы уже пригласили этого человека.",
  match_not_found:
    "Подборка не найдена. Обновите экран.",
  match_expired:
    "Подборка устарела. Обновите страницу — появятся свежие результаты.",
  // Связи / отклики
  interaction_not_found:
    "Отклик или приглашение не найдено. Обновите экран.",
  interaction_message_too_long:
    "Сообщение слишком длинное. Сократите его и попробуйте ещё раз.",
  connection_actor_forbidden:
    "Для управления связями нужен активный профиль.",
  connection_not_found:
    "Связь не найдена. Обновите экран.",
  // Чаты
  chat_not_found:
    "Чат не найден. Обновите экран.",
  chat_access_denied:
    "Нет доступа к этому чату.",
  // Профиль
  profile_not_found:
    "Профиль не найден. Попробуйте перезайти.",
  profile_forbidden:
    "Это действие недоступно для вашего аккаунта.",
  // Общие
  unauthorized:
    "Сессия устарела. Пожалуйста, войдите снова.",
  forbidden:
    "Нет прав на это действие.",
  rate_limited:
    "Слишком много запросов. Подождите немного и повторите.",
  server_error:
    "Что-то пошло не так на сервере. Попробуйте ещё раз.",
  network_error:
    "Проверьте интернет и попробуйте ещё раз."
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
