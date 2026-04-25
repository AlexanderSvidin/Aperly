export const reportReasonOptions = [
  {
    value: "INAPPROPRIATE_BEHAVIOR",
    label: "Неприемлемое поведение"
  },
  {
    value: "SPAM",
    label: "Спам или навязчивые сообщения"
  },
  {
    value: "NO_SHOW",
    label: "Не вышел на связь или сорвал договоренность"
  },
  {
    value: "MISLEADING_INFO",
    label: "Ввел в заблуждение"
  },
  {
    value: "OTHER",
    label: "Другое"
  }
] as const;

export type ReportReasonCode = (typeof reportReasonOptions)[number]["value"];

export const reportReasonLabelByValue = Object.fromEntries(
  reportReasonOptions.map((option) => [option.value, option.label])
) as Record<ReportReasonCode, string>;
