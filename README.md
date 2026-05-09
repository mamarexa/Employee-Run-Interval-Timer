<div align="center">
  <img src="public/icons/logo.svg" width="80" height="80" alt="MonCivique Run" />
  <h1>MonCivique Run</h1>
  <p>Employee wellness running app — a PWA interval timer for structured training programs.</p>
</div>

---

## Overview

MonCivique Run guides employees through progressive running programs (Starter, 5K, 10K) with a step-by-step interval timer, audio cues, and haptic feedback. It's designed to be installed on iOS and Android home screens via a magic link, requiring no app store and no password.

## Features

- **Magic-link auth** — employees receive a personal URL, tap it once, "Add to Home Screen" — permanently logged in
- **Interval timer** — step-by-step audio + haptic cues for run/walk/warmup/cooldown intervals
- **Three built-in programs** — Starter (walk/run intro), 5K and 10K training plans
- **Progress tracking** — per-user progress and workout history stored server-side
- **Admin panel** — manage employee roster, generate/revoke access links, create and edit programs
- **Offline-capable PWA** — Workbox service worker, installable on iOS Safari and Android Chrome

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS v4, Framer Motion |
| Backend | Node.js 22, Express 4, TypeScript |
| Database | PostgreSQL 16 |
| Auth | UUID v4 magic tokens → 7-day JWTs (bcrypt for admin) |
| PWA | vite-plugin-pwa (Workbox) |
| Deployment | Docker + Docker Compose |

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd moncivique-run

# 2. Create your .env file
cp .env.example .env
```

Edit `.env` and fill in real values (see [Environment Variables](#environment-variables) below).

```bash
# 3. Start everything
docker compose up -d
```

The app runs at **http://localhost:3000**.

### Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL password — use a strong random string |
| `JWT_SECRET` | JWT signing secret — generate with `openssl rand -base64 48` |
| `ADMIN_USERNAME` | Admin panel username |
| `ADMIN_PASSWORD_HASH` | bcrypt hash (cost 12) of the admin password |

**Generate a bcrypt hash for `ADMIN_PASSWORD_HASH`:**

```bash
docker run --rm node:22-alpine node -e \
  "require('bcryptjs').hash('yourpassword', 12).then(console.log)"
```

## Admin Panel

Navigate to `/admin` in your browser. The admin panel lets you:

- **Roster** — add employees by name, copy their personal magic link, revoke/restore access
- **Programs** — create programs, manage sessions, edit interval sequences
- **Metrics** — weekly active users and workout counts

## Project Structure

```
├── server/            Express API (TypeScript)
│   ├── db.ts          PostgreSQL pool
│   ├── index.ts       App entry point
│   ├── middleware/    JWT auth middleware
│   ├── routes/        API route handlers
│   └── seed.ts        Initial program data
├── src/               React frontend
│   ├── components/    UI components (timer, nav, cards)
│   ├── pages/         Route-level pages (Auth, Admin)
│   ├── store/         Zustand state stores
│   └── lib/           API client, utilities
├── public/            Static assets (manifest, icons)
├── schema.sql         PostgreSQL schema (auto-applied on startup)
├── Dockerfile         Multi-stage build
└── docker-compose.yml Postgres + app services
```

## Deployment

The Docker image builds the React frontend and compiles the TypeScript server in a single multi-stage build. The production container serves both the static assets and the API on port 3000.

For production, set `PORT` in your environment if you need a different port, and place a reverse proxy (nginx, Caddy, Traefik) in front to handle TLS.

## License

Private — internal use only.

