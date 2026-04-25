export type ModerationUserAction = "BLOCK" | "DISABLE" | "UNBLOCK";

export type SerializedAdminOverview = {
  totalUsers: number;
  blockedUsers: number;
  openReports: number;
  activeRequests: number;
};

export type SerializedAdminUser = {
  id: string;
  displayName: string;
  username: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED";
  onboardingCompleted: boolean;
  program: string | null;
  activeRequestCount: number;
  openReportCount: number;
  createdAt: string;
  blockedAt: string | null;
};

export type SerializedAdminRequest = {
  id: string;
  title: string;
  scenario: "CASE" | "PROJECT" | "STUDY";
  status: "ACTIVE" | "EXPIRED" | "CLOSED" | "DELETED";
  ownerDisplayName: string;
  createdAt: string;
  expiresAt: string;
};

export type SerializedAdminReport = {
  id: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  reasonCode: string;
  details: string | null;
  reporterDisplayName: string;
  targetUserDisplayName: string | null;
  contextLabel: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type SerializedAdminAction = {
  id: string;
  actionType: "BLOCK_USER" | "DISABLE_USER" | "UNBLOCK_USER" | "RESOLVE_REPORT";
  adminDisplayName: string;
  targetUserDisplayName: string | null;
  requestTitle: string | null;
  reportId: string | null;
  notes: string | null;
  createdAt: string;
};

export type SerializedAdminDashboardData = {
  overview: SerializedAdminOverview;
  users: SerializedAdminUser[];
  requests: SerializedAdminRequest[];
  reports: SerializedAdminReport[];
  actions: SerializedAdminAction[];
};
