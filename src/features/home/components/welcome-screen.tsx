"use client";

import { AperlyLogo } from "@/components/brand/aperly-logo";
import { Card } from "@/components/ui/card";
import { AuthEntryCard } from "@/features/auth/components/auth-entry-card";
import {
  useTelegramApp,
  useTelegramDetecting
} from "@/features/telegram/components/telegram-app-provider";

const scenarios = [
  {
    title: "Команда на кейс / хакатон",
    description:
      "Найдите людей под конкретный кейс, роли и удобное время подготовки."
  },
  {
    title: "Проект / стартап / пет-проект",
    description: "Соберите участников под идею, стадию проекта и формат работы."
  },
  {
    title: "Совместная учёба",
    description: "Найдите партнёра по предмету, цели и удобному ритму занятий."
  }
];

function TelegramLaunchScreen() {
  return (
    <section className="loading-screen">
      <div className="loading-screen-inner">
        <AperlyLogo size="xl" />
        <p className="loading-status">Открываем Aperly в Telegram</p>
        <div className="loading-spinner" aria-label="Вход" role="status">
          <span className="loading-spinner-ring" aria-hidden="true" />
        </div>
      </div>
      <div hidden>
        <AuthEntryCard />
      </div>
    </section>
  );
}

export function WelcomeScreen() {
  const telegram = useTelegramApp();
  const isDetecting = useTelegramDetecting();

  if (isDetecting || telegram.source === "telegram") {
    return <TelegramLaunchScreen />;
  }

  return (
    <section className="welcome-layout">
      <div className="hero-panel">
        <h1 className="hero-title">
          Найдите людей для кейса, проекта или совместной учёбы.
        </h1>
        <p className="hero-description">
          Несколько коротких шагов — и сервис покажет подходящих людей. Вы
          отправляете короткий отклик, автор принимает его и дальше вы
          связываетесь в Telegram.
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
