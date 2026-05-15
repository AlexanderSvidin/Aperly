import type { SerializedArchiveData } from "@/features/archive/lib/archive-types";
import { scenarioLabelByValue } from "@/features/matching/lib/match-options";
import { requestStatusLabels } from "@/features/requests/lib/request-options";
import { connectionService } from "@/server/services/connections/connection-service";
import { buildHomeRequestTitle } from "@/server/services/home/home-presenters";
import { requestService } from "@/server/services/requests/request-service";

export const archiveService = {
  async getForUser(userId: string): Promise<SerializedArchiveData> {
    const [connections, requests] = await Promise.all([
      connectionService.listForUser(userId),
      requestService.listForUser(userId)
    ]);

    const archivedRequests = requests.filter((request) =>
      ["CLOSED", "EXPIRED", "ARCHIVED"].includes(request.status)
    );

    return {
      connections: connections.ended.map((connection) => ({
        id: connection.id,
        title: connection.title,
        type: scenarioLabelByValue[connection.scenario],
        status: connection.status === "ARCHIVED" ? "В архиве" : "Завершена",
        date: connection.endedAt ?? connection.createdAt,
        href: `/connections/${connection.id}`,
        actionLabel: "Открыть"
      })),
      requests: archivedRequests.map((request) => ({
        id: request.id,
        title: buildHomeRequestTitle(request),
        type: scenarioLabelByValue[request.scenario],
        status: requestStatusLabels[request.status] ?? request.status,
        date: request.closedAt ?? request.updatedAt,
        href: `/create?scenario=${request.scenario}`,
        actionLabel: "Повторить"
      })),
      declined: connections.archive
        .filter((interaction) => interaction.status === "DECLINED")
        .map((interaction) => ({
          id: interaction.id,
          title: interaction.title,
          type:
            interaction.type === "RESPONSE"
              ? "Отклик"
              : "Приглашение",
          status: "Отклонено",
          date: interaction.createdAt,
          href:
            interaction.direction === "INCOMING"
              ? `/connections/incoming/${
                  interaction.type === "RESPONSE" ? "response" : "invitation"
                }/${interaction.id}`
              : "/connections",
          actionLabel: "Открыть"
        }))
    };
  }
};
