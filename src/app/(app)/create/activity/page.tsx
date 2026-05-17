"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getUserErrorMessage } from "@/lib/ui/error-messages";

const subtypeOptions = [
  { value: "CLUB", label: "Клуб" },
  { value: "MEETING", label: "Встреча" },
  { value: "SPORT", label: "Спорт" },
  { value: "HOBBY", label: "Хобби" },
  { value: "OTHER", label: "Другое" }
] as const;

const formatOptions = [
  { value: "OFFLINE", label: "Офлайн" },
  { value: "ONLINE", label: "Онлайн" },
  { value: "HYBRID", label: "Гибрид" }
] as const;

const recurrenceOptions = [
  { value: "ONCE", label: "Один раз" },
  { value: "WEEKLY", label: "Раз в неделю" },
  { value: "TWICE_WEEKLY", label: "Два раза в неделю" },
  { value: "FLEXIBLE", label: "Гибко" }
] as const;

export default function CreateActivityPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [activitySubtype, setActivitySubtype] =
    useState<(typeof subtypeOptions)[number]["value"]>("MEETING");
  const [time, setTime] = useState("");
  const [preferredFormat, setPreferredFormat] =
    useState<(typeof formatOptions)[number]["value"]>("OFFLINE");
  const [location, setLocation] = useState("");
  const [peopleCount, setPeopleCount] = useState("3");
  const [recurrence, setRecurrence] =
    useState<(typeof recurrenceOptions)[number]["value"]>("ONCE");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scenario: "ACTIVITY",
        notes: comment,
        availabilitySlots: [],
        details: {
          title,
          activitySubtype,
          time: time ? new Date(time).toISOString() : null,
          preferredFormat,
          location,
          peopleCount: Number(peopleCount),
          recurrence,
          comment
        }
      })
    });
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      request?: { id: string };
      message?: string;
    } | null;

    setIsSubmitting(false);

    if (!response.ok || !payload?.request?.id) {
      setMessage(
        getUserErrorMessage(
          payload,
          "Не удалось создать активность. Попробуйте ещё раз."
        )
      );
      return;
    }

    router.push(`/requests/${payload.request.id}/matches?created=1`);
  }

  return (
    <section className="screen-stack">
      <section className="surface-card screen-stack">
        <Link className="back-link" href="/create">
          ←
        </Link>
        <div className="screen-copy">
          <p className="card-eyebrow">Создать</p>
          <h1 className="screen-title">Активность</h1>
          <p className="screen-description">
            Создайте открытый запрос на встречу, клуб, спорт или хобби.
          </p>
        </div>
      </section>

      <section className="surface-card screen-stack">
        <label className="field-stack">
          <span className="field-label">Название</span>
          <input
            className="field-input"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>

        <label className="field-stack">
          <span className="field-label">Тип</span>
          <select
            className="field-input"
            onChange={(event) =>
              setActivitySubtype(event.target.value as typeof activitySubtype)
            }
            value={activitySubtype}
          >
            {subtypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span className="field-label">Когда</span>
          <input
            className="field-input"
            onChange={(event) => setTime(event.target.value)}
            type="datetime-local"
            value={time}
          />
        </label>

        <label className="field-stack">
          <span className="field-label">Формат</span>
          <select
            className="field-input"
            onChange={(event) =>
              setPreferredFormat(event.target.value as typeof preferredFormat)
            }
            value={preferredFormat}
          >
            {formatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span className="field-label">Место</span>
          <input
            className="field-input"
            onChange={(event) => setLocation(event.target.value)}
            value={location}
          />
        </label>

        <label className="field-stack">
          <span className="field-label">Сколько людей</span>
          <input
            className="field-input"
            min="1"
            max="50"
            onChange={(event) => setPeopleCount(event.target.value)}
            type="number"
            value={peopleCount}
          />
        </label>

        <label className="field-stack">
          <span className="field-label">Регулярность</span>
          <select
            className="field-input"
            onChange={(event) =>
              setRecurrence(event.target.value as typeof recurrence)
            }
            value={recurrence}
          >
            {recurrenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span className="field-label">Комментарий</span>
          <textarea
            className="field-textarea"
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            value={comment}
          />
        </label>

        {message ? (
          <div className="feedback-box error-box">
            <p className="feedback-title">{message}</p>
          </div>
        ) : null}

        <Button
          disabled={title.trim().length < 2 || isSubmitting}
          fullWidth
          isLoading={isSubmitting}
          loadingLabel="Создаём..."
          onClick={submit}
        >
          Создать запрос
        </Button>
      </section>
    </section>
  );
}
