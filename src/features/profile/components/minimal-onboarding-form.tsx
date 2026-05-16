"use client";

import { useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { AperlyLogo } from "@/components/brand/aperly-logo";
import { Button } from "@/components/ui/button";
import {
  getCourseOptionsForProgram,
  getProgramsForLevel,
  studyLevelOptions,
  type StudyLevelId
} from "@/features/study/lib/study-catalog";

type MinimalOnboardingFormProps = {
  defaultFullName: string;
  defaultInstitution?: string;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
  issues?: string[];
};

function extractIssueMessages(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("issues" in payload) ||
    !Array.isArray(payload.issues)
  ) {
    return [];
  }

  return payload.issues
    .map((issue) => {
      if (
        issue &&
        typeof issue === "object" &&
        "message" in issue &&
        typeof issue.message === "string"
      ) {
        return issue.message;
      }

      return null;
    })
    .filter(Boolean) as string[];
}

export function MinimalOnboardingForm({
  defaultFullName,
  defaultInstitution = "НИУ ВШЭ — Пермь"
}: MinimalOnboardingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [fullName, setFullName] = useState(defaultFullName);
  const [institution, setInstitution] = useState(defaultInstitution);
  const [programType, setProgramType] = useState<StudyLevelId>("BACHELOR");
  const [direction, setDirection] = useState("");
  const [program, setProgram] = useState("");
  const [courseYear, setCourseYear] = useState(1);

  const availablePrograms = useMemo(
    () => getProgramsForLevel(programType),
    [programType]
  );
  const courseOptions = useMemo(() => {
    if (program) {
      return getCourseOptionsForProgram(program);
    }

    return programType === "MASTER" ? [1, 2] : [1, 2, 3, 4];
  }, [program, programType]);

  function handleProgramTypeChange(value: StudyLevelId) {
    setProgramType(value);
    setProgram("");
    setCourseYear(1);
  }

  function handleProgramChange(value: string) {
    setProgram(value);
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

      const response = await fetch("/api/profile/onboarding", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName,
          institution,
          programType,
          direction,
          program: program || null,
          courseYear
        })
      });
      const result = (await response.json().catch(() => null)) as
        | {
            message?: string;
            issues?: unknown[];
          }
        | null;

      if (!response.ok) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "Не удалось сохранить профиль.",
          issues: extractIssueMessages(result)
        });
        return;
      }

      router.push("/opportunities");
      router.refresh();
    });
  }

  return (
    <section className="onboarding-screen">
      <div className="onboarding-brand">
        <AperlyLogo size="lg" />
      </div>

      <div className="onboarding-heading">
        <h1 className="onboarding-title">Расскажите о себе</h1>
        <p className="onboarding-subtitle">Это займёт пару минут</p>
      </div>

      <form className="onboarding-form" onSubmit={handleSubmit}>
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
          <span className="field-label">Программа</span>
          <select
            className="field-input field-select"
            onChange={(event) => handleProgramChange(event.target.value)}
            value={program}
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

        <Button
          disabled={isPending}
          fullWidth
          isLoading={isPending}
          loadingLabel="Сохраняем..."
          type="submit"
        >
          Продолжить
        </Button>
      </form>
    </section>
  );
}
