import type { SerializedChatListItem } from "@/features/chat/lib/chat-types";
import type { SerializedInteractionCtaState } from "@/features/connections/lib/connection-types";
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
  status:
    | "DRAFT"
    | "ACTIVE"
    | "EXPIRED"
    | "PAUSED"
    | "CLOSED"
    | "ARCHIVED"
    | "DELETED";
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
  href: "/create";
  action: "create_request";
};

export type SerializedHomeOpportunity = {
  id: string;
  scenario: RequestScenario;
  title: string;
  goal: string;
  meta: string;
  format: string | null;
  time: string | null;
  author: {
    name: string;
    program: string | null;
    courseYear: number | null;
  };
  trustInfo: string;
  relevanceReason: string;
  responseState: SerializedInteractionCtaState;
  ctaLabel: string;
  ctaHref: string;
  expiresAt: string;
  updatedAt: string;
};

export type SerializedHomeFeedData = {
  opportunities: SerializedHomeOpportunity[];
  activeScenarioFilters: RequestScenario[];
  selectedScenario: RequestScenario | "ALL";
  primaryCta: SerializedHomePrimaryCta;
};

export type SerializedHomeDashboardData = {
  activeRequests: SerializedHomeRequestItem[];
  latestMatches: SerializedHomeMatchItem[];
  activeChats: SerializedChatListItem[];
  upcomingStudySession: SerializedStudyHomeSession | null;
  studyContinuation: SerializedStudyContinuation | null;
  primaryCta: SerializedHomePrimaryCta;
};

