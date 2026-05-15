export type ArchiveFilter = "CONNECTIONS" | "REQUESTS" | "DECLINED";

export type SerializedArchiveCard = {
  id: string;
  title: string;
  type: string;
  status: string;
  date: string;
  href: string | null;
  actionLabel: "Открыть" | "Повторить" | null;
};

export type SerializedArchiveData = {
  connections: SerializedArchiveCard[];
  requests: SerializedArchiveCard[];
  declined: SerializedArchiveCard[];
};
