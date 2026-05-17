"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  getCourseOptionsForProgram,
  getProgramsForLevel,
  studyLevelOptions,
  type StudyLevelId
} from "@/features/study/lib/study-catalog";
import {
  getUserErrorMessage,
  getUserIssueMessages
} from "@/lib/ui/error-messages";

type BasicProfileFormProps = {
  defaultFullName: string;
  defaultInstitution: string;
  defaultProgramType: StudyLevelId;
  defaultDirection: string;
  defaultProgramId: string;
  defaultCourseYear: number;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
  issues?: string[];
};

export function BasicProfileForm({
  defaultFullName,
  defaultInstitution,
  defaultProgramType,
  defaultDirection,
  defaultProgramId,
  defaultCourseYear
}: BasicProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [fullName, setFullName] = useState(defaultFullName);
  const [institution, setInstitution] = useState(
    defaultInstitution || "НИУ ВШЭ — Пермь"
  );
  const [programType, setProgramType] = useState<StudyLevelId>(
    defaultProgramType
  );
  const [direction, setDirection] = useState(defaultDirection);
  const [programId, setProgramId] = useState(defaultProgramId);
  const [courseYear, setCourseYear] = useState(defaultCourseYear);

  const availablePrograms = useMemo(
    () => getProgramsForLevel(programType),
    [programType]
  );
  const courseOptions = useMemo(() => {
    if (programId) {
      return getCourseOptionsForProgram(programId);
    }
    return programType === "MASTER" ? [1, 2] : [1, 2, 3, 4];
  }, [programId, programType]);

  function handleProgramTypeChange(value: StudyLevelId) {
    setProgramType(value);
    setProgramId("");
    setCourseYear(1);
  }

  function handleProgramChange(value: string) {
    setProgramId(value);
    const nextCourseOptions = value
      ? getCourseOptionsForProgram(value)
      : programType === "MASTER"
        ? [1, 2]
        : [1, 2, 3, 4];

    setCourseYear((current) =>
      nextCourseOptions.includes(current) ? current : nextCourseOptions[0]!
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      setFeedback(null);
      const response = await fetch("/api/profile/basic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          institution,
          programType,
          direction,
          program: programId || null,
          courseYear
        })
      });
      const result = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
        issues?: unknown[];
      } | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: getUserErrorMessage(
            result,
            "Не удалось сохранить профиль. Попробуйте ещё раз."
          ),
          issues: getUserIssueMessages(result?.issues)
        });
        return;
      }

      setFeedback({ kind: "success", message: "Сохранено." });
    });
  }

  return (
    <section className="screen-stack">
      <Link className="back-link" href="/profile/edit" aria-label="Назад">
        ←
      </Link>
      <div className="screen-copy">
        <h1 className="page-title">Основное</h1>
        <p className="screen-description">Учебная информация</p>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="surface-card screen-stack">
          {feedback ? (
            <div
              className={
                feedback.kind === "error"
                  ? "feedback-box error-box"
                  : "feedback-box success-box"
              }
            >
              <p className="feedback-title">{feedback.message}</p>
              {feedback.issues?.length ? (
                <ul className="bullet-list">
                  {feedback.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <label className="field-stack">
            <span className="field-label">Имя</span>
            <input
              className="field-input"
              maxLength={160}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Например, Анна Павлова"
              required
              value={fullName}
            />
          </label>

          <label className="field-stack">
            <span className="field-label">Учебное заведение</span>
            <select
              className="field-input field-select"
              onChange={(event) => setInstitution(event.target.value)}
              value={institution}
            >
              <option value="НИУ ВШЭ — Пермь">НИУ ВШЭ — Пермь</option>
            </select>
          </label>

          <div className="field-stack">
            <span className="field-label">Тип программы</span>
            <div className="segmented-row" role="group">
              {studyLevelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="segmented-chip"
                  data-selected={programType === option.value}
                  onClick={() => handleProgramTypeChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field-stack">
            <span className="field-label">Направление</span>
            <input
              className="field-input"
              maxLength={160}
              onChange={(event) => setDirection(event.target.value)}
              placeholder="Например, 38.03.01 Экономика"
              required
              value={direction}
            />
          </label>

          <label className="field-stack">
            <span className="field-label">
              Программа <small className="field-caption">необязательно</small>
            </span>
            <select
              className="field-input field-select"
              onChange={(event) => handleProgramChange(event.target.value)}
              value={programId}
            >
              <option value="">Необязательно</option>
              {availablePrograms.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="field-stack">
            <span className="field-label">Курс</span>
            <div className="segmented-row" role="group">
              {courseOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="segmented-chip"
                  data-selected={courseYear === value}
                  onClick={() => setCourseYear(value)}
                >
                  {value} курс
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          disabled={isPending}
          fullWidth
          isLoading={isPending}
          loadingLabel="Сохраняем..."
          type="submit"
        >
          Сохранить
        </Button>
      </form>
    </section>
  );
}
