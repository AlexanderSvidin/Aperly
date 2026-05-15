import { requirePageUser } from "@/server/services/auth/current-user";
import { connectionService } from "@/server/services/connections/connection-service";
import { requestService } from "@/server/services/requests/request-service";
import { buildHomeRequestTitle } from "@/server/services/home/home-presenters";

export default async function ProfileArchivePage() {
  const user = await requirePageUser();
  const [connections, requests] = await Promise.all([
    connectionService.listForUser(user.id),
    requestService.listForUser(user.id)
  ]);
  const archivedRequests = requests.filter((request) =>
    ["CLOSED", "EXPIRED", "ARCHIVED"].includes(request.status)
  );

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="screen-title">Архив</h1>
        </div>
      </section>
      {[...connections.ended, ...connections.archive].length === 0 && archivedRequests.length === 0 ? (
        <div className="feedback-box">
          <p className="feedback-title">Архив пока пуст.</p>
        </div>
      ) : null}
      {connections.ended.map((connection) => (
        <article className="match-card" key={connection.id}>
          <h2 className="card-title">{connection.title}</h2>
          <p className="card-body-copy">{connection.otherUserName}</p>
        </article>
      ))}
      {connections.archive.map((interaction) => (
        <article className="match-card" key={interaction.id}>
          <h2 className="card-title">{interaction.title}</h2>
          <p className="card-body-copy">{interaction.subtitle}</p>
        </article>
      ))}
      {archivedRequests.map((request) => (
        <article className="match-card" key={request.id}>
          <h2 className="card-title">{buildHomeRequestTitle(request)}</h2>
          <p className="card-body-copy">{request.status}</p>
        </article>
      ))}
    </section>
  );
}
