import type { SerializedStudyChatPanel } from "@/features/study-sessions/lib/study-session-types";

export type ChatStaleStatus = "FRESH" | "AWAITING_REPLY";

export type ContactExchangeStatusValue =
  | "NOT_REQUESTED"
  | "REQUESTED_ONE_SIDED"
  | "MUTUAL_CONSENT"
  | "DECLINED";

export type SerializedMessage = {
  id: string;
  senderId: string | null;
  type: "USER" | "SYSTEM" | "REMINDER";
  text: string;
  createdAt: string;
};

export type SerializedChatParticipant = {
  id: string;
  displayName: string;
};

export type SerializedChatListItem = {
  id: string;
  matchId: string;
  scenario: "CASE" | "PROJECT" | "STUDY";
  otherUser: SerializedChatParticipant;
  status: "ACTIVE" | "STALE" | "CLOSED" | "BLOCKED";
  staleStatus: ChatStaleStatus;
  contactExchangeStatus: ContactExchangeStatusValue;
  lastMessageAt: string | null;
  staleAfterAt: string | null;
  canSendReminder: boolean;
  lastMessagePreview: string | null;
};

export type RevealedContacts = {
  telegramUsername: string | null;
  phone: string | null;
};

export type SerializedChatMetadata = SerializedChatListItem & {
  contactExchangeRequestedByMe: boolean;
  revealedContacts: RevealedContacts | null;
  studySessionPanel: SerializedStudyChatPanel | null;
};

export type SerializedChatMessages = {
  messages: SerializedMessage[];
  nextCursor: string | null;
  transport: "POLLING";
};

export type OpenChatResult =
  | { status: "CHAT_READY"; chatId: string }
  | { status: "INVITE_SENT"; matchId: string };

export type RespondResult =
  | { status: "ACCEPTED"; chatId: string }
  | { status: "DECLINED"; matchId: string };

export type ContactExchangeState = {
  contactExchangeStatus: ContactExchangeStatusValue;
};

export type ContactExchangeResult = {
  status: "MUTUAL_CONSENT_REACHED" | "DECLINED";
  revealedContacts: RevealedContacts | null;
};

export type SerializedPendingInvite = {
  matchId: string;
  mode: "REQUEST_TO_PROFILE";
  status: "PENDING_RECIPIENT_ACCEPTANCE";
  scenario: "CASE" | "PROJECT" | "STUDY";
  initiatorDisplayName: string;
  reasonSummary: string;
  score: number;
};

export type UserChatList = {
  chats: SerializedChatListItem[];
  pendingInvites: SerializedPendingInvite[];
};

export type SerializedChatScreenData = UserChatList & {
  selectedChatId: string | null;
  selectedChat: SerializedChatMetadata | null;
  selectedMessages: SerializedChatMessages | null;
};

export type SentMessageResult = {
  message: SerializedMessage;
};
