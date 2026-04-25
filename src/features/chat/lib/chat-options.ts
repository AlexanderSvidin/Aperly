import { requestScenarioOptions } from "@/features/requests/lib/request-options";

import type {
  ChatStaleStatus,
  ContactExchangeStatusValue,
  SerializedChatListItem
} from "@/features/chat/lib/chat-types";

export const chatScenarioLabels = Object.fromEntries(
  requestScenarioOptions.map((scenario) => [scenario.value, scenario.label])
) as Record<(typeof requestScenarioOptions)[number]["value"], string>;

export const chatStatusLabels: Record<SerializedChatListItem["status"], string> = {
  ACTIVE: "Диалог активен",
  STALE: "Ожидает ответа",
  CLOSED: "Диалог закрыт",
  BLOCKED: "Доступ ограничен"
};

export const chatStatusTone: Record<
  SerializedChatListItem["status"],
  "neutral" | "warning" | "success"
> = {
  ACTIVE: "success",
  STALE: "warning",
  CLOSED: "neutral",
  BLOCKED: "neutral"
};

export const staleStatusLabels: Record<ChatStaleStatus, string> = {
  FRESH: "Свежий диалог",
  AWAITING_REPLY: "Ожидает ответа"
};

export const contactExchangeStatusLabels: Record<
  ContactExchangeStatusValue,
  string
> = {
  NOT_REQUESTED: "Контакты ещё не открыты",
  REQUESTED_ONE_SIDED: "Нужен ответ на обмен контактами",
  MUTUAL_CONSENT: "Контакты открыты",
  DECLINED: "Обмен контактами отклонён"
};
