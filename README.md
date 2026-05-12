# Muscle Exercise Manager

Offline-first application for managing muscle groups, exercises, and workout logs across mobile and web platforms.

This README focuses on long-term architectural stability rather than feature-specific implementation details.  
The goal is to keep this document useful even as the application grows.

---

# Table of Contents

- [1. Product Goals](#1-product-goals)
- [2. Core Architecture Principles](#2-core-architecture-principles)
- [3. Tech Stack](#3-tech-stack)
- [4. Project Structure](#4-project-structure)
- [5. Local Development](#5-local-development)
- [6. Build & Deployment](#6-build--deployment)
- [7. OAuth & Redirect Flow](#7-oauth--redirect-flow)
- [8. Offline-First Sync Model](#8-offline-first-sync-model)
- [9. Conflict Resolution Strategy](#9-conflict-resolution-strategy)
- [10. Common Issues](#10-common-issues)
- [11. Security Guidelines](#11-security-guidelines)
- [12. Long-Term Scalability Rules](#12-long-term-scalability-rules)

---

# 1. Product Goals

The application is built around the following priorities:

- Fast workout logging with minimal interaction cost
- Local-first read/write operations
- Background cloud synchronization
- Multi-device support
- Strict user data isolation between accounts

---

# 2. Core Architecture Principles

These principles should remain stable over time.

## UI Layer

- UI must never depend directly on cloud APIs for rendering
- Screens always read from local persistence

## Data Layer

- Provides a unified API for all read/write operations
- Acts as the boundary between UI and storage/sync systems

## Persistence Layer

Platform-specific local storage:

- Native: SQLite
- Web: localStorage

## Sync Layer

Responsible for:

- Uploading local pending changes
- Pulling remote updates
- Maintaining sync cursors
- Retry and idempotent synchronization

## Auth Layer

Responsible for:

- Session lifecycle management
- User identity
- Google OAuth via Supabase

---

# 3. Tech Stack

## Frontend

- Expo
- React Native
- Expo Router
- TypeScript

## Backend Services

- Supabase Auth
- Supabase Database

## Local Persistence

- SQLite (native)
- localStorage (web)

---

# 4. Project Structure

```txt
app/          -> Screens and routing
components/   -> Reusable UI components
context/      -> Auth and sync providers
lib/          -> Data layer, auth, sync, utilities
types/        -> Shared database and domain types
supabase/     -> SQL migrations and database setup
docs/         -> Architecture and technical documentation
```

As long as layer boundaries remain respected, the project can scale without major restructuring.

---

# 5. Local Development

## Requirements

- Node.js LTS
- npm
- Expo CLI (via `npx expo ...`)

---

## Environment Variables

Create `.env` from `.env.example`.

Required variables:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_WEB_URL=
```

Example:

```env
EXPO_PUBLIC_WEB_URL=https://your-domain.vercel.app
```

---

## Install Dependencies

```bash
npm install
```

---

## Start Development Server

```bash
npm run dev
```

---

## Code Quality Checks

```bash
npm run typecheck
npm run lint
```

---

# 6. Build & Deployment

## Web Build

```bash
npm run build:web
```

Deploy the generated output to a static hosting platform such as Vercel.

SPA route rewrites are configured in:

```txt
vercel.json
```

---

## Android Build (EAS)

Preview build:

```bash
eas build --platform android --profile preview
```

Production build:

```bash
eas build --platform android --profile production
```

Build profiles are configured in:

```txt
eas.json
```

---

# 7. OAuth & Redirect Flow

The authentication flow uses three different callback URLs.

---

## 1. Google → Supabase Callback

Internal OAuth callback:

```txt
https://<project-ref>.supabase.co/auth/v1/callback
```

---

## 2. Supabase → Web Application Callback

Used for web authentication sessions:

```txt
https://<your-domain>/auth-callback
```

---

## 3. Supabase → Native Application Callback

Used for mobile deep linking:

```txt
muscle-manager://auth-callback
```

---

## Important

All redirect URLs must be whitelisted in:

- Supabase Auth Settings
- Google OAuth Console

---

# 8. Offline-First Sync Model

## Local-First Behavior

- All writes happen locally first
- UI updates immediately from local state
- Cloud sync runs asynchronously in the background

---

## Push Flow

The sync layer uploads:

- Pending inserts
- Pending updates
- Pending deletes

Synchronization is processed per entity/table.

---

## Pull Flow

Remote changes are fetched using:

```txt
last_pull_at
```

The cursor is always based on server timestamps.

---

## Clock Skew Protection

The system accounts for:

- Incorrect local device clocks
- Timezone differences
- Delayed synchronization

This prevents missing updates during sync operations.

---

## User Isolation

When the authenticated user changes:

- Local state is reset
- Cached data is invalidated
- Cross-account data leakage is prevented

---

# 9. Conflict Resolution Strategy

## Pending Local Rows

If a row still contains unsynced local changes:

- Local state remains authoritative
- Remote updates do not overwrite it

---

## Synced Rows

If a row has already been synced:

- Remote updates may overwrite local state by ID

---

## Source of Truth

The backend controls:

```txt
updated_at
```

Server timestamps are always authoritative.

---

# 10. Common Issues

## Incorrect OAuth Redirect

Check:

- `EXPO_PUBLIC_WEB_URL`
- Supabase Redirect URLs
- Google OAuth Redirect URLs

---

## Slow Cross-Device Sync

Verify:

- Sync triggers (focus / interval / manual)
- Correct authenticated account
- Network availability

---

## Android Expo Go OAuth Failure

Check:

Development redirect URL:

```txt
exp://.../--/auth-callback
```

Production deep link:

```txt
muscle-manager://auth-callback
```

---

# 11. Security Guidelines

## Secrets Management

- Never commit secrets into the repository
- Always use environment variables

---

## Database Security

- Enable RLS (Row Level Security)
- Scope all queries by `user_id`

---

## Architectural Safety

- UI must never directly read from cloud APIs
- Keep cloud access isolated in the data/sync layer
- Avoid coupling rendering with backend availability

---

# 12. Long-Term Scalability Rules

When adding new features, preserve these four rules:

## 1. All CRUD Goes Through the Data Layer

No screen should bypass repositories/data abstractions.

---

## 2. UI Reads from Local Models Only

Rendering should not depend on cloud availability.

---

## 3. Sync Layer Remains Independent

The synchronization system should:

- Retry safely
- Be idempotent
- Operate independently from UI rendering

---

## 4. Auth Context Is the Single Source of Truth

Session and identity must only come from the centralized auth layer.

---

If these rules remain intact, the architecture can scale long term without major rewrites or README restructuring.