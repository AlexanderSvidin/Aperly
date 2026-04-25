import type { SerializedChatListItem } from "@/features/chat/lib/chat-types";
import type {
  MatchChatReadiness,
  MatchStatusValue
} from "@/features/matching/lib/match-types";
import type { RequestScenario } from "@/features/requests/lib/request-schema";
import type {
  SerializedStudyContinuation,
  SerializedStudyHomeSession
} from "@/features/study-sessions/lib/study-session-types";

export type SerializedHomeRequestItem = {
  id: string;
  scenario: RequestScenario;
  status: "ACTIVE" | "EXPIRED" | "CLOSED" | "DELETED";
  title: string;
  subtitle: string;
  expiresAt: string;
  lastMatchedAt: string | null;
  activeMatchCount: number;
};

export type SerializedHomeMatchItem = {
  id: string;
  requestId: string;
  requestTitle: string;
  requestScenario: RequestScenario;
  candidateName: string;
  score: number;
  reasonSummary: string;
  status: MatchStatusValue;
  chatReadiness: MatchChatReadiness;
  computedAt: string;
};

export type SerializedHomePrimaryCta = {
  label: string;
  href: "/requests/new";
  action: "create_request";
};

export type SerializedHomeDashboardData = {
  activeRequests: SerializedHomeRequestItem[];
  latestMatches: SerializedHomeMatchItem[];
  activeChats: SerializedChatListItem[];
  upcomingStudySession: SerializedStudyHomeSession | null;
  studyContinuation: SerializedStudyContinuation | null;
  primaryCta: SerializedHomePrimaryCta;
};
