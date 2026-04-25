# AGENTS.md

## Project Purpose

Aperly is a Telegram Mini App MVP for HSE Perm students who need to quickly find suitable people for a concrete collaborative goal:

- team search for a case championship or hackathon
- people search for a pet project or startup
- StudyBuddy for collaborative study

The product promise is structured matching by goal, role, skills, subject, availability, and format, with safe in-app chat before contact exchange.

## Scope Boundaries

This repository is for the MVP only. The implementation must include:

- Telegram Mini App auth integration
- onboarding
- profile creation and editing
- request creation for case, project, and StudyBuddy
- hybrid rule-based matching
- match cards
- in-app chat
- mutual contact sharing
- StudyBuddy session scheduling and follow-up actions
- moderation and admin basics
- analytics instrumentation
- PostgreSQL persistence
- migrations and seed data
- required documentation

This repository must not grow into:

- a Telegram bot product
- a feed or timeline
- a social network
- a gamified app
- a paid or premium product
- an AI recommendation experiment
- a microservice system

## Product and Domain Guardrails

- StudyBuddy is mandatory and first-class. Do not downgrade it to a stub.
- The product is one matching system with three scenario variants, not three separate apps.
- Primary matching mode is request-to-request.
- Fallback matching mode is request-to-profile only when the request candidate pool is too small.
- Fallback matching must only use discoverable profiles.
- Matching must be recomputed when:
  - a new request is created
  - a request is updated
  - profile data affecting matching changes
  - a request is renewed
  - a user manually refreshes matches
- Contact details must never be exposed before mutual consent.
- Chat for MVP is polling-based, but domain logic must stay transport-agnostic so realtime can be added later.
- Stale chats are part of the product contract and must be surfaced as `ожидает ответа`.
- Cold-start and no-match behavior are part of MVP, not an edge note.

## Stack

- Frontend: Next.js, React, TypeScript
- Backend: Next.js route handlers and server modules on Node.js, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Styling: pragmatic mobile-first CSS approach suitable for Telegram Mini Apps
- Testing: basic unit and integration tests
- Tooling: ESLint, Prettier
- Package manager: npm

## Coding Conventions

- Prefer a modular monolith over service sprawl.
- Keep server domain logic in feature-oriented modules, not page components.
- Validate all external input with Zod.
- Keep UI Russian-first and mobile-first.
- Build deterministic rule-based matching only.
- Keep business rules explicit in code and docs; do not hide them in UI code.
- Use clear enums and state transitions for request, match, chat, moderation, and session status.
- Avoid speculative abstraction, but isolate future-sensitive seams:
  - chat transport
  - analytics provider
  - verification provider
  - reminder delivery

## Data and Domain Rules

- Requests are the primary matching object.
- Profiles remain reusable identity and capability records.
- Discoverability is opt-in and used only for fallback matching.
- Blocked, deleted, expired, or inactive entities must be filtered out of matching and chat actions.
- Duplicate active requests for the same user and scenario are not allowed when materially equivalent.
- Maximum active requests per user per scenario: `1`.
- Maximum active chats per user: soft limit `12`.
- Maximum returned matches per request: top `10`.
- StudyBuddy session state transitions must be persisted.
- Admin actions must be logged.

## How To Run

The repository will standardize on these commands once the scaffold is in place:

```bash
npm install
npm run dev
npm run lint
npm run test
npm run db:migrate
npm run db:seed
```

Required environment variables will be documented in `.env.example` and `README.md`.

## What Must Not Change Without Explicit Approval

- the three mandatory scenarios
- Telegram Mini App architecture
- PostgreSQL plus Prisma as the persistence layer
- hybrid matching strategy and discoverability rule
- trust-before-contact behavior
- polling-based MVP chat with future realtime seam
- StudyBuddy follow-up actions:
  - schedule next session
  - find new partner
  - stop searching
- required repository artifacts and local setup support
- the phase order defined in the product spec

## Delivery Discipline

- Complete work phase by phase.
- After each phase, report:
  - what was implemented
  - files added or changed
  - any deviations with justification
  - what remains
- Do not silently reduce scope to make implementation easier.
