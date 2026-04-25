"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { minuteToTimeValue } from "@/features/profile/lib/profile-options";
import {
  collaborationRoleOptions,
  commitmentOptions,
  formatRequestDate,
  minuteRangeToLabel,
  preferredTimeOptions,
  projectStageOptions,
  requestDayOfWeekOptions,
  requestFormatOptions,
  requestScenarioOptions,
  requestStatusLabels,
  requestStatusTone,
  studyFrequencyOptions,
  timeLabelToMinute,
  toDateInputValue
} from "@/features/requests/lib/request-options";
import type {
  RequestScenario,
  SerializedRequest
} from "@/features/requests/lib/request-schema";
import { StudySubjectPicker } from "@/features/study/components/study-subject-picker";
import { type StudyLevelId } from "@/features/study/lib/study-catalog";

type SubjectOption = {
  id: string;
  name: string;
  slug: string;
  levelId: "BACHELOR" | "MASTER" | null;
  programId: string | null;
  courseYear: number | null;
  kind: "PROGRAM" | "ENGLISH" | "CUSTOM" | "OTHER";
  englishLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;
  searchText: string;
};

type RequestComposerShellProps = {
  initialRequests: SerializedRequest[];
  subjects: SubjectOption[];
  studyDefaults: {
    studyLevel: "BACHELOR" | "MASTER";
    programId: string;
    courseYear: number;
  };
  initialScenario?: RequestScenario;
};

type AvailabilityDraft = {
  id: string;
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  startTime: string;
  endTime: string;
};

type CaseDraft = {
  scenario: "CASE";
  notes: string;
  availabilitySlots: AvailabilityDraft[];
  details: {
    eventName: string;
    deadline: string;
    neededRoles: typeof collaborationRoleOptions[number]["value"][];
    teamGapSize: string;
    preferredFormat: typeof requestFormatOptions[number]["value"];
  };
};

type ProjectDraft = {
  scenario: "PROJECT";
  notes: string;
  details: {
    projectTitle: string;
    shortDescription: string;
    stage: typeof projectStageOptions[number]["value"];
    neededRoles: typeof collaborationRoleOptions[number]["value"][];
    expectedCommitment: typeof commitmentOptions[number]["value"];
    preferredFormat: typeof requestFormatOptions[number]["value"];
  };
};

type StudyDraft = {
  scenario: "STUDY";
  notes: string;
  details: {
    subjectId: string;
    customSubjectName: string;
    currentContext: string;
    goal: string;
    desiredFrequency: typeof studyFrequencyOptions[number]["value"];
    preferredTime: typeof preferredTimeOptions[number]["value"];
    preferredFormat: typeof requestFormatOptions[number]["value"];
  };
};

type RequestDraft = CaseDraft | ProjectDraft | StudyDraft;

type FeedbackState = {
  kind: "error" | "success";
  message: string;
  issues?: string[];
};

function createAvailabilityId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req-slot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultAvailabilitySlot(): AvailabilityDraft {
  return {
    id: createAvailabilityId(),
    dayOfWeek: "MONDAY",
    startTime: "18:00",
    endTime: "20:00"
  };
}

function createDefaultDraft(
  scenario: RequestScenario,
  subjects: SubjectOption[]
): RequestDraft {
  if (scenario === "CASE") {
    return {
      scenario,
      notes: "",
      availabilitySlots: [createDefaultAvailabilitySlot()],
      details: {
        eventName: "",
        deadline: "",
        neededRoles: [],
        teamGapSize: "2",
        preferredFormat: "HYBRID"
      }
    };
  }

  if (scenario === "PROJECT") {
    return {
      scenario,
      notes: "",
      details: {
        projectTitle: "",
        shortDescription: "",
        stage: "IDEA",
        neededRoles: [],
        expectedCommitment: "FLEXIBLE",
        preferredFormat: "HYBRID"
      }
    };
  }

  return {
    scenario,
    notes: "",
    details: {
      subjectId: subjects[0]?.id ?? "",
      customSubjectName: "",
      currentContext: "",
      goal: "",
      desiredFrequency: "WEEKLY",
      preferredTime: "EVENING",
      preferredFormat: "HYBRID"
    }
  };
}

function createDraftFromRequest(request: SerializedRequest): RequestDraft {
  if (request.details.type === "CASE") {
    return {
      scenario: "CASE",
      notes: request.notes ?? "",
      availabilitySlots:
        request.availabilitySlots.length > 0
          ? request.availabilitySlots.map((slot) => ({
              id: createAvailabilityId(),
              dayOfWeek: slot.dayOfWeek,
              startTime: minuteToTimeValue(slot.startMinute),
              endTime: minuteToTimeValue(slot.endMinute)
            }))
          : [createDefaultAvailabilitySlot()],
      details: {
        eventName: request.details.eventName,
        deadline: toDateInputValue(request.details.deadline),
        neededRoles: request.details.neededRoles,
        teamGapSize: String(request.details.teamGapSize),
        preferredFormat: request.details.preferredFormat
      }
    };
  }

  if (request.details.type === "PROJECT") {
    return {
      scenario: "PROJECT",
      notes: request.notes ?? "",
      details: {
        projectTitle: request.details.projectTitle,
        shortDescription: request.details.shortDescription,
        stage: request.details.stage,
        neededRoles: request.details.neededRoles,
        expectedCommitment: request.details.expectedCommitment,
        preferredFormat: request.details.preferredFormat
      }
    };
  }

  return {
    scenario: "STUDY",
    notes: request.notes ?? "",
    details: {
      subjectId: request.details.subjectId,
      customSubjectName: "",
      currentContext: request.details.currentContext,
      goal: request.details.goal,
      desiredFrequency: request.details.desiredFrequency,
      preferredTime: request.details.preferredTime,
      preferredFormat: request.details.preferredFormat
    }
  };
}

function toggleValue<T extends string>(values: T[], nextValue: T) {
  if (values.includes(nextValue)) {
    return values.filter((value) => value !== nextValue);
  }

  return [...values, nextValue];
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

function summarizeRequest(request: SerializedRequest) {
  if (request.details.type === "CASE") {
    return request.details.eventName;
  }

  if (request.details.type === "PROJECT") {
    return request.details.projectTitle;
  }

  return request.details.subjectName;
}

function findOptionLabel(
  options: readonly {
    value: string;
    label: string;
  }[],
  value: string
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function describeRequest(request: SerializedRequest) {
  if (request.details.type === "CASE") {
    return `������ ����: ${request.details.neededRoles.length}, ������ ${findOptionLabel(
      requestFormatOptions,
      request.details.preferredFormat
    ).toLowerCase()}`;
  }

  if (request.details.type === "PROJECT") {
    return `������ ${findOptionLabel(
      projectStageOptions,
      request.details.stage
    ).toLowerCase()}, ������ ${findOptionLabel(
      requestFormatOptions,
      request.details.preferredFormat
    ).toLowerCase()}`;
  }

  return `������� ${findOptionLabel(
    studyFrequencyOptions,
    request.details.desiredFrequency
  ).toLowerCase()}, ����� ${findOptionLabel(
    preferredTimeOptions,
    request.details.preferredTime
  ).toLowerCase()}`;
}

function upsertRequestInList(requests: SerializedRequest[], nextRequest: SerializedRequest) {
  const filtered = requests.filter((request) => request.id !== nextRequest.id);

  return [nextRequest, ...filtered].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function RequestComposerShell({
  initialRequests,
  subjects,
  studyDefaults,
  initialScenario
}: RequestComposerShellProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRequestsByScenario = useMemo(() => {
    const activeEntries = new Map<RequestScenario, SerializedRequest>();

    for (const request of requests) {
      if (request.status === "ACTIVE" && !activeEntries.has(request.scenario)) {
        activeEntries.set(request.scenario, request);
      }
    }

    return activeEntries;
  }, [requests]);

  const latestRequestsByScenario = useMemo(() => {
    const latestEntries = new Map<RequestScenario, SerializedRequest>();

    for (const request of requests) {
      if (!latestEntries.has(request.scenario)) {
        latestEntries.set(request.scenario, request);
      }
    }

    return latestEntries;
  }, [requests]);

  const [selectedScenario, setSelectedScenario] =
    useState<RequestScenario | null>(initialScenario ?? null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(
    initialScenario ? activeRequestsByScenario.get(initialScenario)?.id ?? null : null
  );
  const [draft, setDraft] = useState<RequestDraft | null>(() => {
    if (!initialScenario) {
      return null;
    }

    const activeRequest = activeRequestsByScenario.get(initialScenario);

    return activeRequest
      ? createDraftFromRequest(activeRequest)
      : createDefaultDraft(initialScenario, subjects);
  });
  const [studyLevel, setStudyLevel] = useState<StudyLevelId>(
    studyDefaults.studyLevel
  );
  const [studyProgramId, setStudyProgramId] = useState(studyDefaults.programId);
  const [studyCourseYear, setStudyCourseYear] = useState(studyDefaults.courseYear);

  function selectScenario(scenario: RequestScenario) {
    const activeRequest = activeRequestsByScenario.get(scenario);

    setSelectedScenario(scenario);
    setEditingRequestId(activeRequest?.id ?? null);
    setDraft(
      activeRequest
        ? createDraftFromRequest(activeRequest)
        : createDefaultDraft(scenario, subjects)
    );
    setFeedback(null);
  }

  function startEditingRequest(request: SerializedRequest) {
    setSelectedScenario(request.scenario);
    setEditingRequestId(request.status === "ACTIVE" ? request.id : null);
    setDraft(createDraftFromRequest(request));
    setFeedback(null);
  }

  function addCaseAvailabilitySlot() {
    if (!draft || draft.scenario !== "CASE") {
      return;
    }

    setDraft({
      ...draft,
      availabilitySlots: [...draft.availabilitySlots, createDefaultAvailabilitySlot()]
    });
  }

  function removeCaseAvailabilitySlot(slotId: string) {
    if (!draft || draft.scenario !== "CASE") {
      return;
    }

    setDraft({
      ...draft,
      availabilitySlots:
        draft.availabilitySlots.length === 1
          ? draft.availabilitySlots
          : draft.availabilitySlots.filter((slot) => slot.id !== slotId)
    });
  }

  function updateCaseAvailabilitySlot(
    slotId: string,
    field: "dayOfWeek" | "startTime" | "endTime",
    value: string
  ) {
    if (!draft || draft.scenario !== "CASE") {
      return;
    }

    setDraft({
      ...draft,
      availabilitySlots: draft.availabilitySlots.map((slot) => {
        if (slot.id !== slotId) {
          return slot;
        }

        if (field === "dayOfWeek") {
          return {
            ...slot,
            dayOfWeek: value as AvailabilityDraft["dayOfWeek"]
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
    });
  }

  async function mutateRequestList(
    endpoint: string,
    method: "POST" | "PATCH",
    body?: object
  ) {
    const response = await fetch(endpoint, {
      method,
      headers: body
        ? {
            "Content-Type": "application/json"
          }
        : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    return response;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      setFeedback({
        kind: "error",
        message: "������� �������� ��������."
      });
      return;
    }

    startTransition(async () => {
      setFeedback(null);

      const payload =
        draft.scenario === "CASE"
          ? {
              scenario: draft.scenario,
              notes: draft.notes,
              availabilitySlots: draft.availabilitySlots.map((slot) => ({
                dayOfWeek: slot.dayOfWeek,
                startMinute: timeLabelToMinute(slot.startTime),
                endMinute: timeLabelToMinute(slot.endTime)
              })),
              details: {
                eventName: draft.details.eventName,
                deadline: draft.details.deadline || null,
                neededRoles: draft.details.neededRoles,
                teamGapSize: Number(draft.details.teamGapSize),
                preferredFormat: draft.details.preferredFormat
              }
            }
          : draft.scenario === "PROJECT"
            ? {
                scenario: draft.scenario,
                notes: draft.notes,
                availabilitySlots: [],
                details: {
                  projectTitle: draft.details.projectTitle,
                  shortDescription: draft.details.shortDescription,
                  stage: draft.details.stage,
                  neededRoles: draft.details.neededRoles,
                  expectedCommitment: draft.details.expectedCommitment,
                  preferredFormat: draft.details.preferredFormat
                }
              }
            : {
                scenario: draft.scenario,
                notes: draft.notes,
                availabilitySlots: [],
                details: {
                  subjectId: draft.details.subjectId || null,
                  customSubjectName: draft.details.customSubjectName || null,
                  currentContext: draft.details.currentContext,
                  goal: draft.details.goal,
                  desiredFrequency: draft.details.desiredFrequency,
                  preferredTime: draft.details.preferredTime,
                  preferredFormat: draft.details.preferredFormat
                }
              };

      const response = await mutateRequestList(
        editingRequestId ? `/api/requests/${editingRequestId}` : "/api/requests",
        editingRequestId ? "PATCH" : "POST",
        payload
      );

      const result = (await response.json().catch(() => null)) as
        | {
            request?: SerializedRequest;
            message?: string;
            issues?: unknown[];
            meta?: {
              requestId?: string;
            };
          }
        | null;

      if (!response.ok || !result?.request) {
        if (result?.meta?.requestId) {
          const existingRequest = requests.find(
            (request) => request.id === result.meta?.requestId
          );

          if (existingRequest) {
            startEditingRequest(existingRequest);
          }
        }

        setFeedback({
          kind: "error",
          message: result?.message ?? "�� ������� ��������� ������.",
          issues: extractIssueMessages(result)
        });
        return;
      }

      setRequests((currentRequests) =>
        upsertRequestInList(currentRequests, result.request!)
      );
      setEditingRequestId(result.request.id);
      setDraft(createDraftFromRequest(result.request));
      setSelectedScenario(result.request.scenario);
      setFeedback({
        kind: "success",
        message:
          result.request.status === "ACTIVE"
            ? "������ �������. ������ ����� ������� �� ������ ����������."
            : "������ �������."
      });
    });
  }

  function handleArchive(requestId: string) {
    startTransition(async () => {
      setFeedback(null);

      const response = await mutateRequestList(
        `/api/requests/${requestId}/archive`,
        "POST"
      );
      const result = (await response.json().catch(() => null)) as
        | {
            request?: SerializedRequest;
            message?: string;
          }
        | null;

      if (!response.ok || !result?.request) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "�� ������� ������������ ������."
        });
        return;
      }

      setRequests((currentRequests) =>
        upsertRequestInList(currentRequests, result.request!)
      );

      if (editingRequestId === requestId && selectedScenario) {
        setEditingRequestId(null);
        setDraft(createDefaultDraft(selectedScenario, subjects));
      }

      setFeedback({
        kind: "success",
        message: "������ �����������."
      });
    });
  }

  function handleRenew(requestId: string) {
    startTransition(async () => {
      setFeedback(null);

      const response = await mutateRequestList(
        `/api/requests/${requestId}/renew`,
        "POST"
      );
      const result = (await response.json().catch(() => null)) as
        | {
            request?: SerializedRequest;
            message?: string;
          }
        | null;

      if (!response.ok || !result?.request) {
        setFeedback({
          kind: "error",
          message: result?.message ?? "�� ������� �������� ������."
        });
        return;
      }

      setRequests((currentRequests) =>
        upsertRequestInList(currentRequests, result.request!)
      );
      startEditingRequest(result.request);
      setEditingRequestId(result.request.id);
      setFeedback({
        kind: "success",
        message: "������ ����� �������."
      });
    });
  }

  const latestForSelectedScenario = selectedScenario
    ? latestRequestsByScenario.get(selectedScenario)
    : undefined;
  const activeForSelectedScenario = selectedScenario
    ? activeRequestsByScenario.get(selectedScenario)
    : undefined;

  return (
    <section className="screen-stack">
      <div className="screen-copy">
        <h1 className="screen-title">�������</h1>
        <p className="screen-description">
          ���� �������� � ���� �������� ������. ��������, ��� �� ����� ������,
          � ��������� �������� ����� ��� ������ �����.
        </p>
      </div>

      <div className="screen-grid">
        {requestScenarioOptions.map((scenario) => {
          const request = latestRequestsByScenario.get(scenario.value);

          return (
            <Card key={scenario.value} eyebrow="��������" title={scenario.label}>
              <div className="screen-stack">
                <span
                  className="tone-pill"
                  data-tone={request ? requestStatusTone[request.status] : "neutral"}
                >
                  {request ? requestStatusLabels[request.status] : "������� ��� ���"}
                </span>

                <p className="card-body-copy">
                  {request
                    ? summarizeRequest(request)
                    : "������� �������� �������� � �������� ������ ������."}
                </p>

                {request ? (
                  <p className="helper-text">{describeRequest(request)}</p>
                ) : null}

                <div className="request-card-actions">
                  <Button
                    fullWidth
                    onClick={() => {
                      if (request?.status === "ACTIVE") {
                        startEditingRequest(request);
                        return;
                      }

                      selectScenario(scenario.value);
                    }}
                    variant={request?.status === "ACTIVE" ? "secondary" : "primary"}
                  >
                    {request?.status === "ACTIVE" ? "�������������" : "������� �����"}
                  </Button>

                  {request?.status === "ACTIVE" ? (
                    <Button
                      fullWidth
                      onClick={() => handleArchive(request.id)}
                      variant="ghost"
                    >
                      ������������
                    </Button>
                  ) : null}

                  {request && request.status !== "ACTIVE" ? (
                    <Button
                      fullWidth
                      onClick={() => handleRenew(request.id)}
                      variant="secondary"
                    >
                      ��������
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card eyebrow="�����" title="������� ��� �������� ������">
        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="field-stack">
            <span className="field-label">��� �� �����</span>
            <div className="toggle-grid">
              {requestScenarioOptions.map((scenario) => (
                <button
                  key={scenario.value}
                  className="toggle-chip"
                  data-selected={selectedScenario === scenario.value}
                  onClick={() => selectScenario(scenario.value)}
                  type="button"
                >
                  {scenario.label}
                </button>
              ))}
            </div>
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

          <div className="request-inline-banner">
            <p className="helper-text">
              {selectedScenario
                ? activeForSelectedScenario
                  ? "��� ����� �������� ��� ���� �������� ������. �� ������������ ��� ������ �������� �����."
                  : latestForSelectedScenario
                    ? `��������� ������ ����� �������� ������ � ������� �${requestStatusLabels[latestForSelectedScenario.status]}�.`
                    : "����� ���������� ������ ��������� �������� �� ������������ ����� ��������."
                : "������� �������� ��������. ��� ����� �������, ���� ������ ����� ������: �������, ���������� ������� ��� ������� ��� ���������� �����."}
            </p>
          </div>

          {!draft ? null : draft.scenario === "CASE" ? (
            <>
              <label className="field-stack">
                <span className="field-label">�������� ����� ��� ��������</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      details: {
                        ...draft.details,
                        eventName: event.target.value
                      }
                    })
                  }
                  placeholder="��������, ����-��������� ����� 2026"
                  required
                  value={draft.details.eventName}
                />
              </label>

              <div className="form-grid">
                <label className="field-stack">
                  <span className="field-label">�������, ���� ��������</span>
                  <input
                    className="field-input"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        details: {
                          ...draft.details,
                          deadline: event.target.value
                        }
                      })
                    }
                    type="date"
                    value={draft.details.deadline}
                  />
                </label>

                <label className="field-stack">
                  <span className="field-label">������� ������� �� �������</span>
                  <input
                    className="field-input"
                    max={8}
                    min={1}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        details: {
                          ...draft.details,
                          teamGapSize: event.target.value
                        }
                      })
                    }
                    type="number"
                    value={draft.details.teamGapSize}
                  />
                </label>
              </div>

              <div className="field-stack">
                <span className="field-label">������ ����</span>
                <div className="toggle-grid">
                  {collaborationRoleOptions.map((role) => (
                    <button
                      key={role.value}
                      className="toggle-chip"
                      data-selected={draft.details.neededRoles.includes(role.value)}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          details: {
                            ...draft.details,
                            neededRoles: toggleValue(draft.details.neededRoles, role.value)
                          }
                        })
                      }
                      type="button"
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-stack">
                <span className="field-label">���������������� ������</span>
                <div className="toggle-grid toggle-grid-compact">
                  {requestFormatOptions.map((format) => (
                    <button
                      key={format.value}
                      className="toggle-chip"
                      data-selected={draft.details.preferredFormat === format.value}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          details: {
                            ...draft.details,
                            preferredFormat: format.value
                          }
                        })
                      }
                      type="button"
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-stack">
                <span className="field-label">����� ������ ����������</span>
                <p className="helper-text">
                  ���� ���� � ��� ���� ���� ������ � ���������� �������. ���
                  ����� ����� ����� � ������� �������� ����������.
                </p>
                <div className="availability-stack">
                  {draft.availabilitySlots.map((slot) => (
                    <div key={slot.id} className="availability-row availability-slot-card">
                      <div className="avail-day-row">
                        <label className="field-stack availability-field">
                          <span className="field-caption">����</span>
                          <select
                            className="field-input field-select"
                            onChange={(event) =>
                              updateCaseAvailabilitySlot(
                                slot.id,
                                "dayOfWeek",
                                event.target.value
                              )
                            }
                            value={slot.dayOfWeek}
                          >
                            {requestDayOfWeekOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          onClick={() => removeCaseAvailabilitySlot(slot.id)}
                          type="button"
                          variant="ghost"
                        >
                          ������
                        </Button>
                      </div>

                      <div className="avail-time-row">
                        <label className="field-stack availability-field">
                          <span className="field-caption">�</span>
                          <input
                            aria-label="����� ������ ����������"
                            className="field-input field-time-input"
                            onChange={(event) =>
                              updateCaseAvailabilitySlot(
                                slot.id,
                                "startTime",
                                event.target.value
                              )
                            }
                            step={300}
                            type="time"
                            value={slot.startTime}
                          />
                        </label>
                        <label className="field-stack availability-field">
                          <span className="field-caption">��</span>
                          <input
                            aria-label="����� ��������� ����������"
                            className="field-input field-time-input"
                            onChange={(event) =>
                              updateCaseAvailabilitySlot(
                                slot.id,
                                "endTime",
                                event.target.value
                              )
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
                  <Button onClick={addCaseAvailabilitySlot} type="button" variant="secondary">
                    �������� ����
                  </Button>
                  <p className="helper-text">
                    ������ ������� 1�3 ������. ����� ���������� � ������� ����:������.
                  </p>
                </div>
              </div>
            </>
          ) : draft.scenario === "PROJECT" ? (
            <>
              <label className="field-stack">
                <span className="field-label">�������� �������</span>
                <input
                  className="field-input"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      details: {
                        ...draft.details,
                        projectTitle: event.target.value
                      }
                    })
                  }
                  placeholder="��������, ������ ��� ������ ���� ��� �����"
                  required
                  value={draft.details.projectTitle}
                />
              </label>

              <label className="field-stack">
                <span className="field-label">������� � �������</span>
                <textarea
                  className="field-textarea"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      details: {
                        ...draft.details,
                        shortDescription: event.target.value
                      }
                    })
                  }
                  placeholder="��� �� ������� � ��� ������ ����� �������"
                  required
                  rows={4}
                  value={draft.details.shortDescription}
                />
              </label>

              <div className="form-grid">
                <label className="field-stack">
                  <span className="field-label">������</span>
                  <select
                    className="field-input field-select"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        details: {
                          ...draft.details,
                          stage: event.target.value as ProjectDraft["details"]["stage"]
                        }
                      })
                    }
                    value={draft.details.stage}
                  >
                    {projectStageOptions.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-stack">
                  <span className="field-label">��������� �������������</span>
                  <select
                    className="field-input field-select"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        details: {
                          ...draft.details,
                          expectedCommitment:
                            event.target.value as ProjectDraft["details"]["expectedCommitment"]
                        }
                      })
                    }
                    value={draft.details.expectedCommitment}
                  >
                    {commitmentOptions.map((commitment) => (
                      <option key={commitment.value} value={commitment.value}>
                        {commitment.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field-stack">
                <span className="field-label">������ ����</span>
                <div className="toggle-grid">
                  {collaborationRoleOptions.map((role) => (
                    <button
                      key={role.value}
                      className="toggle-chip"
                      data-selected={draft.details.neededRoles.includes(role.value)}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          details: {
                            ...draft.details,
                            neededRoles: toggleValue(draft.details.neededRoles, role.value)
                          }
                        })
                      }
                      type="button"
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-stack">
                <span className="field-label">���������������� ������</span>
                <div className="toggle-grid toggle-grid-compact">
                  {requestFormatOptions.map((format) => (
                    <button
                      key={format.value}
                      className="toggle-chip"
                      data-selected={draft.details.preferredFormat === format.value}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          details: {
                            ...draft.details,
                            preferredFormat: format.value
                          }
                        })
                      }
                      type="button"
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <StudySubjectPicker
                courseYear={studyCourseYear}
                maxSelection={1}
                mode="single"
                onCourseYearChange={setStudyCourseYear}
                onProgramIdChange={setStudyProgramId}
                onSelectedCustomSubjectsChange={(values) =>
                  setDraft({
                    ...draft,
                    details: {
                      ...draft.details,
                      customSubjectName: values[0] ?? "",
                      subjectId: values.length > 0 ? "" : draft.details.subjectId
                    }
                  })
                }
                onSelectedSubjectIdsChange={(values) =>
                  setDraft({
                    ...draft,
                    details: {
                      ...draft.details,
                      subjectId: values[0] ?? "",
                      customSubjectName: values.length > 0 ? "" : draft.details.customSubjectName
                    }
                  })
                }
                onStudyLevelChange={setStudyLevel}
                programId={studyProgramId}
                selectedCustomSubjects={
                  draft.details.customSubjectName ? [draft.details.customSubjectName] : []
                }
                selectedSubjectIds={draft.details.subjectId ? [draft.details.subjectId] : []}
                studyLevel={studyLevel}
                subjects={subjects}
              />

              <label className="field-stack">
                <span className="field-label">������� ��������</span>
                <textarea
                  className="field-textarea"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      details: {
                        ...draft.details,
                        currentContext: event.target.value
                      }
                    })
                  }
                  placeholder="� ���� �� ���������� ��� ��� ������ ��������"
                  required
                  rows={4}
                  value={draft.details.currentContext}
                />
              </label>

              <label className="field-stack">
                <span className="field-label">����</span>
                <textarea
                  className="field-textarea"
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      details: {
                        ...draft.details,
                        goal: event.target.value
                      }
                    })
                  }
                  placeholder="����� ��������� ������ �������� �� ���������� �����"
                  required
                  rows={4}
                  value={draft.details.goal}
                />
              </label>

              <div className="form-grid">
                <label className="field-stack">
                  <span className="field-label">�������� �������</span>
                  <select
                    className="field-input field-select"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        details: {
                          ...draft.details,
                          desiredFrequency:
                            event.target.value as StudyDraft["details"]["desiredFrequency"]
                        }
                      })
                    }
                    value={draft.details.desiredFrequency}
                  >
                    {studyFrequencyOptions.map((frequency) => (
                      <option key={frequency.value} value={frequency.value}>
                        {frequency.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-stack">
                  <span className="field-label">���������������� �����</span>
                  <select
                    className="field-input field-select"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        details: {
                          ...draft.details,
                          preferredTime:
                            event.target.value as StudyDraft["details"]["preferredTime"]
                        }
                      })
                    }
                    value={draft.details.preferredTime}
                  >
                    {preferredTimeOptions.map((preferredTime) => (
                      <option key={preferredTime.value} value={preferredTime.value}>
                        {preferredTime.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field-stack">
                <span className="field-label">������</span>
                <div className="toggle-grid toggle-grid-compact">
                  {requestFormatOptions.map((format) => (
                    <button
                      key={format.value}
                      className="toggle-chip"
                      data-selected={draft.details.preferredFormat === format.value}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          details: {
                            ...draft.details,
                            preferredFormat: format.value
                          }
                        })
                      }
                      type="button"
                    >
                      {format.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <label className="field-stack">
            <span className="field-label">�������, ���� �����</span>
            <textarea
              className="field-textarea"
              onChange={(event) =>
                draft
                  ? setDraft({
                      ...draft,
                      notes: event.target.value
                    })
                  : null
              }
              placeholder="����� �������������� �������� ��� �������� ���������"
              rows={3}
              value={draft?.notes ?? ""}
            />
          </label>

          <Button disabled={isPending || !draft} fullWidth type="submit">
            {isPending
              ? "���������..."
              : editingRequestId
                ? "��������� ���������"
                : "������� ������"}
          </Button>
        </form>
      </Card>

      <Card eyebrow="�������" title="���� �������">
        {requests.length === 0 ? (
          <p className="card-body-copy">
            �������� ���� ���. �������� ������, ����� �������� ������� �� ������
            ����������.
          </p>
        ) : (
          <div className="request-history-list">
            {requests.map((request) => (
              <div key={request.id} className="request-history-row">
                <div className="request-history-copy">
                  <div className="request-history-head">
                    <strong>{summarizeRequest(request)}</strong>
                    <span
                      className="tone-pill"
                      data-tone={requestStatusTone[request.status]}
                    >
                      {requestStatusLabels[request.status]}
                    </span>
                  </div>
                  <p className="helper-text">
                    {requestScenarioOptions.find(
                      (scenario) => scenario.value === request.scenario
                    )?.label ?? request.scenario}
                    {". "}
                    {describeRequest(request)}
                  </p>
                  <p className="helper-text">
                    {request.availabilitySlots.length > 0
                      ? request.availabilitySlots
                          .map((slot) =>
                            `${requestDayOfWeekOptions.find(
                              (day) => day.value === slot.dayOfWeek
                            )?.label ?? slot.dayOfWeek} ${minuteRangeToLabel(
                              slot.startMinute,
                              slot.endMinute
                            )}`
                          )
                          .join(", ")
                      : `���� �� ${formatRequestDate(request.expiresAt)}`}
                  </p>
                </div>

                <div className="request-card-actions">
                  {request.status === "ACTIVE" ? (
                    <>
                      <Button onClick={() => startEditingRequest(request)} variant="secondary">
                        �������������
                      </Button>
                      <Button onClick={() => handleArchive(request.id)} variant="ghost">
                        ������������
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => handleRenew(request.id)} variant="secondary">
                      ��������
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
