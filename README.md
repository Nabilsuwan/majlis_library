# Majlis Library System

Rebuild of the Arabic scholarly/heritage book library — replacing a

job-board system that was never built for a library — with staff
cataloguing tools, photograph-to-add intake, and a public Arabic
search/browse site.

## Where things stand

Currently in Stage 2 (build the foundations) of the project plan.
Decided so far:
- Reference collection, no lending.
- Old "book type" field is dropped (carried no real information).
- Cover images collected via the photograph-to-add workflow.
- Photograph-to-add may use an external reading service (contract
  must confirm no training on images without opt-out, reasonable
  retention limits).

## Development workflow

We're building and testing on free infrastructure before touching
the real production server:

- **Database:** Neon (free Postgres) — see `schema.sql`
- **App hosting:** Vercel (free, auto-deploys from this repo)
- **Production target:** self-hosted on the office QNAP NAS
  (Container Station), reached on the office network or via Tailscale —
  see **`QNAP.md`** for the move

## Local development

```bash
cd app
npm install
# create app/.env.local with:
# DATABASE_URL=<your Neon connection string>
npm run dev
```

## Applying the schema to a fresh database (Neon or otherwise)

```bash
psql "$DATABASE_URL" -f schema.sql
```

## Project structure

```
schema.sql          Database schema (Postgres)
app/                 Next.js application (staff tools + public site)
docker-compose.yml   QNAP deployment (Postgres + app + backups + n8n)
backup/              Nightly database backup script
migrate/             Scripts to move from Neon/Vercel to the NAS
QNAP.md              Step-by-step NAS move + checklists
DEPLOY.md            (old) VPS plan for sharjahbook.com — no longer used
```
