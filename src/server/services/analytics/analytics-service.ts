export interface AnalyticsService {
  track(eventName: string, payload?: Record<string, unknown>): Promise<void>;
}

// Console-based sink for MVP. Replace with a real provider (e.g. Amplitude, Posthog)
// by swapping this implementation — the interface and call sites stay unchanged.
export const analyticsService: AnalyticsService = {
  async track(eventName, payload) {
    if (process.env.NODE_ENV !== "test") {
      console.log("[analytics]", eventName, payload ?? {});
    }
  }
};
