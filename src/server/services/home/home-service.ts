import type { SerializedHomeDashboardData } from "@/features/home/lib/home-types";
import {
  buildHomeLatestMatches,
  buildHomePrimaryCta,
  buildHomeRequestItem
} from "@/server/services/home/home-presenters";
import { chatService } from "@/server/services/chat/chat-service";
import { matchingService } from "@/server/services/matching/matching-service";
import { requestService } from "@/server/services/requests/request-service";
import { studySessionService } from "@/server/services/study-sessions/study-session-service";

const ACTIVE_REQUEST_STATUS = "ACTIVE";

export interface HomeService {
  getDashboardForUser(userId: string): Promise<SerializedHomeDashboardData>;
}

export const homeService: HomeService = {
  async getDashboardForUser(userId) {
    const requests = await requestService.listForUser(userId);
    const activeRequests = requests.filter(
      (request) => request.status === ACTIVE_REQUEST_STATUS
    );

    const [matchCollections, chatList, studyHomeState] = await Promise.all([
      Promise.all(
        activeRequests.map((request) =>
          matchingService.listForOwnedRequest(userId, request.id)
        )
      ),
      chatService.listForUser(userId),
      studySessionService.getHomeStateForUser(userId)
    ]);

    const activeMatchCountByRequestId = new Map(
      matchCollections.map((collection) => [collection.requestId, collection.matches.length])
    );

    return {
      activeRequests: activeRequests.map((request) =>
        buildHomeRequestItem(
          request,
          activeMatchCountByRequestId.get(request.id) ?? 0
        )
      ),
      latestMatches: buildHomeLatestMatches(matchCollections),
      activeChats: chatList.chats.slice(0, 4),
      upcomingStudySession: studyHomeState.upcomingSession,
      studyContinuation: studyHomeState.continuation,
      primaryCta: buildHomePrimaryCta()
    };
  }
};
