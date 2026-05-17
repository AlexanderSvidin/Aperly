"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  MAX_PROFILE_LANGUAGES,
  MAX_PROFILE_SKILLS,
  MAX_PROFILE_SUBJECTS
} from "@/features/profile/lib/profile-options";
import type { ProfileLanguageSkill } from "@/features/profile/lib/profile-schema";
import {
  englishLevelOptions,
  type EnglishLevelId
} from "@/features/study/lib/study-catalog";
import {
  getUserErrorMessage,
  getUserIssueMessages
} from "@/lib/ui/error-messages";

type SkillLookupItem = {
  id: string;
  name: string;
  slug: string;
};

type SubjectLookupItem = {
  id: string;
  name: string;
  slug: string;
};

type SkillsProfileFormProps = {
  initialSkillIds: string[];
  initialCustomSkillNames: string[];
  initialSubjectIds: string[];
  initialCustomSubjectNames: string[];
  initialLanguageSkills: ProfileLanguageSkill[];
  lookups: {
    skills: SkillLookupItem[];
    subjects: SubjectLookupItem[];
  };
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
  issues?: string[];
};

type PickerMode = "can" | "want" | "english" | null;

const popularSkillTags = [
  "SMM",
  "Маркетинг",
  "Финансы",
  "Аналитика",
  "Анализ данных",
  "Разработка",
  "Фронтенд",
  "Бэкенд",
  "Дизайн",
  "UI-дизайн",
  "UX-исследования",
  "Продакт-менеджмент",
  "Копирайтинг",
  "Презентации",
  "Продажи",
  "PR",
  "Операции",
  "Право",
  "HR",
  "Ивент-менеджмент"
];

function extractIssueMessages(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("issues" in payload) ||
    !Array.isArray(payload.issues)
  ) {
    return [];
  }
  return getUserIssueMessages(payload.issues);
}

function normalize(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  const popular = popularSkillTags.find(
    (tag) => tag.toLowerCase() === trimmed.toLowerCase()
  );

  if (popular) {
    return popular;
  }

  if (/^[a-zа-яё]{2,}$/i.test(trimmed)) {
    return `${trimmed.slice(0, 1).toUpperCase()}${trimmed
      .slice(1)
      .toLowerCase()}`;
  }

  return trimmed;
}

export function SkillsProfileForm({
  initialSkillIds,
  initialCustomSkillNames,
  initialSubjectIds,
  initialCustomSubjectNames,
  initialLanguageSkills,
  lookups
}: SkillsProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [skillIds, setSkillIds] = useState<string[]>(initialSkillIds);
  const [customSkillNames, setCustomSkillNames] = useState<string[]>(
    initialCustomSkillNames
  );
  const [subjectIds, setSubjectIds] = useState<string[]>(initialSubjectIds);
  const [customSubjectNames, setCustomSubjectNames] = useState<string[]>(
    initialCustomSubjectNames
  );
  const [languageSkills, setLanguageSkills] = useState<ProfileLanguageSkill[]>(
    initialLanguageSkills
  );

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCustom, setPickerCustom] = useState("");

  const skillNameById = useMemo(
    () => new Map(lookups.skills.map((skill) => [skill.id, skill.name])),
    [lookups.skills]
  );
  const subjectNameById = useMemo(
    () => new Map(lookups.subjects.map((subject) => [subject.id, subject.name])),
    [lookups.subjects]
  );

  const presetSkillOptions = useMemo(
    () => lookups.skills.filter((skill) => !skill.slug.startsWith("custom-")),
    [lookups.skills]
  );
  const presetSubjectOptions = useMemo(
    () =>
      lookups.subjects.filter((subject) => !subject.slug.startsWith("custom-")),
    [lookups.subjects]
  );
  const popularSkillOptions = useMemo(() => {
    const presetSkillNames = new Set(
      presetSkillOptions.map((skill) => skill.name.toLowerCase())
    );

    return popularSkillTags
      .filter((name) => !presetSkillNames.has(name.toLowerCase()))
      .map((name) => ({
        id: `popular-skill:${name}`,
        name,
        slug: `popular-skill:${name.toLowerCase()}`
      }));
  }, [presetSkillOptions]);
  const popularWantOptions = useMemo(() => {
    const presetSubjectNames = new Set(
      presetSubjectOptions.map((subject) => subject.name.toLowerCase())
    );

    return popularSkillTags
      .filter((name) => !presetSubjectNames.has(name.toLowerCase()))
      .map((name) => ({
        id: `popular-want:${name}`,
        name,
        slug: `popular-want:${name.toLowerCase()}`
      }));
  }, [presetSubjectOptions]);

  const englishLevel = languageSkills.find(
    (skill) => skill.language === "ENGLISH"
  )?.level;

  const canChips = useMemo(() => {
    const fromPreset = skillIds
      .map((id) => ({ key: `id:${id}`, label: skillNameById.get(id) ?? "" }))
      .filter((entry) => entry.label);
    const fromCustom = customSkillNames.map((name) => ({
      key: `custom:${name}`,
      label: name
    }));
    return [...fromPreset, ...fromCustom];
  }, [skillIds, customSkillNames, skillNameById]);

  const wantChips = useMemo(() => {
    const fromPreset = subjectIds
      .map((id) => ({ key: `id:${id}`, label: subjectNameById.get(id) ?? "" }))
      .filter((entry) => entry.label);
    const fromCustom = customSubjectNames.map((name) => ({
      key: `custom:${name}`,
      label: name
    }));
    const fromLanguage = englishLevel
      ? [
          {
            key: `language:ENGLISH`,
            label: `Английский ${englishLevel}`
          }
        ]
      : [];
    return [...fromPreset, ...fromCustom, ...fromLanguage];
  }, [subjectIds, customSubjectNames, subjectNameById, englishLevel]);

  const canCount = skillIds.length + customSkillNames.length;
  const wantCount = subjectIds.length + customSubjectNames.length;

  function removeCan(key: string) {
    if (key.startsWith("id:")) {
      const id = key.slice(3);
      setSkillIds((current) => current.filter((value) => value !== id));
    } else if (key.startsWith("custom:")) {
      const name = key.slice(7);
      setCustomSkillNames((current) =>
        current.filter((value) => value !== name)
      );
    }
  }

  function removeWant(key: string) {
    if (key.startsWith("id:")) {
      const id = key.slice(3);
      setSubjectIds((current) => current.filter((value) => value !== id));
    } else if (key.startsWith("custom:")) {
      const name = key.slice(7);
      setCustomSubjectNames((current) =>
        current.filter((value) => value !== name)
      );
    } else if (key.startsWith("language:")) {
      setLanguageSkills((current) =>
        current.filter((skill) => skill.language !== "ENGLISH")
      );
    }
  }

  function openPicker(mode: Exclude<PickerMode, null>) {
    setPickerMode(mode);
    setPickerSearch("");
    setPickerCustom("");
  }

  function closePicker() {
    setPickerMode(null);
    setPickerSearch("");
    setPickerCustom("");
  }

  function togglePresetSkill(id: string) {
    setSkillIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      if (canCount >= MAX_PROFILE_SKILLS) {
        return current;
      }
      return [...current, id];
    });
  }

  function togglePresetSubject(id: string) {
    setSubjectIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      if (wantCount >= MAX_PROFILE_SUBJECTS) {
        return current;
      }
      return [...current, id];
    });
  }

  function addSkillByName(rawValue: string) {
    const value = normalize(rawValue);
    if (!value) return;
    const existing = presetSkillOptions.find(
      (skill) => skill.name.toLowerCase() === value.toLowerCase()
    );
    if (existing) {
      if (!skillIds.includes(existing.id) && canCount < MAX_PROFILE_SKILLS) {
        setSkillIds([...skillIds, existing.id]);
      }
    } else if (
      !customSkillNames.some((n) => n.toLowerCase() === value.toLowerCase()) &&
      canCount < MAX_PROFILE_SKILLS
    ) {
      setCustomSkillNames([...customSkillNames, value]);
    }
  }

  function addCustomSkill() {
    addSkillByName(pickerCustom);
    setPickerCustom("");
  }

  function addSubjectByName(rawValue: string) {
    const value = normalize(rawValue);
    if (!value) return;
    const existing = presetSubjectOptions.find(
      (subject) => subject.name.toLowerCase() === value.toLowerCase()
    );
    if (existing) {
      if (!subjectIds.includes(existing.id) && wantCount < MAX_PROFILE_SUBJECTS) {
        setSubjectIds([...subjectIds, existing.id]);
      }
    } else if (
      !customSubjectNames.some((n) => n.toLowerCase() === value.toLowerCase()) &&
      wantCount < MAX_PROFILE_SUBJECTS
    ) {
      setCustomSubjectNames([...customSubjectNames, value]);
    }
  }

  function addCustomSubject() {
    addSubjectByName(pickerCustom);
    setPickerCustom("");
  }

  function setEnglish(level: EnglishLevelId | null) {
    if (!level) {
      setLanguageSkills((current) =>
        current.filter((skill) => skill.language !== "ENGLISH")
      );
      return;
    }
    setLanguageSkills((current) => {
      const next = current.filter((skill) => skill.language !== "ENGLISH");
      const updated: ProfileLanguageSkill[] = [
        { language: "ENGLISH", level },
        ...next
      ];
      return updated.slice(0, MAX_PROFILE_LANGUAGES);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setFeedback(null);
      const response = await fetch("/api/profile/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillIds,
          customSkillNames,
          subjectIds,
          customSubjectNames,
          languageSkills
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
            "Не удалось сохранить навыки. Попробуйте ещё раз."
          ),
          issues: extractIssueMessages(result)
        });
        return;
      }
      setFeedback({ kind: "success", message: "Сохранено." });
    });
  }

  const skillPickerOptions = [...presetSkillOptions, ...popularSkillOptions];
  const wantPickerOptions = [...presetSubjectOptions, ...popularWantOptions];
  const filteredPresetSkills = pickerSearch
    ? skillPickerOptions.filter((skill) =>
        skill.name.toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : skillPickerOptions;
  const filteredPresetSubjects = pickerSearch
    ? wantPickerOptions.filter((subject) =>
        subject.name.toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : wantPickerOptions;

  return (
    <section className="screen-stack">
      <Link className="back-link" href="/profile/edit" aria-label="Назад">
        ←
      </Link>
      <div className="screen-copy">
        <h1 className="page-title">Навыки и интересы</h1>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
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

        <section className="surface-card screen-stack">
          <h2 className="card-title">Что умеете</h2>
          <div className="chip-row">
            {canChips.map((chip) => (
              <button
                type="button"
                key={chip.key}
                className="chip-pill"
                onClick={() => removeCan(chip.key)}
              >
                <span>{chip.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              type="button"
              className="chip-pill chip-pill-add"
              onClick={() => openPicker("can")}
              disabled={canCount >= MAX_PROFILE_SKILLS}
            >
              + Добавить
            </button>
          </div>
          <p className="helper-text">
            {canCount} из {MAX_PROFILE_SKILLS}
          </p>
        </section>

        <section className="surface-card screen-stack">
          <h2 className="card-title">Что хотите подтянуть</h2>
          <div className="chip-row">
            {wantChips.map((chip) => (
              <button
                type="button"
                key={chip.key}
                className="chip-pill"
                onClick={() => removeWant(chip.key)}
              >
                <span>{chip.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              type="button"
              className="chip-pill chip-pill-add"
              onClick={() => openPicker("want")}
              disabled={wantCount >= MAX_PROFILE_SUBJECTS}
            >
              + Добавить
            </button>
            <button
              type="button"
              className="chip-pill chip-pill-add"
              onClick={() => openPicker("english")}
            >
              + Английский
            </button>
          </div>
          <p className="helper-text">
            {wantCount} из {MAX_PROFILE_SUBJECTS}
          </p>
        </section>

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

      {pickerMode ? (
        <div
          className="picker-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closePicker}
        >
          <div
            className="picker-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="picker-handle" aria-hidden="true" />
            <div className="picker-header">
              <h3 className="card-title">
                {pickerMode === "can"
                  ? "Добавить навык"
                  : pickerMode === "want"
                    ? "Добавить тему"
                    : "Английский"}
              </h3>
              <button
                type="button"
                className="picker-close"
                onClick={closePicker}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            {pickerMode === "english" ? (
              <div className="picker-body">
                <div className="english-level-grid">
                  {englishLevelOptions.map((option) => {
                    const selected = englishLevel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="english-level-chip"
                        data-selected={selected}
                        onClick={() => {
                          setEnglish(selected ? null : option.value);
                          closePicker();
                        }}
                      >
                        <span
                          className="accent-icon-badge"
                          data-tone={selected ? "violet" : "blue"}
                          aria-hidden="true"
                        >
                          {option.value}
                        </span>
                        <span className="english-level-copy">
                          <strong>{option.label}</strong>
                          <small>
                            {selected ? "Выбран" : "Выбрать уровень"}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="picker-body">
                <input
                  className="field-input"
                  placeholder="Поиск"
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                />
                <div className="toggle-grid">
                  {(pickerMode === "can"
                    ? filteredPresetSkills
                    : filteredPresetSubjects
                  ).map((option) => {
                    const selected =
                      pickerMode === "can"
                        ? option.id.startsWith("popular-skill:")
                          ? customSkillNames.some(
                              (name) =>
                                name.toLowerCase() === option.name.toLowerCase()
                            )
                          : skillIds.includes(option.id)
                        : option.id.startsWith("popular-want:")
                          ? customSubjectNames.some(
                              (name) =>
                                name.toLowerCase() === option.name.toLowerCase()
                            )
                          : subjectIds.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className="toggle-chip"
                        data-selected={selected}
                        onClick={() => {
                          if (pickerMode === "can") {
                            if (option.id.startsWith("popular-skill:")) {
                              addSkillByName(option.name);
                            } else {
                              togglePresetSkill(option.id);
                            }
                            return;
                          }

                          if (option.id.startsWith("popular-want:")) {
                            addSubjectByName(option.name);
                          } else {
                            togglePresetSubject(option.id);
                          }
                        }}
                      >
                        {option.name}
                      </button>
                    );
                  })}
                </div>

                <div className="picker-custom-row">
                  <input
                    className="field-input"
                    placeholder="Своё"
                    value={pickerCustom}
                    onChange={(event) => setPickerCustom(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={
                      pickerMode === "can" ? addCustomSkill : addCustomSubject
                    }
                    disabled={!normalize(pickerCustom)}
                  >
                    Добавить
                  </Button>
                </div>

                <Button
                  type="button"
                  fullWidth
                  onClick={closePicker}
                >
                  Готово
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
