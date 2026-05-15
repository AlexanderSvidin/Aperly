import Link from "next/link";
import type { Route } from "next";

import { buttonClassName } from "@/components/ui/button";

const sections = [
  { href: "/profile/edit/basic", title: "Основное", text: "Имя, вуз, программа и курс" },
  { href: "/profile/edit/skills", title: "Навыки и интересы", text: "Что умеете и что хотите найти" },
  { href: "/profile/edit/roles", title: "Роли", text: "Основная и дополнительные роли" },
  { href: "/profile/edit/telegram", title: "Telegram-контакт", text: "Контакт и видимость после активной связи" }
];

export default function ProfileEditPage() {
  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <div className="screen-copy">
          <p className="card-eyebrow">Профиль</p>
          <h1 className="screen-title">Редактировать</h1>
        </div>
      </section>
      <div className="screen-grid">
        {sections.map((section) => (
          <article className="surface-card screen-stack" key={section.href}>
            <div className="screen-copy">
              <h2 className="card-title">{section.title}</h2>
              <p className="card-body-copy">{section.text}</p>
            </div>
            <Link className={buttonClassName({ fullWidth: true })} href={section.href as Route}>
              Открыть
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
