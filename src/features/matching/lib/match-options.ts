import { requestScenarioOptions } from "@/features/requests/lib/request-options";

import type {
  MatchChatReadiness,
  MatchModeValue,
  MatchStatusValue
} from "@/features/matching/lib/match-types";

export const matchModeLabels: Record<MatchModeValue, string> = {
  REQUEST_TO_REQUEST: "Запрос к запросу",
  REQUEST_TO_PROFILE: "Профиль из резервного подбора"
};

export const matchStatusLabels: Record<MatchStatusValue, string> = {
  READY: "Готово",
  PENDING_RECIPIENT_ACCEPTANCE: "Нужно приглашение",
  DECLINED: "Отклонено",
  EXPIRED: "Истекло",
  CLOSED: "Закрыто"
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
  READY_FOR_CHAT: "Можно перейти в чат",
  INVITE_REQUIRED: "Сначала нужно отправить приглашение"
};

export const scenarioLabelByValue = Object.fromEntries(
  requestScenarioOptions.map((scenario) => [scenario.value, scenario.label])
) as Record<(typeof requestScenarioOptions)[number]["value"], string>;
