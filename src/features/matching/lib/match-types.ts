import type { RequestScenario } from "@/features/requests/lib/request-schema";

export type MatchModeValue = "REQUEST_TO_REQUEST" | "REQUEST_TO_PROFILE";
export type MatchStatusValue =
  | "READY"
  | "PENDING_RECIPIENT_ACCEPTANCE"
  | "DECLINED"
  | "EXPIRED"
  | "CLOSED";
export type MatchChatReadiness = "READY_FOR_CHAT" | "INVITE_REQUIRED";

export type MatchResponseStatus =
  | "NONE"
  | "SENT"
  | "RECEIVED"
  | "ACCEPTED"
  | "DECLINED";

export type SerializedMatchDimension = {
  key: string;
  label: string;
  score: number;
};

export type SerializedMatchProfileCard = {
  id: string;
  userId: string;
  fullName: string;
  bio: string | null;
  program: string | null;
  courseYear: number | null;
  preferredFormats: ("ONLINE" | "OFFLINE" | "HYBRID")[];
  skillNames: string[];
  subjectNames: string[];
  availabilityLabels: string[];
  isDiscoverable: boolean;
};

export type SerializedMatchRequestCard = {
  id: string;
  scenario: RequestScenario;
  title: string;
  subtitle: string;
  preferredFormat: "ONLINE" | "OFFLINE" | "HYBRID" | null;
  expiresAt: string;
  ownerDisplayName: string;
};

export type SerializedMatchResponse = {
  status: MatchResponseStatus;
  introMessage: string | null;
  sentByMe: boolean;
  canSendIntro: boolean;
  canAccept: boolean;
  canDecline: boolean;
  telegramUsername: string | null;
  telegramUrl: string | null;
  contactHint: string;
};

export type SerializedMatchListItem = {
  id: string;
  mode: MatchModeValue;
  status: MatchStatusValue;
  score: number;
  reasonSummary: string;
  reasons: string[];
  dimensions: SerializedMatchDimension[];
  candidateProfile: SerializedMatchProfileCard;
  candidateRequest: SerializedMatchRequestCard | null;
  chatReadiness: MatchChatReadiness;
  response: SerializedMatchResponse;
  computedAt: string;
  expiresAt: string | null;
};

export type SerializedMatchDetail = SerializedMatchListItem & {
  request: SerializedMatchRequestCard;
};

export type SerializedMatchEmptyState = {
  code: "REQUEST_INACTIVE" | "NO_MATCHES";
  title: string;
  description: string;
  suggestions: string[];
  keepRequestOpen: boolean;
};

export type SerializedRequestMatches = {
  requestId: string;
  requestTitle: string;
  requestScenario: RequestScenario;
  requestStatus: "ACTIVE" | "EXPIRED" | "CLOSED" | "DELETED";
  requestExpiresAt: string;
  lastMatchedAt: string | null;
  matches: SerializedMatchListItem[];
  fallbackUsed: boolean;
  emptyState: SerializedMatchEmptyState | null;
};

export type SerializedMatchRequestSummary = {
  id: string;
  scenario: RequestScenario;
  status: "ACTIVE" | "EXPIRED" | "CLOSED" | "DELETED";
  title: string;
  subtitle: string;
  expiresAt: string;
  lastMatchedAt: string | null;
  activeMatchCount: number;
  fallbackUsed: boolean;
};

export type SerializedMatchesScreenData = {
  requests: SerializedMatchRequestSummary[];
  selectedRequestId: string | null;
  selectedMatchId: string | null;
  selectedRequestMatches: SerializedRequestMatches | null;
};
