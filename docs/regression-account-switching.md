# Account Switching Regression Checklist

Purpose: verify that Aperly never shows user-specific state from a previous Telegram/app session after switching accounts.

1. Open the app as user A through Telegram test flow or local dev auth.
2. Confirm home, profile, active requests, matches, chats, and onboarding state belong to user A.
3. Switch to user B through dev auth or Telegram test flow.
4. Confirm no profile fields, requests, matches, chats, contact state, StudyBuddy sessions, or onboarding state from user A are visible.
5. Create a new request as user B.
6. Switch back to user A.
7. Confirm user B's new request and chat/match state are not visible to user A.
8. Re-check `/home`, `/profile`, `/matches`, `/chats`, `/requests/new`, and onboarding redirects after every switch.
9. In Telegram, repeat the switch after backgrounding and reopening the Mini App; the app should clear the stale app session if Telegram user id and app session user id differ.
10. In browser devtools, verify user-specific API responses include `Cache-Control: no-store, no-cache, max-age=0, must-revalidate`.
