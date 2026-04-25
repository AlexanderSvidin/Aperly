# Aperly Product Spec

## Product Overview

Aperly is a Telegram Mini App for HSE Perm students who need to find the right person or team for a concrete collaborative goal without relying on noisy chats or narrow friend circles.

The MVP covers three scenarios:

- `Команда на кейс / хакатон`
- `Люди для проекта / стартапа`
- `StudyBuddy`

The product is a structured matching system, not a social platform. Users create a profile, create a scenario-specific request, receive relevant matches, chat safely inside the app, and take the next real step:

- case or hackathon: form a team
- project or startup: confirm a working connection
- StudyBuddy: schedule and continue study sessions

## Target Users

Primary audience:

- HSE Perm students
- especially first-year students with narrow and homogeneous social circles

Secondary audience within MVP:

- students participating in case championships or hackathons
- students looking for project or startup collaborators
- students seeking a regular or short-term StudyBuddy

## Use Cases

### 1. Case / Hackathon Team Search

The user needs teammates for a named event and wants structured matching by role, availability, and format.

### 2. Project / Startup People Search

The user needs collaborators for an idea, MVP, or ongoing project and wants structured matching by role, stage, commitment, and work format.

### 3. StudyBuddy

The user needs a partner for a specific subject and study goal and wants structured matching by subject, time, rhythm, and preferred format.

## Functional Requirements

### Core MVP Requirements

- Telegram Mini App authentication baseline
- onboarding flow
- user profile create and edit
- home screen with:
  - active user requests
  - latest matches
  - active chats
  - upcoming StudyBuddy session if one exists
  - clear primary CTA to create a request
- scenario selection for case, project, and StudyBuddy
- structured request creation for all three scenarios
- hybrid rule-based matching
- match list and match detail card UI
- in-app chat before contact sharing
- mutual contact exchange
- StudyBuddy session scheduling
- StudyBuddy follow-up actions:
  - schedule next session
  - find new partner
  - stop searching
- moderation and admin basics
- analytics event instrumentation
- PostgreSQL persistence
- seed and demo data

### Hybrid Matching Requirements

Primary matching mode:

- request-to-request within the same scenario

Fallback matching mode:

- request-to-profile when the request candidate pool is too small
- fallback may only include profiles with `isDiscoverable = true`

Fallback threshold logic for MVP:

1. Build an eligible request candidate pool for the source request.
2. Apply hard filters:
   - same scenario
   - active and non-expired request
   - other user only
   - target user not blocked, deleted, or inactive
3. Score request candidates.
4. Keep request-based candidates with score greater than or equal to the minimum ranking threshold.
5. If there are at least `3` request-based matches above threshold, do not use fallback.
6. If there are fewer than `3` ranked request matches and the eligible request candidate pool size is below `5`, run request-to-profile fallback.
7. Fallback only considers discoverable profiles that:
   - are active
   - are not blocked
   - are not owned by the requesting user
   - are opted into discoverability

Fallback output behavior:

- fallback cards are shown as potential fits
- opening communication with a fallback profile uses an invite step before chat becomes active
- this preserves trust and prevents unsolicited direct contact exposure

Matching recomputation requirements:

- matching must be recomputed when:
  - a new request is created
  - a request is updated
  - profile data affecting matching changes
  - a request is renewed
  - the user manually refreshes matches
- matching results may be cached for read efficiency, but cached results must be invalidated or refreshed so they remain consistent with current request and profile data
- the UI must expose a manual refresh action for match retrieval on active requests

### Scenario-Specific Request Requirements

#### Case / Hackathon

Required fields:

- event name
- deadline if known
- needed roles
- team gap size
- prep availability
- preferred format
- optional notes

#### Project / Startup

Required fields:

- project title
- short description
- stage
- needed roles
- expected commitment
- format

#### StudyBuddy

Required fields:

- subject
- current context
- goal
- desired frequency
- preferred time
- format

### Matching Output Requirements

Each match must include:

- score
- human-readable reason summary
- scenario context
- candidate profile snapshot
- status that reflects whether chat is ready immediately or requires acceptance

Matching list limits:

- return only the top `10` matches per request in MVP
- prefer stronger, current matches over exhaustive lists

Examples of reason summaries:

- `Совпадает предмет и время`
- `Подходит по роли аналитика и формату`
- `Совпадают навыки и доступность`

### Chat and Contact Requirements

- chat must exist inside the app
- chat for MVP is polling-based
- contact details remain hidden until both users consent
- contact exchange is explicit and mutual
- stale chats and no-reply situations must be handled visibly
- a chat becomes stale after `72 hours` with no messages exchanged
- stale chats must be marked in the UI as `ожидает ответа`
- from a stale chat, the user may:
  - send a reminder message
  - return to matching

Chat capacity limit:

- maximum total active chats per user is a soft limit of `12`
- the limit is enforced when opening or accepting a new chat, while existing chats remain accessible

### StudyBuddy Retention Requirements

After the first session is scheduled, the product must support:

- scheduling the next session
- finding a new partner
- stopping search

The system must persist StudyBuddy session state transitions and keep reminder architecture ready for later integration.

### Moderation Requirements

- users can report another user
- admin can view users, requests, and reports
- admin can block or disable users
- admin actions are logged

### Cold-Start and No-Match Requirements

When no strong matches are found, the UI must:

- clearly state that no matches are available yet
- explain that the request remains open
- offer actions to improve matchability:
  - adjust request details
  - edit availability or format preferences
  - enable discoverability for fallback matching
- show when the system is still searching
- avoid dead-end empty screens

Request limits:

- maximum active requests per user per scenario: `1`
- users should be guided to edit, renew, or reopen the existing request instead of creating duplicates

## Non-Functional Requirements

- mobile-first
- Russian-first UI
- minimal and touch-friendly
- coherent, not decorative
- production-sane architecture
- clear module boundaries
- deterministic matching
- local development support
- future-ready seams for:
  - realtime chat
  - HSE email verification
  - reminders
  - analytics provider replacement

## Analytics Requirements

The MVP must instrument at least these events:

- `open_app`
- `start_onboarding`
- `complete_onboarding`
- `create_profile`
- `update_profile`
- `choose_scenario_case`
- `choose_scenario_project`
- `choose_scenario_study`
- `create_request`
- `receive_matches`
- `open_match_card`
- `open_chat`
- `send_first_message`
- `exchange_contacts`
- `schedule_study_session`
- `report_user`
- `admin_block_user`
- `case_team_formed`
- `project_connection_confirmed`
- `first_study_session_completed`
- `repeat_study_session_scheduled`

Outcome event trigger points:

- `case_team_formed`: when mutual contact exchange completes for a case or hackathon match
- `project_connection_confirmed`: when mutual contact exchange completes for a project or startup match
- `first_study_session_completed`: when the first persisted StudyBuddy session transitions to `COMPLETED`
- `repeat_study_session_scheduled`: when a subsequent StudyBuddy session is created after the first one

## Trust and Privacy Requirements

- Telegram authentication is the baseline identity layer
- HSE email verification is a future-ready extension point
- do not reveal contact info before mutual consent
- do not expose unnecessary personal data
- keep moderation viable from day one

## Success Criteria

The MVP is successful when a user can:

1. open the Mini App
2. onboard quickly
3. complete a usable profile
4. create a request in any of the three scenarios
5. receive relevant matches or clear cold-start guidance
6. open an in-app conversation
7. safely progress to the next meaningful outcome

Scenario success outcomes:

- case or hackathon: a team is formed
- project or startup: a collaboration connection is confirmed
- StudyBuddy: the first session is completed and the product supports continuation
