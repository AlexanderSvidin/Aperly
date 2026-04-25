# Aperly User Flows

## 1. Onboarding Flow

1. User opens the Telegram Mini App.
2. Welcome screen shows a short value proposition:
   - find people for a case or hackathon
   - find collaborators for a project or startup
   - find a StudyBuddy
3. App authenticates via Telegram Mini App auth.
4. If the user is new, onboarding starts.
5. User completes the minimum onboarding fields.
6. User creates or edits profile:
   - name and short bio
   - skills
   - subjects
   - preferred format
   - availability
   - discoverability preference
7. User lands on Home.

## 2. Home Flow

The Home screen is the main operational dashboard for the MVP.

It must show:

- active user requests
- latest matches
- active chats
- upcoming StudyBuddy session if present
- one clear primary CTA: `Создать запрос`

Home behavior:

1. User opens Home after onboarding or returning to the app.
2. User sees active requests first.
3. User can inspect latest matches for each scenario.
4. User can manually refresh matches for an active request when needed.
5. User can continue any active chat.
6. If a StudyBuddy session is scheduled, the next session card is shown prominently.
7. User can create a new request from the main CTA.
8. If there are no requests yet, Home becomes a guided empty state pointing to request creation.

## 3. Case / Hackathon Flow

1. User taps `Создать запрос`.
2. User chooses `Команда на кейс / хакатон`.
3. User fills:
   - event name
   - deadline if known
   - needed roles
   - team gap size
   - prep availability
   - preferred format
   - optional notes
4. Request is validated and saved.
5. Matching runs in primary request-to-request mode immediately after creation.
6. If request-based results are sufficient, ranked matches are shown.
7. If the request pool is too small, fallback potential-fit cards from discoverable profiles are added.
8. User opens a match card.
9. If the match is request-to-request, user opens chat immediately.
10. If the match is fallback request-to-profile, user sends a chat invite and waits for acceptance.
11. Users chat inside the app.
12. If both agree, they complete mutual contact exchange.
13. System records `case_team_formed` when contact exchange completes for this scenario.
14. The user may later refresh the request manually to recompute current matches.

## 4. Project / Startup Flow

1. User taps `Создать запрос`.
2. User chooses `Люди для проекта / стартапа`.
3. User fills:
   - project title
   - short description
   - stage
   - needed roles
   - expected commitment
   - format
4. Request is validated and saved.
5. Matching runs in primary request-to-request mode immediately after creation.
6. If request-based results are insufficient and pool thresholds trigger fallback, discoverable profile cards are shown as potential fits.
7. User opens a match card.
8. Request-to-request matches allow immediate chat.
9. Fallback profile matches require an invite before chat becomes active.
10. Users chat inside the app.
11. If both agree, they complete mutual contact exchange.
12. System records `project_connection_confirmed` when contact exchange completes for this scenario.
13. The user may later refresh the request manually to recompute current matches.

## 5. StudyBuddy Flow

1. User taps `Создать запрос`.
2. User chooses `StudyBuddy`.
3. User fills:
   - subject
   - current context
   - goal
   - desired frequency
   - preferred time
   - format
4. Request is validated and saved.
5. Matching runs in primary request-to-request mode immediately after creation.
6. If request-based supply is too small, discoverable profile fallback is used.
7. User opens a match card.
8. If chat is available or accepted, users talk inside the app.
9. One user proposes the first study session.
10. The session is confirmed and persisted.
11. The upcoming session appears on Home.
12. After the first session lifecycle progresses, the user gets three clear actions:
   - `Запланировать следующую встречу`
   - `Найти нового партнера`
   - `Остановить поиск`
13. The user may manually refresh the request later if they want new matching results.

### StudyBuddy Continuation Loop

#### A. Schedule Next Session

1. User chooses `Запланировать следующую встречу`.
2. A new session is created for the same StudyBuddy pairing.
3. Session history stays attached to the same chat and relationship.
4. System records `repeat_study_session_scheduled` for second and later sessions.

#### B. Find New Partner

1. User chooses `Найти нового партнера`.
2. Current StudyBuddy pairing is closed for active matching.
3. Existing chat and session history remain accessible.
4. The user is returned to an open or renewed StudyBuddy request.
5. Matching runs again for a new partner.

#### C. Stop Searching

1. User chooses `Остановить поиск`.
2. The active StudyBuddy request is closed from matching.
3. Existing chat and session history remain visible.
4. The user can later create a new request manually if needed.

### StudyBuddy Completion Signal

1. A persisted first session is marked completed.
2. System records `first_study_session_completed`.
3. The app then emphasizes continuation options instead of ending the flow abruptly.

## 6. Cold-Start / No-Match Flow

This flow must be explicit and visible.

1. User creates a request.
2. Matching returns no strong request-based matches.
3. If fallback criteria are met, the app shows discoverable-profile potential fits.
4. If no fallback fits are available either, the app shows a no-match state.
5. The no-match state explains:
   - the request stays open
   - new matches may appear later
   - the user can improve results by adjusting filters
6. The screen offers clear actions:
   - edit request
   - adjust availability or format
   - enable discoverability
   - keep request open
7. The screen also allows manual refresh later without recreating the request.
8. Home continues to show the active request so the user does not feel stuck.

## 7. Chat and Contact Exchange Flow

1. User opens a match card and enters or requests chat.
2. The chat screen shows conversation history and contact-sharing state.
3. User sends the first message.
4. If the other side does not reply, chat remains visible and can be marked as awaiting response.
5. After `72 hours` without exchanged messages, the chat is marked `ожидает ответа`.
6. The user may send a reminder message from the stale chat.
7. The user may also return to matching from the stale chat context.
8. Either user may initiate contact exchange.
9. The other user can accept or decline.
10. If declined, chat remains available and the system records the refusal state.
11. If both accept, contacts are revealed.

## 8. Admin and Moderation Flow

1. Admin opens admin section.
2. Admin views users.
3. Admin views requests.
4. Admin views reports.
5. Admin inspects report context.
6. Admin can block or disable a user.
7. Admin action is logged in `AdminAction`.
8. Blocked users are removed from matching and restricted from normal app actions.

## 9. Account and Edge Flows

### Duplicate Request

1. User tries to create a materially equivalent active request in the same scenario.
2. System blocks duplicate creation and suggests editing the existing request.

### Request Updated

1. User edits an active request.
2. The updated request is saved.
3. Matching is recomputed immediately for the updated request.

### Expired Request

1. Request reaches `expiresAt`.
2. Request leaves active matching.
3. User sees renewal or recreate options from Home or request detail.

### Request Renewed

1. User renews an expired request.
2. The request becomes active again.
3. Matching is recomputed immediately.

### Profile Updated After Requests Exist

1. User updates profile, skills, subjects, or availability.
2. Affected active requests trigger match recomputation.
3. Existing chat history remains unchanged.

### Active Chat Limit

1. User attempts to open or accept a new chat while already at the active chat soft limit.
2. System blocks creation of the new active chat.
3. The user is asked to continue an existing chat or reduce active chat load before opening another.

### User Reported

1. User submits a report from profile, match, or chat context.
2. Report is stored and visible to admin.

### Admin Blocks a User

1. Admin blocks the user.
2. User is excluded from matching and restricted from chat actions.
3. Open matches and chats are marked accordingly.

### Delete Account

1. User requests deletion.
2. Account is soft-deleted or anonymized.
3. Active requests are closed.
4. Audit and moderation history remain intact.
