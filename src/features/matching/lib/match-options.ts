import { requestScenarioOptions } from "@/features/requests/lib/request-options";

import type {
  MatchChatReadiness,
  MatchModeValue,
  MatchStatusValue,
  SerializedMatchListItem
} from "@/features/matching/lib/match-types";

export const matchModeLabels: Record<MatchModeValue, string> = {
  REQUEST_TO_REQUEST: "У вас совпали запросы",
  REQUEST_TO_PROFILE: "Человек подходит под запрос"
};

export const matchStatusLabels: Record<MatchStatusValue, string> = {
  READY: "Можно откликнуться",
  PENDING_RECIPIENT_ACCEPTANCE: "Отклик отправлен",
  DECLINED: "Отклонено",
  EXPIRED: "Истекло",
  CLOSED: "Неактивно"
};

export const matchStatusTone: Record<
  MatchStatusValue,
  "neutral" | "warning" | "success"
> = {
  READY: "success",
  PENDING_RECIPIENT_ACCEPTANCE: "warning",
  DECLINED: "neutral",
  EXPIRED: "neutral",
  CLOSED: "neutral"
};

export const chatReadinessLabels: Record<MatchChatReadiness, string> = {
  READY_FOR_CHAT: "Можно связаться",
  INVITE_REQUIRED: "Нужно подтверждение"
};

export type MatchUiStatus = {
  label: string;
  tone: "neutral" | "warning" | "success";
  nextAction: string;
  canAct: boolean;
};

export function getMatchUiStatus(
  match: Pick<
    SerializedMatchListItem,
    "chatReadiness" | "mode" | "status" | "response"
  >
): MatchUiStatus {
  if (match.response.status === "ACCEPTED") {
    return {
      label: "Отклик принят",
      tone: "success",
      nextAction: match.response.telegramUrl
        ? "Написать в Telegram"
        : "Посмотреть контакт",
      canAct: Boolean(match.response.telegramUrl)
    };
  }

  if (match.response.status === "RECEIVED") {
    return {
      label: "Новый отклик",
      tone: "warning",
      nextAction: "Посмотреть отклик",
      canAct: true
    };
  }

  if (match.response.status === "SENT") {
    return {
      label: "Отклик отправлен",
      tone: "warning",
      nextAction: "Ждём ответа",
      canAct: false
    };
  }

  if (match.response.status === "DECLINED") {
    return {
      label: "Отклонено",
      tone: "neutral",
      nextAction: "Можно посмотреть другие варианты",
      canAct: false
    };
  }

  if (match.response.canSendIntro) {
    return {
      label: "Можно откликнуться",
      tone: "success",
      nextAction: "Откликнуться",
      canAct: true
    };
  }

  if (match.status === "DECLINED") {
    return {
      label: "Отклонено",
      tone: "neutral",
      nextAction: "Можно посмотреть другие совпадения",
      canAct: false
    };
  }

  if (match.status === "EXPIRED") {
    return {
      label: "Истекло",
      tone: "neutral",
      nextAction: "Обновите подборку",
      canAct: false
    };
  }

  if (match.status === "CLOSED") {
    return {
      label: "Неактивно",
      tone: "neutral",
      nextAction: "Запрос больше не участвует в подборе",
      canAct: false
    };
  }

  if (match.status === "PENDING_RECIPIENT_ACCEPTANCE") {
    return {
      label: "Отклик отправлен",
      tone: "warning",
      nextAction: "Ждём ответа",
      canAct: false
    };
  }

  if (match.chatReadiness === "INVITE_REQUIRED") {
    return {
      label: "Можно откликнуться",
      tone: "success",
      nextAction: "Откликнуться",
      canAct: true
    };
  }

  if (match.mode === "REQUEST_TO_PROFILE") {
    return {
      label: "Можно откликнуться",
      tone: "success",
      nextAction: "Откликнуться",
      canAct: true
    };
  }

  return {
    label: "Можно откликнуться",
    tone: "success",
    nextAction: "Откликнуться",
    canAct: true
  };
}

export const scenarioLabelByValue = Object.fromEntries(
  requestScenarioOptions.map((scenario) => [scenario.value, scenario.label])
) as Record<(typeof requestScenarioOptions)[number]["value"], string>;
