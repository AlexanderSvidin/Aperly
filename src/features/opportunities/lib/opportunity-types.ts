import type { RequestScenario } from "@/features/requests/lib/request-schema";
import type { SerializedInteractionCtaState } from "@/features/connections/lib/connection-types";

export type SerializedOpportunityDetail = {
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
  goal: string;
  meta: string;
  format: string | null;
  notes: string | null;
  author: {
    userId: string;
    name: string;
    bio: string | null;
    program: string | null;
    courseYear: number | null;
    skills: string[];
    subjects: string[];
  };
  canRespond: boolean;
  responseState: SerializedInteractionCtaState;
  expiresAt: string;
};
