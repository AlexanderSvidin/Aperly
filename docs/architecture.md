# Aperly Architecture

## Logical Architecture

Aperly is a modular monolith built as a single Next.js application with server-side domain modules and PostgreSQL persistence.

Top-level architecture layers:

- presentation layer:
  - App Router pages and layouts
  - mobile-first Telegram Mini App UI
- application layer:
  - route handlers
  - auth/session handling
  - input validation
  - home aggregation
- domain layer:
  - profile service
  - request service
  - matching service
  - chat service
  - contact exchange service
  - study session service
  - moderation service
  - analytics service
- infrastructure layer:
  - Prisma repositories
  - Telegram auth verification helpers
  - analytics sink
  - chat transport adapter

The system remains one product with one matching model. The three scenarios share core entities and infrastructure while keeping scenario-specific detail tables.

## Module Responsibilities

### Auth

- validate Telegram Mini App `initData`
- create or hydrate app session
- support local dev auth fallback behind environment flags
- enforce blocked and deleted user restrictions

### Onboarding and Profile

- capture first-use profile data
- store skills, subjects, role preferences, availability, and format preferences
- manage discoverability settings
- compute profile completeness inputs for matching

### Requests

- create and edit scenario-specific requests
- manage duplicate detection
- manage expiry and renewal
- expose active requests to home and matching flows
- enforce a maximum of `1` active request per user per scenario

### Matching

- compute ranked candidates
- store match records and reason summaries
- support hybrid request-to-request and request-to-profile behavior
- exclude blocked, inactive, expired, and incompatible candidates
- recompute affected matches on source data changes
- keep cached match lists consistent with current request and profile state

### Chat

- manage chat creation and message persistence
- keep domain logic separate from delivery transport
- support polling-based MVP reads and writes

### Contact Exchange

- manage mutual consent state
- reveal contact information only after both sides agree
- emit scenario outcome analytics when mutual exchange completes

### Study Sessions

- schedule first StudyBuddy session
- track session lifecycle
- support repeat session scheduling
- support finding a new partner
- support stop-searching flow
- keep reminder integration as a future seam

### Moderation

- create reports
- allow admin review of users, requests, reports, and logs
- support blocking and disabling users
- preserve audit history

### Analytics

- expose a single `track(event, payload)` interface
- record required product and outcome events
- allow provider replacement later without domain rewrites

### Home Aggregation

The home screen is a composed view generated from several modules. It must show:

- active requests
- latest matches
- active chats
- upcoming StudyBuddy session
- primary CTA to create a request

The home service is a read-model aggregator, not a separate domain.

## Data Model Responsibilities

Core required entities:

- `User`
- `Profile`
- `Verification`
- `Skill`
- `Subject`
- `UserSkill`
- `UserSubject`
- `Request`
- `CaseRequestDetails`
- `ProjectRequestDetails`
- `StudyRequestDetails`
- `AvailabilitySlot`
- `Match`
- `Chat`
- `Message`
- `Session`
- `Report`
- `AdminAction`

Important additions inside those entities for MVP behavior:

- `Profile.isDiscoverable`
- `Profile.discoverableScenarios` or equivalent scenario-specific discoverability scope
- `Request.status`, `Request.expiresAt`
- `Match.mode`:
  - `REQUEST_TO_REQUEST`
  - `REQUEST_TO_PROFILE`
- `Match.status`:
  - `READY`
  - `PENDING_RECIPIENT_ACCEPTANCE`
  - `DECLINED`
  - `EXPIRED`
- `Chat.contactExchangeStatus`
- `Chat.lastMessageAt`
- `Chat.staleAfterAt`
- `Chat.staleStatus`
- `Session.sequenceNumber`
- `Session.status`
- `Session.nextAction`

## Matching Design

### Matching Pipeline

1. Load the source request and requester profile.
2. Build eligible request-to-request candidates in the same scenario.
3. Apply hard filters:
   - active request
   - non-expired request
   - other user only
   - target user active and not blocked
   - not already connected through a terminal match state
4. Score each request candidate using scenario weights.
5. Persist ranked request matches above minimum score threshold.
6. If the request candidate pool is too small, run fallback request-to-profile matching.
7. Persist fallback matches in a pending acceptance mode.

### Matching Recompute Triggers

The matching service must recompute relevant results when any of the following happens:

- a new request is created
- a request is updated
- profile data affecting matching changes
- a request is renewed
- the user triggers a manual refresh

Consistency behavior for MVP:

- request creation, request update, and request renewal trigger immediate recomputation for the source request
- profile updates that affect skills, subjects, availability, preferred format, discoverability, or role preferences trigger recomputation for that user’s active requests
- a new request also triggers recomputation for impacted active requests in the same scenario because the new request may become a viable candidate for others
- manual refresh bypasses stale cached results and forces recomputation for the selected request

### Match Caching Strategy

Match records may be stored and reused for read efficiency, but the cache is a derived view, not the source of truth.

MVP cache rules:

- persist ranked matches as cached snapshots tied to the current request state
- invalidate or refresh snapshots whenever a recompute trigger fires
- never return cached match data known to be older than the latest relevant request or profile change
- cap returned match lists to the top `10` ranked results per request

### Fallback Threshold Logic

The MVP uses explicit threshold logic:

- minimum acceptable score for a ranked match: `45 / 100`
- request-only mode is sufficient when:
  - there are at least `3` request-based matches above threshold
- fallback mode is activated when both are true:
  - fewer than `3` request-based matches are above threshold
  - the eligible request candidate pool size is below `5`

This keeps request-to-request as the main product behavior while still helping users in cold-start conditions.

### Fallback Request-to-Profile Rules

Fallback candidates must satisfy all of the following:

- `isDiscoverable = true`
- active user
- not blocked
- not the requesting user
- scenario-compatible discoverability

Fallback scoring uses profile-level structured data:

- role fit
- skills
- subjects
- availability overlap
- format compatibility
- profile completeness

Fallback results are not fully open chats. They produce a potential-fit match card that requires recipient acceptance before chat activation.

### Scenario Weights

Case / hackathon priority:

- role fit
- event relevance
- availability overlap
- complementary skill fit
- profile completeness

Project / startup priority:

- role fit
- stage fit
- commitment compatibility
- format compatibility
- complementary skill fit
- profile completeness

StudyBuddy priority:

- same subject
- similar goal
- availability overlap
- format compatibility
- rhythm compatibility
- profile completeness

## Chat Architecture

### Transport Boundary

Chat must be implemented for MVP with polling, but future realtime upgrade must not require domain rewrites.

The architecture therefore separates:

- `ChatService`:
  - domain rules
  - permissions
  - message creation
  - contact exchange logic hooks
  - stale chat handling
- `ChatTransport`:
  - message delivery/read synchronization strategy

MVP implementation:

- `PollingChatTransport`
- client polls for new messages and chat status updates
- server persists messages and returns deltas

Future upgrade path:

- add `RealtimeChatTransport` using WebSocket or managed realtime
- keep `ChatService`, repositories, and message models unchanged
- switch transport wiring without rewriting domain logic

### Chat State Rules

- request-to-request matches can open chats immediately
- request-to-profile fallback matches require recipient acceptance before chat activation
- contact details remain hidden until mutual consent
- stale chats remain visible but marked as inactive or awaiting response
- a chat is stale after `72 hours` without message exchange
- stale chats are labeled `ожидает ответа`
- stale chats support a reminder action and a return-to-matching action
- active chat creation is subject to a soft per-user limit of `12`

## StudyBuddy Retention Design

StudyBuddy is not complete at first scheduling. It must support an explicit continuation loop.

### Session Lifecycle

Suggested MVP session statuses:

- `PROPOSED`
- `CONFIRMED`
- `COMPLETED`
- `CANCELLED`
- `MISSED`

### Follow-Up Actions After First Session Scheduling

- `schedule next session`
- `find new partner`
- `stop searching`

### State Implications

- `schedule next session`:
  - creates a new `Session`
  - increments `sequenceNumber`
  - preserves the existing StudyBuddy relationship
- `find new partner`:
  - closes the current StudyBuddy pairing for active matching
  - reopens or creates a searchable StudyBuddy request
  - keeps history intact
- `stop searching`:
  - closes the active StudyBuddy request from future matching
  - leaves chat and session history readable

Reminder readiness is provided through session metadata and service boundaries, not through actual reminder dispatch in MVP.

## Data Flow

### First Entry

1. Telegram opens Mini App.
2. Client loads app shell.
3. Auth handler validates Telegram payload.
4. User record is created or loaded.
5. Onboarding and profile completion status determine next screen.
6. Home aggregation returns active requests, latest matches, chats, and session summary.

### Request Creation to Match

1. User creates request.
2. Request service validates and persists it.
3. Matching service computes request-to-request candidates.
4. If thresholds fail, matching service computes fallback discoverable profiles.
5. Match records are stored.
6. Home and match screens surface results and empty states.

### Match Refresh

1. User opens an active request or match list.
2. User triggers manual refresh.
3. Matching service bypasses stale cached snapshots.
4. The latest ranked top `10` results are recomputed and persisted.
5. The UI refreshes the list and no-match state if applicable.

### Match to Chat

1. User opens a match card.
2. If the match is request-to-request, chat opens immediately.
3. If the match is request-to-profile, the initiator sends an invite.
4. Recipient accepts or declines.
5. Accepted invite creates or activates chat.
6. Contact exchange remains separate and mutual.

### Stale Chat Handling

1. Chat inactivity reaches `72 hours` without exchanged messages.
2. Chat state is marked stale.
3. UI shows `ожидает ответа`.
4. The user may send a reminder message.
5. The user may also return to matching from the same context.

### StudyBuddy Continuation

1. Users schedule first session.
2. Session record is persisted.
3. After or around completion, users can:
   - schedule next session
   - find new partner
   - stop searching
4. Session and request states are updated accordingly.
5. Analytics records outcome events at the state transition points.

## Trust and Privacy Assumptions

- Telegram auth is the identity baseline.
- Contact data is stored minimally and revealed only after mutual consent.
- Moderation must be available from MVP launch.
- Blocking a user removes them from matching and active interaction flows.
- Deleted accounts are soft-deleted or anonymized for audit consistency.

## Extension Points

- HSE email verification provider
- reminder job runner
- realtime chat transport
- external analytics sink
- improved availability-slot UX
- ratings or common-connections placeholders

These are extension points only. They must not distort the MVP into a broader platform.
