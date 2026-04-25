import { Card } from "@/components/ui/card";
import { AuthEntryCard } from "@/features/auth/components/auth-entry-card";
import { TelegramStatusChip } from "@/features/telegram/components/telegram-status-chip";

const scenarios = [
  {
    title: "Команда на кейс / хакатон",
    description:
      "Найдите людей под конкретный кейс, роли и удобное время подготовки."
  },
  {
    title: "Проект / стартап / пет-проект",
    description:
      "Соберите участников под идею, стадию проекта и формат работы."
  },
  {
    title: "Совместная учёба",
    description:
      "Найдите партнёра по предмету, цели и удобному ритму занятий."
  }
];

export function WelcomeScreen() {
  return (
    <section className="welcome-layout">
      <div className="hero-panel">
        <TelegramStatusChip />
        <h1 className="hero-title">
          Найдите людей для кейса, проекта или совместной учёбы.
        </h1>
        <p className="hero-description">
          Несколько коротких шагов — и сервис покажет подходящих людей. Сначала
          можно всё обсудить в чате, а контакты откроются только при взаимном
          согласии.
        </p>
      </div>

      <AuthEntryCard />

      <div className="screen-grid">
        {scenarios.map((scenario) => (
          <Card key={scenario.title} title={scenario.title}>
            <p className="card-body-copy">{scenario.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
