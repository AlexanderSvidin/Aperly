import type { RequestScenario } from "@/features/requests/lib/request-schema";

export type InteractionKind = "RESPONSE" | "INVITATION";
export type InteractionLifecycleStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED"
  | "ARCHIVED";
export type ConnectionLifecycleStatus = "ACTIVE" | "ENDED" | "ARCHIVED";

export type InteractionCtaStatus =
  | "NONE"
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED"
  | "ARCHIVED";

export type SerializedInteractionCtaState = {
  status: InteractionCtaStatus;
  label: string;
  canAct: boolean;
  interactionId: string | null;
  connectionId: string | null;
};

export type SerializedInteractionSummary = {
  id: string;
  type: InteractionKind;
  status: InteractionLifecycleStatus;
  scenario: RequestScenario;
  title: string;
  subtitle: string;
  message: string;
  personName: string;
  createdAt: string;
  expiresAt: string | null;
  direction: "INCOMING" | "OUTGOING";
};

export type SerializedConnectionSummary = {
  id: string;
  scenario: RequestScenario;
  status: ConnectionLifecycleStatus;
  title: string;
  subtitle: string;
  otherUserName: string;
  telegramUsername: string | null;
  telegramUrl: string | null;
  createdAt: string;
  endedAt: string | null;
};

export type SerializedConnectionsScreenData = {
  incoming: SerializedInteractionSummary[];
  outgoing: SerializedInteractionSummary[];
  active: SerializedConnectionSummary[];
  archive: SerializedInteractionSummary[];
  ended: SerializedConnectionSummary[];
};

export type SerializedInteractionDetail = SerializedInteractionSummary & {
  canAccept: boolean;
  canDecline: boolean;
  targetRequestId: string | null;
  sourceRequestId: string | null;
};

export type SerializedConnectionDetail = SerializedConnectionSummary & {
  canOpenTelegram: boolean;
  canEnd: boolean;
};
