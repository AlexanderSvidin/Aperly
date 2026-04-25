import { LogoutButton } from "@/features/auth/components/logout-button";

type BlockedPageProps = {
  searchParams?:
    | Promise<{
        reason?: string;
      }>
    | {
        reason?: string;
      };
};

function getBlockedCopy(reason: string | undefined) {
  if (reason === "deleted") {
    return {
      title: "Аккаунт удалён",
      description:
        "Этот аккаунт больше не может войти в сервис. Если это произошло по ошибке, понадобится решение администратора."
    };
  }

  return {
    title: "Доступ ограничен",
    description:
      "Профиль заблокирован. Доступ к сервису временно закрыт до разбора модерацией."
  };
}

export default async function BlockedPage({ searchParams }: BlockedPageProps) {
  const resolvedSearchParams = await searchParams;
  const copy = getBlockedCopy(resolvedSearchParams?.reason);

  return (
    <main className="welcome-layout">
      <section className="screen-stack">
        <div className="hero-panel">
          <h1 className="hero-title">{copy.title}</h1>
          <p className="hero-description">{copy.description}</p>
        </div>

        <div className="surface-card screen-stack">
          <p className="helper-text">
            Если вы входили раньше, можно очистить локальную сессию ниже.
          </p>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
