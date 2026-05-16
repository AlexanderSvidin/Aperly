import Link from "next/link";
import type { Route } from "next";

import { buttonClassName } from "@/components/ui/button";
import { requirePageUser } from "@/server/services/auth/current-user";

const scenarioCards: {
  href: Route;
  label: string;
  description: string;
}[] = [
  {
    href: "/create/study",
    label: "Учёба",
    description: "Партнёр для подготовки, домашек или экзаменов"
  },
  {
    href: "/create/team",
    label: "Команда",
    description: "Команда для кейса, хакатона или конкурса"
  },
  {
    href: "/create/project",
    label: "Проект",
    description: "Люди в стартап, инициативу или медиапроект"
  },
  {
    href: "/create/activity",
    label: "Активность",
    description: "Клуб, встреча, спорт или хобби"
  }
];

export default async function CreatePage() {
  await requirePageUser();

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Aperly | Создать</p>
          <h1 className="screen-title">Создать запрос</h1>
          <p className="screen-description">Что ты хочешь найти?</p>
        </div>
      </section>

      <div className="screen-grid">
        {scenarioCards.map((card) => (
          <Link
            key={card.href}
            className="surface-card screen-stack scenario-chooser-card"
            href={card.href}
          >
            <div className="screen-copy">
              <h2 className="card-title">{card.label}</h2>
              <p className="card-body-copy">{card.description}</p>
            </div>
            <span className={buttonClassName({ fullWidth: true })} aria-hidden="true">
              Создать запрос
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
