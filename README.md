# Goodluck Medical Laboratories — Website

A full-stack website for **Goodluck Medical Laboratories Limited** (Ricabim House, 47 Oba Adesida Rd, MTN Office, Akure, Ondo State), built with Next.js.

## Features

- **Marketing site** — hero, services, how-it-works, stats, testimonials, and calls to action, styled around a medical/trust colour palette.
- **Online appointment booking** — patients pick a service, date, and time; requests land in the admin dashboard for confirmation.
- **Contact / enquiry form** — general enquiries land in the admin dashboard.
- **Patient portal** — patients create a free account, view their test results and appointment history, and download result files securely.
- **Admin dashboard** — staff log in to manage appointments, enquiries, patients, upload test results (with file attachments), and edit services/pricing.
- **WhatsApp integration** — floating button and CTAs link straight to WhatsApp for urgent enquiries.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript, Turbopack)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Prisma ORM](https://www.prisma.io) + SQLite (swap to Postgres/MySQL for production — see below)
- [Auth.js (NextAuth v5)](https://authjs.dev) — credentials login with `ADMIN` / `PATIENT` roles
- [Zod](https://zod.dev) + [React Hook Form](https://react-hook-form.com) for validated forms
- [Lucide](https://lucide.dev) icons

## Getting started

```bash
npm install
npx prisma db push      # create the SQLite database from prisma/schema.prisma
npm run db:seed         # seed an admin user, a demo patient, services, and sample data
npm run dev             # start the dev server at http://localhost:3000
```

### Demo logins (from the seed script)

| Role    | Email                            | Password       |
|---------|-----------------------------------|----------------|
| Admin   | admin@goodluckmedicallabs.com     | ChangeMe123!   |
| Patient | patient@example.com               | Patient123!    |

**Change these before going live** — either edit `.env` before seeding, or update the passwords directly from the app once deployed.

## Environment variables

See `.env` for the full list. Key ones:

- `DATABASE_URL` — Prisma connection string (defaults to local SQLite file).
- `AUTH_SECRET` — random secret used to sign session tokens. **Generate a new one for production**, e.g. `openssl rand -base64 32`.
- `NEXTAUTH_URL` — your production URL once deployed.
- `SMTP_*` / `NOTIFY_EMAIL` — optional, only needed if you wire up email notifications for new bookings/enquiries (not enabled by default; forms currently just write to the database and appear in the admin dashboard).

## Content to replace before launch

Everything below is a realistic placeholder and should be swapped for the real thing:

- **Service prices** (`lib/services-data.ts`, or edit directly from Admin → Services once seeded) — currently estimated Naira starting prices.
- **Testimonials** (`components/home/testimonials.tsx`) — currently illustrative quotes, not real patient reviews.
- **Stats strip** (`components/home/stats.tsx`) — placeholder numbers (years served, tests conducted, etc.).
- Any specific accreditation/certification claims — the site currently says the lab operates in line with MLSCN (Medical Laboratory Science Council of Nigeria) practice; update with your actual registration/certification details.

## Going to production

1. **Database**: SQLite is fine for a low-traffic single-server deployment, but most hosts (Vercel, etc.) have an ephemeral filesystem. For a real deployment, switch `provider` in `prisma/schema.prisma` to `postgresql` (or `mysql`), point `DATABASE_URL` at a managed database (Neon, Supabase, Railway, etc.), then run `npx prisma db push`.
2. **File storage**: uploaded result files are written to `storage/uploads/results/` on disk. On platforms with an ephemeral filesystem (e.g. Vercel), swap `lib/storage.ts` for an object storage provider (S3, Cloudflare R2, Supabase Storage, etc.) before launch.
3. **Secrets**: set `AUTH_SECRET`, `DATABASE_URL`, and `NEXTAUTH_URL` as environment variables in your hosting provider — do not commit real secrets to git.
4. **Seed data**: run `npm run db:seed` once against the production database to create your first real admin account, then change its password.

## Project structure

```
app/            Routes (App Router) — public pages, /portal, /admin, /api/*
components/     Shared UI, home page sections, admin widgets
lib/            Prisma client, auth config, validation schemas, site constants
prisma/         Schema, seed script
storage/        Uploaded result files (gitignored)
```
