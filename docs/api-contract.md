# Aperly API Contract

## API Conventions

- Base path: `/api`
- Payload format: JSON
- Authenticated endpoints require a valid app session derived from Telegram auth or allowed local dev auth
- Admin endpoints require admin role
- Validation is enforced with Zod
- All write endpoints must reject blocked, deleted, or inactive users unless the action is an admin action on behalf of moderation
- Maximum active requests per user per scenario: `1`
- Maximum active chats per user: soft limit `12`
- Maximum returned matches per request: top `10`

## Authentication

### `POST /api/auth/telegram`

Purpose:

- validate Telegram Mini App auth payload and establish app session

Request:

```json
{
  "initData": "raw telegram init data string"
}
```

Response:

```json
{
  "user": {
    "id": "usr_123",
    "telegramId": "123456",
    "role": "USER",
    "onboardingCompleted": false
  }
}
```

### `POST /api/auth/dev`

Purpose:

- local-only dev auth fallback behind env flag

### `POST /api/auth/logout`

Purpose:

- clear the current session

### `GET /api/me`

Purpose:

- return the authenticated user and lightweight status flags

## Home

### `GET /api/home`

Purpose:

- return the composed Home screen payload

Response shape:

```json
{
  "activeRequests": [],
  "latestMatches": [],
  "activeChats": [],
  "upcomingStudySession": null,
  "primaryCta": {
    "label": "Создать запрос",
    "action": "create_request"
  }
}
```

Notes:

- `latestMatches` may include both ready matches and pending acceptance fallback matches
- `upcomingStudySession` is the nearest future confirmed session if it exists

## Lookups and Profile

### `GET /api/lookups`

Purpose:

- return skills, subjects, role options, scenario enums, and other static form options

### `GET /api/profile`

Purpose:

- return current profile and discoverability settings

### `PUT /api/profile`

Purpose:

- create or update profile

Request shape:

```json
{
  "fullName": "Иван Петров",
  "bio": "1 курс, люблю кейсы и продуктовые проекты",
  "program": "Economics",
  "courseYear": 1,
  "skills": ["analysis", "presentation"],
  "subjects": ["microeconomics"],
  "preferredFormats": ["ONLINE", "OFFLINE"],
  "availabilitySlots": [],
  "isDiscoverable": true,
  "discoverableScenarios": ["CASE", "PROJECT", "STUDY"]
}
```

Validation rules:

- profile may be saved partially during onboarding only if minimum fields are present
- `isDiscoverable = true` requires at least one discoverable scenario
- if skills, subjects, availability, preferred format, discoverability, or role preferences change, matching must be recomputed for the user’s active requests

## Requests

### `GET /api/requests`

Purpose:

- list the current user’s requests

### `POST /api/requests`

Purpose:

- create a new request in one of the three scenarios

Base request shape:

```json
{
  "scenario": "CASE",
  "notes": "optional",
  "details": {}
}
```

Case details:

```json
{
  "eventName": "Changellenge Cup",
  "deadline": "2026-05-15T18:00:00.000Z",
  "neededRoles": ["ANALYST", "DESIGNER"],
  "teamGapSize": 2,
  "prepAvailability": [],
  "preferredFormat": "HYBRID"
}
```

Project details:

```json
{
  "projectTitle": "Budget planner",
  "shortDescription": "MVP for students",
  "stage": "IDEA",
  "neededRoles": ["DEVELOPER"],
  "expectedCommitment": "PART_TIME",
  "preferredFormat": "ONLINE"
}
```

Study details:

```json
{
  "subjectId": "sub_123",
  "currentContext": "Готовлюсь к коллоквиуму",
  "goal": "Повторить 5 тем",
  "desiredFrequency": "WEEKLY",
  "preferredTime": "EVENING",
  "preferredFormat": "OFFLINE"
}
```

Validation rules:

- duplicate materially equivalent active request in the same scenario is rejected
- blocked or deleted users cannot create requests
- successful request creation triggers matching recomputation for the new request and impacted active requests in the same scenario

### `GET /api/requests/:id`

Purpose:

- return request detail and status

### `PATCH /api/requests/:id`

Purpose:

- update request fields while active

Behavior:

- successful update recomputes matching for that request

### `POST /api/requests/:id/renew`

Purpose:

- renew an expired request

Behavior:

- successful renewal recomputes matching for that request

### `POST /api/requests/:id/archive`

Purpose:

- close a request manually

### `POST /api/requests/:id/stop-searching`

Purpose:

- explicit stop-searching action for active requests, including StudyBuddy

## Matches

### `GET /api/requests/:id/matches`

Purpose:

- list ranked matches for a request

Notes:

- returns at most the top `10` ranked matches
- may return cached ranked results only if they are consistent with the latest relevant request and profile data

Response shape:

```json
{
  "requestId": "req_123",
  "matches": [
    {
      "id": "mat_123",
      "mode": "REQUEST_TO_REQUEST",
      "status": "READY",
      "score": 81,
      "reasonSummary": "Подходит по роли аналитика и формату",
      "candidateProfile": {},
      "candidateRequest": {}
    }
  ],
  "fallbackUsed": false
}
```

For fallback matches:

```json
{
  "id": "mat_456",
  "mode": "REQUEST_TO_PROFILE",
  "status": "PENDING_RECIPIENT_ACCEPTANCE",
  "score": 58,
  "reasonSummary": "Совпадают навыки и доступность",
  "candidateProfile": {},
  "candidateRequest": null
}
```

### `POST /api/requests/:id/matches/refresh`

Purpose:

- manually recompute matches for a request

Response shape:

```json
{
  "requestId": "req_123",
  "refreshed": true,
  "matchCount": 6
}
```

### `GET /api/matches/:id`

Purpose:

- return match detail for the match card

### `POST /api/matches/:id/open-chat`

Purpose:

- open a chat for a ready request-to-request match
- or send a chat invite for a fallback request-to-profile match

Response variants:

```json
{
  "status": "CHAT_READY",
  "chatId": "chat_123"
}
```

```json
{
  "status": "INVITE_SENT",
  "matchId": "mat_456"
}
```

### `POST /api/matches/:id/respond`

Purpose:

- accept or decline a pending fallback invite

Request:

```json
{
  "decision": "ACCEPT"
}
```

Response:

```json
{
  "status": "ACCEPTED",
  "chatId": "chat_123"
}
```

Validation rules:

- only the invite recipient may respond
- only pending fallback matches may use this endpoint
- opening or accepting a new chat must respect the per-user active chat soft limit

## Chats

### `GET /api/chats`

Purpose:

- list active chats for the current user

### `GET /api/chats/:id`

Purpose:

- return chat metadata, contact exchange state, stale status, and last message summary

Response additions:

- `staleStatus`:
  - `FRESH`
  - `AWAITING_REPLY`
- `staleAfterAt`
- `canSendReminder`

### `GET /api/chats/:id/messages?cursor=...`

Purpose:

- polling endpoint for message history and deltas

Response shape:

```json
{
  "messages": [],
  "nextCursor": "msg_999",
  "transport": "POLLING"
}
```

### `POST /api/chats/:id/messages`

Purpose:

- send a message

Request:

```json
{
  "text": "Привет! Давай обсудим детали."
}
```

Validation rules:

- user must belong to the chat
- blocked, deleted, or inactive users cannot send

### `POST /api/chats/:id/reminder`

Purpose:

- send a lightweight reminder message in a stale chat

Validation rules:

- user must belong to the chat
- chat must be stale
- reminder action does not bypass contact or moderation rules

## Contact Exchange

### `POST /api/chats/:id/contact-exchange/request`

Purpose:

- initiate contact sharing

### `POST /api/chats/:id/contact-exchange/respond`

Purpose:

- accept or decline contact sharing

Request:

```json
{
  "decision": "ACCEPT"
}
```

Response:

```json
{
  "status": "MUTUAL_CONSENT_REACHED",
  "revealedContacts": {
    "telegramUsername": "@example",
    "phone": null
  }
}
```

Backend event rules:

- on mutual contact exchange for `CASE`, record `case_team_formed`
- on mutual contact exchange for `PROJECT`, record `project_connection_confirmed`
- on mutual contact exchange for `STUDY`, record `exchange_contacts` only

## Study Sessions

### `POST /api/matches/:id/session`

Purpose:

- create the first StudyBuddy session proposal

Request:

```json
{
  "scheduledAt": "2026-04-28T16:00:00.000Z",
  "format": "OFFLINE",
  "notes": "Встретимся в библиотеке"
}
```

### `PATCH /api/sessions/:id`

Purpose:

- confirm, reschedule, cancel, or mark a session completed

Request:

```json
{
  "action": "CONFIRM"
}
```

Allowed actions:

- `CONFIRM`
- `RESCHEDULE`
- `CANCEL`
- `MARK_COMPLETED`
- `MARK_MISSED`

Backend event rules:

- when the first session transitions to `COMPLETED`, record `first_study_session_completed`

### `POST /api/sessions/:id/schedule-next`

Purpose:

- create a subsequent StudyBuddy session for the same pairing

Backend event rules:

- when a second or later session is created, record `repeat_study_session_scheduled`

### `POST /api/requests/:id/find-new-partner`

Purpose:

- end the active StudyBuddy pairing for matching purposes and reopen or renew search

Validation rules:

- only valid for StudyBuddy requests
- historical sessions and chat remain intact

## Reports

### `POST /api/reports`

Purpose:

- create a report against a user, chat, or match context

Request:

```json
{
  "targetUserId": "usr_234",
  "chatId": "chat_123",
  "reasonCode": "INAPPROPRIATE_BEHAVIOR",
  "details": "optional"
}
```

## Admin

### `GET /api/admin/users`

Purpose:

- list users for moderation

### `GET /api/admin/requests`

Purpose:

- list requests for moderation

### `GET /api/admin/reports`

Purpose:

- list reports and statuses

### `POST /api/admin/users/:id/block`

Purpose:

- block a user

Backend event rules:

- record `admin_block_user`
- write an `AdminAction` entry

### `POST /api/admin/reports/:id/resolve`

Purpose:

- resolve or close a report

### `GET /api/admin/actions`

Purpose:

- list admin action logs

## Analytics

### `POST /api/analytics/track`

Purpose:

- track client-originated UI events when needed

Request:

```json
{
  "event": "open_match_card",
  "payload": {
    "matchId": "mat_123"
  }
}
```

Notes:

- business-critical events should be emitted in backend domain logic, not only from the client
- required backend-triggered events include:
  - `create_request`
  - `receive_matches`
  - `send_first_message`
  - `exchange_contacts`
  - `schedule_study_session`
  - `case_team_formed`
  - `project_connection_confirmed`
  - `first_study_session_completed`
  - `repeat_study_session_scheduled`

## Key Validation Rules

- all matching excludes blocked, deleted, inactive, or expired candidates
- fallback matching requires discoverability
- matching must be recomputed on request create, request update, request renew, relevant profile change, and manual refresh
- contact reveal requires mutual consent
- StudyBuddy session endpoints apply only to StudyBuddy matches
- duplicate equivalent active requests are rejected
- only participants may read or write a chat
- only admins may access admin endpoints
