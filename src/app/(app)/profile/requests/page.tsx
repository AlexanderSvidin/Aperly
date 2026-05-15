import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";
import { requirePageUser } from "@/server/services/auth/current-user";
import { requestService } from "@/server/services/requests/request-service";
import { requestStatusLabels } from "@/features/requests/lib/request-options";
import { buildHomeRequestTitle } from "@/server/services/home/home-presenters";

export default async function ProfileRequestsPage() {
  const user = await requirePageUser();
  const requests = await requestService.listForUser(user.id);

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="screen-title">Мои запросы</h1>
        </div>
      </section>
      {requests.length > 0 ? (
        <div className="match-list">
          {requests.map((request) => (
            <article className="match-card" key={request.id}>
              <div className="screen-copy">
                <span className="tone-pill">{requestStatusLabels[request.status]}</span>
                <h2 className="card-title">{buildHomeRequestTitle(request)}</h2>
              </div>
              <div className="card-actions-row card-actions-row-inline">
                <Link className={buttonClassName({ variant: "secondary" })} href={`/requests/${request.id}/matches`}>
                  Открыть
                </Link>
                {request.status === "ACTIVE" ? (
                  <Link className={buttonClassName({ variant: "ghost" })} href={`/requests/${request.id}/edit`}>
                    Изменить
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="feedback-box">
          <p className="feedback-title">Запросов пока нет.</p>
        </div>
      )}
    </section>
  );
}
