import Link from "next/link";
import type { Route } from "next";

import { ScenarioIcon } from "@/components/ui/scenario-icon";
import { requirePageUser } from "@/server/services/auth/current-user";

const scenarioCards: {
  href: Route;
  scenario: "STUDY" | "CASE" | "PROJECT" | "ACTIVITY";
  label: string;
  description: string;
}[] = [
  {
    href: "/create/study",
    scenario: "STUDY",
    label: "Учёба",
    description: "Предмет, экзамен, практика"
  },
  {
    href: "/create/team",
    scenario: "CASE",
    label: "Команда",
    description: "Кейс, хакатон"
  },
  {
    href: "/create/project",
    scenario: "PROJECT",
    label: "Проект",
    description: "Стартап, инициатива"
  },
  {
    href: "/create/activity",
    scenario: "ACTIVITY",
    label: "Активность",
    description: "Клуб, встреча, хобби"
  }
];

export default async function CreatePage() {
  await requirePageUser();

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <h1 className="page-title">Создать запрос</h1>
        <p className="screen-description">Что ты хочешь найти?</p>
      </div>

      <div className="scenario-card-list">
        {scenarioCards.map((card) => (
          <Link key={card.href} className="scenario-card" href={card.href}>
            <span className="scenario-card-icon" aria-hidden="true">
              <ScenarioIcon scenario={card.scenario} size={28} />
            </span>
            <span className="scenario-card-copy">
              <span className="scenario-card-title">{card.label}</span>
              <span className="scenario-card-description">{card.description}</span>
            </span>
            <span className="scenario-card-chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
