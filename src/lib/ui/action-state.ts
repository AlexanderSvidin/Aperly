export type ActionStatus = "idle" | "loading" | "success" | "error";

export type ActionState = {
  status: ActionStatus;
  message?: string;
};

export const idleActionState: ActionState = {
  status: "idle"
};

export function isActionLoading(state: ActionState | undefined) {
  return state?.status === "loading";
}

export function hasActionFeedback(state: ActionState | undefined) {
  return state?.status === "success" || state?.status === "error";
}
