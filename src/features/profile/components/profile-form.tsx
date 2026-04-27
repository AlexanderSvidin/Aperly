"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  MAX_AVAILABILITY_SLOTS,
  MAX_PROFILE_LANGUAGES,
  MAX_PROFILE_SKILLS,
  MAX_PROFILE_SUBJECTS,
  dayOfWeekOptions,
  formatOptions,
  minuteToTimeValue,
  scenarioOptions,
  timeValueToMinute
} from "@/features/profile/lib/profile-options";
import type {
  ProfileAvailabilitySlot,
  ProfileDraft,
  ProfileLanguageSkill
} from "@/features/profile/lib/profile-schema";
import { StudySubjectPicker } from "@/features/study/components/study-subject-picker";
import {
  englishLevelOptions,
  type EnglishLevelId,
  type StudyLevelId
} from "@/features/study/lib/study-catalog";

type SkillLookupItem = {
  id: string;
  name: string;
  slug: string;
};

type SubjectLookupItem = {
  id: string;
  name: string;
  slug: string;
  levelId: "BACHELOR" | "MASTER" | null;
  programId: string | null;
  courseYear: number | null;
  kind: "PROGRAM" | "CUSTOM" | "OTHER";
  searchText: string;
};

type ProfileFormProps = {
  initialValues: ProfileDraft;
  lookups: {
    skills: SkillLookupItem[];
    subjects: SubjectLookupItem[];
  };
  mode: "onboarding" | "edit";
};

type AvailabilityDraft = {
  id: string;
  dayOfWeek: ProfileAvailabilitySlot["dayOfWeek"];
  startTime: string;
  endTime: string;
};

type FeedbackState = {
  kind: "error" | "success";
  message: string;
  issues?: string[];
};

function createAvailabilityId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultAvailabilitySlot(): AvailabilityDraft {
  return {
    id: createAvailabilityId(),
    dayOfWeek: "MONDAY",
    startTime: "18:00",
    endTime: "20:00"
  };
}

function mapAvailabilityToDraft(slots: ProfileAvailabilitySlot[]) {
  if (slots.length === 0) {
    return [createDefaultAvailabilitySlot()];
  }

  return slots.map((slot) => ({
    id: createAvailabilityId(),
    dayOfWeek: slot.dayOfWeek,
    startTime: minuteToTimeValue(slot.startMinute),
    endTime: minuteToTimeValue(slot.endMinute)
  }));
}

function toggleValue<T extends string>(values: T[], nextValue: T, maxItems: number) {
  if (values.includes(nextValue)) {
    return values.filter((value) => value !== nextValue);
  }

  if (values.length >= maxItems) {
    return values;
  }

  return [...values, nextValue];
}

function normalizeCustomSkill(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

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

export function ProfileForm({ initialValues, lookups, mode }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [fullName, setFullName] = useState(initialValues.fullName);
  const [bio, setBio] = useState(initialValues.bio);
  const [studyLevel, setStudyLevel] = useState<StudyLevelId>(initialValues.studyLevel);
  const [programId, setProgramId] = useState(initialValues.programId);
  const [courseYear, setCourseYear] = useState(initialValues.courseYear);
  const [skillIds, setSkillIds] = useState(initialValues.skillIds);
  const [customSkillNames, setCustomSkillNames] = useState(
    initialValues.customSkillNames
  );
  const [customSkillName, setCustomSkillName] = useState("");
  const [subjectIds, setSubjectIds] = useState(initialValues.subjectIds);
  const [customSubjectNames, setCustomSubjectNames] = useState(
    initialValues.customSubjectNames
  );
  const [languageSkills, setLanguageSkills] = useState(
    initialValues.languageSkills
  );
  const [preferredFormats, setPreferredFormats] = useState(
    initialValues.preferredFormats
  );
  const [availabilitySlots, setAvailabilitySlots] = useState(
    mapAvailabilityToDraft(initialValues.availabilitySlots)
  );
  const [isDiscoverable, setIsDiscoverable] = useState(
    initialValues.isDiscoverable
  );
  const [discoverableScenarios, setDiscoverableScenarios] = useState(
    initialValues.discoverableScenarios
  );

  const matchingHint =
    mode === "onboarding"
      ? "После сохранения вы сможете выбрать сценарий и начать поиск."
      : "Изменения в профиле сразу влияют на подбор. Обновлённые совпадения появятся в подборках.";

  const presetSkillOptions = lookups.skills.filter(
    (skill) => !skill.slug.startsWith("custom-")
  );
  const selectedSkillCount = skillIds.length + customSkillNames.length;

  function togglePresetSkill(skillId: string) {
    setSkillIds((current) => {
      if (current.includes(skillId)) {
        return current.filter((currentSkillId) => currentSkillId !== skillId);
      }

      if (current.length + customSkillNames.length >= MAX_PROFILE_SKILLS) {
        return current;
      }

      return [...current, skillId];
    });
  }

  function addCustomSkill() {
    const normalizedName = normalizeCustomSkill(customSkillName);

    if (!normalizedName) {
      return;
    }

    const existingPresetSkill = presetSkillOptions.find(
      (skill) => skill.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (existingPresetSkill) {
      setSkillIds((current) => {
        if (current.includes(existingPresetSkill.id)) {
          return current;
        }

        if (current.length + customSkillNames.length >= MAX_PROFILE_SKILLS) {
          return current;
        }

        return [...current, existingPresetSkill.id];
      });
      setCustomSkillName("");
      return;
    }

    if (
      customSkillNames.some(
        (skillName) => skillName.toLowerCase() === normalizedName.toLowerCase()
      )
    ) {
      setCustomSkillName("");
      return;
    }

    if (selectedSkillCount >= MAX_PROFILE_SKILLS) {
      return;
    }

    setCustomSkillNames([...customSkillNames, normalizedName]);
    setCustomSkillName("");
  }

  function toggleEnglishLevel(level: EnglishLevelId) {
    setLanguageSkills((current) => {
      const existing = current.find((skill) => skill.language === "ENGLISH");

      if (existing?.level === level) {
        return current.filter((skill) => skill.language !== "ENGLISH");
      }

      const nextSkill: ProfileLanguageSkill = {
        language: "ENGLISH",
        level
      };

      return [
        nextSkill,
        ...current.filter((skill) => skill.language !== "ENGLISH")
      ].slice(0, MAX_PROFILE_LANGUAGES);
    });
  }

  function updateAvailability(
    slotId: string,
    field: keyof Omit<AvailabilityDraft, "id">,
    value: string
  ) {
    setAvailabilitySlots((currentSlots) =>
      currentSlots.map((slot) => {
        if (slot.id !== slotId) {
          return slot;
        }

        if (field === "dayOfWeek") {
          return {
            ...slot,
            dayOfWeek: value as ProfileAvailabilitySlot["dayOfWeek"]
          };
        }

        if (field === "startTime") {
          return {
            ...slot,
            startTime: value
          };
        }

        return {
          ...slot,
          endTime: value
        };
      })
    );
  }

  function addAvailabilitySlot() {
    setAvailabilitySlots((currentSlots) => {
      if (currentSlots.length >= MAX_AVAILABILITY_SLOTS) {
        return currentSlots;
      }

      return [...currentSlots, createDefaultAvailabilitySlot()];
    });
  }

  function removeAvailabilitySlot(slotId: string) {
    setAvailabilitySlots((currentSlots) => {
      if (currentSlots.length === 1) {
        return currentSlots;
      }

      return currentSlots.filter((slot) => slot.id !== slotId);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      setFeedback(null);

      const payload = {
        fullName,
        bio,
        studyLevel,
        programId,
        courseYear,
        skillIds,
        customSkillNames,
        subjectIds,
        customSubjectNames,
        languageSkills,
        preferredFormats,
        availabilitySlots: availabilitySlots.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startMinute: timeValueToMinute(slot.startTime),
          endMinute: timeValueToMinute(slot.endTime)
        })),
        isDiscoverable,
        discoverableScenarios: isDiscoverable ? discoverableScenarios : []
      };

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = (await response.json().catch(() => null)) as
        | {
            matchingRelevantFieldsChanged?: boolean;
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

      if (mode === "onboarding") {
        router.push("/home?welcome=1");
        router.refresh();
        return;
      }

      setFeedback({
        kind: "success",
        message:
          result?.matchingRelevantFieldsChanged
            ? "Профиль сохранён. Подбор обновлён с учётом новых данных."
            : "Профиль сохранён."
      });

      router.refresh();
    });
  }

  return (
    <form className="profile-form" onSubmit={handleSubmit}>
      <div className="surface-card screen-stack">
        <div className="screen-copy">
          <h2 className="screen-title">
            {mode === "onboarding"
              ? "Короткий профиль для подбора"
              : "Редактирование профиля"}
          </h2>
          <p className="screen-description">
            {mode === "onboarding"
              ? "Несколько полей — и система сразу начнёт подбирать людей."
              : "Профиль можно обновлять в любой момент. Контакты откроются только при взаимном согласии в чате."}
          </p>
        </div>

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
          <span className="field-label">Как к вам обращаться</span>
          <input
            className="field-input"
            maxLength={160}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Например, Анна или Анна Павлова"
            required
            value={fullName}
          />
        </label>

        <label className="field-stack">
          <span className="field-label">Коротко о себе</span>
          <textarea
            className="field-textarea"
            maxLength={400}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Чем вы полезны команде или как вам удобнее учиться вместе"
            required
            rows={4}
            value={bio}
          />
        </label>
      </div>

      <div className="surface-card screen-stack">
        <div className="card-header">
          <p className="card-eyebrow">Учёба</p>
          <h2 className="card-title">Программа и предметы</h2>
        </div>

        <StudySubjectPicker
          courseYear={courseYear}
          maxSelection={MAX_PROFILE_SUBJECTS}
          mode="multiple"
          onCourseYearChange={setCourseYear}
          onProgramIdChange={setProgramId}
          onSelectedCustomSubjectsChange={setCustomSubjectNames}
          onSelectedSubjectIdsChange={setSubjectIds}
          onStudyLevelChange={setStudyLevel}
          programId={programId}
          selectedCustomSubjects={customSubjectNames}
          selectedSubjectIds={subjectIds}
          studyLevel={studyLevel}
          subjects={lookups.subjects}
        />
      </div>

      <div className="surface-card screen-stack">
        <div className="card-header">
          <p className="card-eyebrow">Языки</p>
          <h2 className="card-title">Английский отдельно от предметов</h2>
        </div>

        <p className="helper-text">
          Английский не участвует в списке учебных предметов. Укажите уровень
          как отдельный языковой навык, чтобы не смешивать дисциплины и языки.
        </p>

        <div className="english-level-grid">
          {englishLevelOptions.map((option) => {
            const selected = languageSkills.some(
              (skill) =>
                skill.language === "ENGLISH" && skill.level === option.value
            );

            return (
              <button
                key={option.value}
                className="english-level-chip"
                data-selected={selected}
                onClick={() => toggleEnglishLevel(option.value)}
                type="button"
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
                  <small>{selected ? "Выбран" : "Добавить уровень"}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="surface-card screen-stack">
        <div className="card-header">
          <p className="card-eyebrow">Подбор</p>
          <h2 className="card-title">Навыки и формат</h2>
        </div>

        <div className="field-stack">
          <span className="field-label">Навыки</span>
          <div className="toggle-grid">
            {presetSkillOptions.map((skill) => {
              const selected = skillIds.includes(skill.id);

              return (
                <button
                  key={skill.id}
                  className="toggle-chip"
                  data-selected={selected}
                  onClick={() => togglePresetSkill(skill.id)}
                  type="button"
                >
                  {skill.name}
                </button>
              );
            })}
          </div>
          <p className="helper-text">
            Выбрано {selectedSkillCount} из {MAX_PROFILE_SKILLS}. Можно выбрать
            готовые навыки или добавить свой вариант.
          </p>

          <div className="study-special-card skill-custom-card">
            <div className="special-card-copy">
              <span className="field-label">Своё</span>
              <p className="helper-text">
                Если нужного навыка нет в списке, добавьте его вручную.
              </p>
            </div>
            <div className="study-inline-actions">
              <input
                className="field-input"
                onChange={(event) => setCustomSkillName(event.target.value)}
                placeholder="Например, SQL, SMM или Excel"
                value={customSkillName}
              />
              <Button
                disabled={
                  !normalizeCustomSkill(customSkillName) ||
                  selectedSkillCount >= MAX_PROFILE_SKILLS
                }
                onClick={addCustomSkill}
                type="button"
                variant="secondary"
              >
                Добавить
              </Button>
            </div>
          </div>

          {customSkillNames.length > 0 ? (
            <div className="selected-subject-list">
              {customSkillNames.map((skillName) => (
                <button
                  key={skillName}
                  className="selected-subject-chip"
                  onClick={() =>
                    setCustomSkillNames((current) =>
                      current.filter((currentSkillName) => currentSkillName !== skillName)
                    )
                  }
                  type="button"
                >
                  <span>{skillName}</span>
                  <small>Убрать</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="field-stack">
          <span className="field-label">Как вам удобнее взаимодействовать</span>
          <div className="toggle-grid toggle-grid-compact">
            {formatOptions.map((format) => {
              const selected = preferredFormats.includes(format.value);

              return (
                <button
                  key={format.value}
                  className="toggle-chip"
                  data-selected={selected}
                  onClick={() =>
                    setPreferredFormats((current) =>
                      toggleValue(current, format.value, formatOptions.length)
                    )
                  }
                  type="button"
                >
                  {format.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="surface-card screen-stack">
        <div className="card-header">
          <p className="card-eyebrow">Доступность</p>
          <h2 className="card-title">Когда вам удобно</h2>
        </div>

        <div className="field-stack">
          <span className="field-label">Свободные слоты</span>
          <p className="helper-text">
            Один слот — это один день недели и промежуток времени. Это поможет
            найти людей с похожим расписанием.
          </p>
          <div className="availability-stack">
            {availabilitySlots.map((slot) => (
              <div key={slot.id} className="availability-row availability-slot-card">
                <div className="avail-day-row">
                  <label className="field-stack availability-field">
                    <span className="field-caption">День</span>
                    <select
                      className="field-input field-select"
                      onChange={(event) =>
                        updateAvailability(slot.id, "dayOfWeek", event.target.value)
                      }
                      value={slot.dayOfWeek}
                    >
                      {dayOfWeekOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    onClick={() => removeAvailabilitySlot(slot.id)}
                    type="button"
                    variant="ghost"
                  >
                    Убрать
                  </Button>
                </div>

                <div className="avail-time-row">
                  <label className="field-stack availability-field">
                    <span className="field-caption">С</span>
                    <input
                      aria-label="Время начала"
                      className="field-input field-time-input"
                      onChange={(event) =>
                        updateAvailability(slot.id, "startTime", event.target.value)
                      }
                      step={300}
                      type="time"
                      value={slot.startTime}
                    />
                  </label>
                  <label className="field-stack availability-field">
                    <span className="field-caption">До</span>
                    <input
                      aria-label="Время окончания"
                      className="field-input field-time-input"
                      onChange={(event) =>
                        updateAvailability(slot.id, "endTime", event.target.value)
                      }
                      step={300}
                      type="time"
                      value={slot.endTime}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="form-actions-inline">
            <Button
              disabled={availabilitySlots.length >= MAX_AVAILABILITY_SLOTS}
              onClick={addAvailabilitySlot}
              type="button"
              variant="secondary"
            >
              Добавить слот
            </Button>
            <p className="helper-text">
              Обычно хватает 1–3 слотов. Время указывайте в формате часы:минуты.
            </p>
          </div>
        </div>
      </div>

      <div className="surface-card screen-stack">
        <div className="card-header">
          <p className="card-eyebrow">Видимость</p>
          <h2 className="card-title">Резервный подбор по профилю</h2>
        </div>

        <label className="checkbox-row">
          <input
            checked={isDiscoverable}
            onChange={(event) => {
              const nextChecked = event.target.checked;

              setIsDiscoverable(nextChecked);

              if (!nextChecked) {
                setDiscoverableScenarios([]);
              }
            }}
            type="checkbox"
          />
          <span>
            Показывать мой профиль, когда активных подходящих запросов мало
          </span>
        </label>

        <p className="helper-text">
          Это помогает не терять людей на холодном старте и быстрее получить
          первые отклики.
        </p>

        <div className="toggle-grid toggle-grid-compact">
          {scenarioOptions.map((scenario) => {
            const selected = discoverableScenarios.includes(scenario.value);

            return (
              <button
                key={scenario.value}
                className="toggle-chip"
                data-selected={selected}
                disabled={!isDiscoverable}
                onClick={() =>
                  setDiscoverableScenarios((current) =>
                    toggleValue(current, scenario.value, scenarioOptions.length)
                  )
                }
                type="button"
              >
                {scenario.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="surface-card screen-stack">
        <p className="helper-text">{matchingHint}</p>
        <Button disabled={isPending} fullWidth type="submit">
          {isPending
            ? "Сохраняем..."
            : mode === "onboarding"
              ? "Сохранить и перейти к сценарию"
              : "Сохранить профиль"}
        </Button>
      </div>
    </form>
  );
}
