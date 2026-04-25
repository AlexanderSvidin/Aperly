"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  englishLevelOptions,
  getCourseOptionsForProgram,
  getProgramsForLevel,
  studyLevelOptions,
  type EnglishLevelId,
  type StudyLevelId,
  type StudySubjectLookup
} from "@/features/study/lib/study-catalog";

type StudySubjectPickerProps = {
  mode: "single" | "multiple";
  subjects: StudySubjectLookup[];
  selectedSubjectIds: string[];
  selectedCustomSubjects: string[];
  studyLevel: StudyLevelId;
  programId: string;
  courseYear: number;
  maxSelection: number;
  onSelectedSubjectIdsChange: (value: string[]) => void;
  onSelectedCustomSubjectsChange: (value: string[]) => void;
  onStudyLevelChange: (value: StudyLevelId) => void;
  onProgramIdChange: (value: string) => void;
  onCourseYearChange: (value: number) => void;
};

const englishLevelVisuals: Record<EnglishLevelId, { caption: string; tone: string }> = {
  A1: {
    caption: "Старт",
    tone: "mint"
  },
  A2: {
    caption: "База",
    tone: "sage"
  },
  B1: {
    caption: "Уверенно",
    tone: "sky"
  },
  B2: {
    caption: "Свободнее",
    tone: "blue"
  },
  C1: {
    caption: "Продвинуто",
    tone: "violet"
  },
  C2: {
    caption: "Профи",
    tone: "rose"
  }
};

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCustomSubject(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toggleSubjectId(
  current: string[],
  nextId: string,
  maxSelection: number
) {
  if (current.includes(nextId)) {
    return current.filter((subjectId) => subjectId !== nextId);
  }

  if (current.length >= maxSelection) {
    return current;
  }

  return [...current, nextId];
}

export function StudySubjectPicker({
  mode,
  subjects,
  selectedSubjectIds,
  selectedCustomSubjects,
  studyLevel,
  programId,
  courseYear,
  maxSelection,
  onSelectedSubjectIdsChange,
  onSelectedCustomSubjectsChange,
  onStudyLevelChange,
  onProgramIdChange,
  onCourseYearChange
}: StudySubjectPickerProps) {
  const [query, setQuery] = useState("");
  const [englishLevel, setEnglishLevel] = useState<EnglishLevelId>("B1");
  const [customSubjectName, setCustomSubjectName] = useState("");

  const availablePrograms = useMemo(
    () => getProgramsForLevel(studyLevel),
    [studyLevel]
  );
  const courseOptions = useMemo(
    () => getCourseOptionsForProgram(programId),
    [programId]
  );

  useEffect(() => {
    if (availablePrograms.length === 0) {
      return;
    }

    if (!availablePrograms.some((program) => program.id === programId)) {
      onProgramIdChange(availablePrograms[0]!.id);
    }
  }, [availablePrograms, onProgramIdChange, programId]);

  useEffect(() => {
    if (courseOptions.length === 0) {
      return;
    }

    if (!courseOptions.includes(courseYear)) {
      onCourseYearChange(courseOptions[0]!);
    }
  }, [courseOptions, courseYear, onCourseYearChange]);

  const normalizedQuery = normalizeSearch(query);

  const programSubjects = useMemo(
    () =>
      subjects.filter(
        (subject) =>
          subject.kind === "PROGRAM" &&
          subject.levelId === studyLevel &&
          subject.programId === programId &&
          subject.courseYear === courseYear
      ),
    [courseYear, programId, studyLevel, subjects]
  );

  const filteredSubjects = useMemo(() => {
    if (!normalizedQuery) {
      return programSubjects;
    }

    return programSubjects.filter((subject) =>
      subject.searchText.includes(normalizedQuery)
    );
  }, [normalizedQuery, programSubjects]);

  const englishSubjects = useMemo(
    () => subjects.filter((subject) => subject.kind === "ENGLISH"),
    [subjects]
  );

  const selectedSubjectMap = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  const totalSelectedCount =
    selectedSubjectIds.length + selectedCustomSubjects.length;

  function selectSubject(subjectId: string) {
    if (mode === "single") {
      onSelectedSubjectIdsChange([subjectId]);
      onSelectedCustomSubjectsChange([]);
      return;
    }

    onSelectedSubjectIdsChange(
      toggleSubjectId(selectedSubjectIds, subjectId, maxSelection)
    );
  }

  function removeSubject(subjectId: string) {
    onSelectedSubjectIdsChange(
      selectedSubjectIds.filter((currentSubjectId) => currentSubjectId !== subjectId)
    );
  }

  function addEnglishSubject() {
    const englishSubject = englishSubjects.find(
      (subject) => subject.englishLevel === englishLevel
    );

    if (!englishSubject) {
      return;
    }

    selectSubject(englishSubject.id);
  }

  function addCustomSubject() {
    const normalizedName = normalizeCustomSubject(customSubjectName);

    if (!normalizedName) {
      return;
    }

    if (mode === "single") {
      onSelectedCustomSubjectsChange([normalizedName]);
      onSelectedSubjectIdsChange([]);
      setCustomSubjectName("");
      return;
    }

    if (
      selectedCustomSubjects.some(
        (subject) => subject.toLowerCase() === normalizedName.toLowerCase()
      )
    ) {
      setCustomSubjectName("");
      return;
    }

    if (totalSelectedCount >= maxSelection) {
      return;
    }

    onSelectedCustomSubjectsChange([...selectedCustomSubjects, normalizedName]);
    setCustomSubjectName("");
  }

  return (
    <div className="study-picker">
      <div className="study-picker-controls">
        <label className="field-stack">
          <span className="field-label">Уровень</span>
          <select
            className="field-input field-select"
            onChange={(event) =>
              onStudyLevelChange(event.target.value as StudyLevelId)
            }
            value={studyLevel}
          >
            {studyLevelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span className="field-label">Программа</span>
          <select
            className="field-input field-select"
            onChange={(event) => onProgramIdChange(event.target.value)}
            value={programId}
          >
            {availablePrograms.map((program) => (
              <option key={program.id} value={program.id}>
                {program.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span className="field-label">Курс</span>
          <select
            className="field-input field-select"
            onChange={(event) => onCourseYearChange(Number(event.target.value))}
            value={String(courseYear)}
          >
            {courseOptions.map((value) => (
              <option key={value} value={value}>
                {value} курс
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field-stack">
        <span className="field-label">Найдите предмет</span>
        <input
          className="field-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Например, экономика, маркетинг или анализ"
          value={query}
        />
      </label>

      {filteredSubjects.length > 0 ? (
        <div className="subject-search-results">
          {filteredSubjects.map((subject) => {
            const isSelected = selectedSubjectIds.includes(subject.id);

            return (
              <button
                key={subject.id}
                className="subject-search-result"
                data-selected={isSelected}
                onClick={() => selectSubject(subject.id)}
                type="button"
              >
                <span>{subject.name}</span>
                <small>{subject.courseYear} курс</small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="subject-empty-state">
          <p className="helper-text">
            По выбранной программе и курсу подходящий предмет не найден. Можно
            выбрать английский или указать свой предмет.
          </p>
        </div>
      )}

      <div className="study-special-actions">
        <div className="study-special-card">
          <div className="special-card-head">
            <span className="accent-icon-badge" data-tone="blue" aria-hidden="true">
              EN
            </span>
            <div className="special-card-copy">
              <span className="field-label">English</span>
            </div>
          </div>
          <div className="english-level-grid">
            {englishLevelOptions.map((option) => {
              const visual = englishLevelVisuals[option.value];

              return (
                <button
                  key={option.value}
                  className="english-level-chip"
                  data-selected={englishLevel === option.value}
                  data-tone={visual.tone}
                  onClick={() => setEnglishLevel(option.value)}
                  type="button"
                >
                  <span
                    className="accent-icon-badge"
                    data-tone={visual.tone}
                    aria-hidden="true"
                  >
                    {option.value}
                  </span>
                  <span className="english-level-copy">
                    <strong>{option.label}</strong>
                    <small>{visual.caption}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            disabled={totalSelectedCount >= maxSelection && mode === "multiple"}
            onClick={addEnglishSubject}
            type="button"
            variant="secondary"
          >
            Добавить
          </Button>
        </div>

        <div className="study-special-card">
          <div className="special-card-copy">
            <span className="field-label">Своё</span>
            <p className="helper-text">
              Если предмета нет в каталоге, впишите свой вариант.
            </p>
          </div>
          <div className="study-inline-actions">
            <input
              className="field-input"
              onChange={(event) => setCustomSubjectName(event.target.value)}
              placeholder="Введите название предмета"
              value={customSubjectName}
            />
            <Button
              disabled={
                !normalizeCustomSubject(customSubjectName) ||
                (totalSelectedCount >= maxSelection && mode === "multiple")
              }
              onClick={addCustomSubject}
              type="button"
              variant="secondary"
            >
              Добавить
            </Button>
          </div>
        </div>
      </div>

      <div className="field-stack">
        <span className="field-label">Выбрано</span>
        {selectedSubjectIds.length === 0 && selectedCustomSubjects.length === 0 ? (
          <p className="helper-text">
            Выберите предмет из каталога, English по уровню или свой вариант.
          </p>
        ) : (
          <div className="selected-subject-list">
            {selectedSubjectIds.map((subjectId) => {
              const subject = selectedSubjectMap.get(subjectId);

              if (!subject) {
                return null;
              }

              return (
                <button
                  key={subjectId}
                  className="selected-subject-chip"
                  onClick={() => removeSubject(subjectId)}
                  type="button"
                >
                  <span>{subject.name}</span>
                  <small>Убрать</small>
                </button>
              );
            })}

            {selectedCustomSubjects.map((subjectName) => (
              <button
                key={subjectName}
                className="selected-subject-chip"
                onClick={() =>
                  onSelectedCustomSubjectsChange(
                    selectedCustomSubjects.filter(
                      (currentSubjectName) => currentSubjectName !== subjectName
                    )
                  )
                }
                type="button"
              >
                <span>{subjectName}</span>
                <small>Убрать</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
