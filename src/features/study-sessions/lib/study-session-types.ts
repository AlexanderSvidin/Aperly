export type SessionAction =
  | "CONFIRM"
  | "CANCEL"
  | "RESCHEDULE"
  | "MARK_COMPLETED"
  | "MARK_MISSED";

export type SerializedSession = {
  id: string;
  chatId: string;
  matchId: string;
  sequenceNumber: number;
  scheduledFor: string;
  format: "ONLINE" | "OFFLINE" | "HYBRID";
  notes: string | null;
  status: "PROPOSED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "MISSED";
  nextAction: "NONE" | "SCHEDULE_NEXT" | "FIND_NEW_PARTNER" | "STOP_SEARCHING";
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type ScheduleSessionInput = {
  scheduledAt: string;
  format: "ONLINE" | "OFFLINE" | "HYBRID";
  notes?: string;
};

export type SerializedStudyHomeSession = {
  sessionId: string;
  chatId: string;
  requestId: string | null;
  subjectName: string;
  partnerName: string;
  scheduledFor: string;
  format: "ONLINE" | "OFFLINE" | "HYBRID";
  notes: string | null;
  status: SerializedSession["status"];
  nextAction: SerializedSession["nextAction"];
  sequenceNumber: number;
  requestStatus: "ACTIVE" | "EXPIRED" | "CLOSED" | "DELETED" | null;
  canScheduleNext: boolean;
  canFindNewPartner: boolean;
  canStopSearching: boolean;
};

export type SerializedStudyContinuation = SerializedStudyHomeSession & {
  recommendedAction:
    | "NONE"
    | "SCHEDULE_NEXT"
    | "FIND_NEW_PARTNER"
    | "STOP_SEARCHING";
};

export type SerializedStudyHomeState = {
  upcomingSession: SerializedStudyHomeSession | null;
  continuation: SerializedStudyContinuation | null;
};

export type SerializedStudyChatPanel = {
  chatId: string;
  requestId: string | null;
  subjectName: string;
  partnerName: string;
  requestStatus: "ACTIVE" | "EXPIRED" | "CLOSED" | "DELETED" | null;
  latestSession: SerializedSession | null;
  canScheduleFirst: boolean;
  canScheduleNext: boolean;
  canFindNewPartner: boolean;
  canStopSearching: boolean;
};
