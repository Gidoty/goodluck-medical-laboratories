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
- [Prisma ORM](https://www.prisma.io) + PostgreSQL
- [Auth.js (NextAuth v5)](https://authjs.dev) — credentials login with `ADMIN` / `PATIENT` roles
- [Zod](https://zod.dev) + [React Hook Form](https://react-hook-form.com) for validated forms
- [Lucide](https://lucide.dev) icons
- [@netlify/blobs](https://docs.netlify.com/blobs/overview/) for uploaded result files when deployed on Netlify (falls back to local disk in dev)

## Getting started locally

You need a Postgres database to develop against — the fastest way is a free one at [neon.com](https://neon.com) or [supabase.com](https://supabase.com). Alternatively, run Postgres locally.

```bash
npm install
cp .env.example .env     # then fill in DATABASE_URL and AUTH_SECRET
npx prisma db push       # create tables from prisma/schema.prisma
npm run db:seed          # seed an admin user, a demo patient, services, and sample data
npm run dev              # start the dev server at http://localhost:3000
```

### Demo logins (from the seed script)

| Role    | Email                            | Password       |
|---------|-----------------------------------|----------------|
| Admin   | admin@goodluckmedicallabs.com     | ChangeMe123!   |
| Patient | patient@example.com               | Patient123!    |

**Change these before going live** — either edit `.env` before seeding, or update the passwords directly from the app once deployed.

## Environment variables

See `.env.example` for the full list. Key ones:

- `DATABASE_URL` — Postgres connection string.
- `AUTH_SECRET` — random secret used to sign session tokens. **Generate a new one for production**, e.g. `openssl rand -base64 32`.
- `NEXTAUTH_URL` — your production URL once deployed.
- `SMTP_*` / `NOTIFY_EMAIL` — optional, only needed if you wire up email notifications for new bookings/enquiries (not enabled by default; forms currently just write to the database and appear in the admin dashboard).

## Content to replace before launch

Everything below is a realistic placeholder and should be swapped for the real thing:

- **Service prices** (`lib/services-data.ts`, or edit directly from Admin → Services once seeded) — currently estimated Naira starting prices.
- **Testimonials** (`components/home/testimonials.tsx`) — currently illustrative quotes, not real patient reviews.
- **Stats strip** (`components/home/stats.tsx`) — placeholder numbers (years served, tests conducted, etc.).
- Any specific accreditation/certification claims — the site currently says the lab operates in line with MLSCN (Medical Laboratory Science Council of Nigeria) practice; update with your actual registration/certification details.

## Deploying to Netlify

This repo is set up to deploy to Netlify out of the box (`netlify.toml` + `@netlify/plugin-nextjs`). Uploaded result files automatically use [Netlify Blobs](https://docs.netlify.com/blobs/overview/) when running on Netlify — no separate storage account needed.

1. **Get a Postgres database.** Sign up free at [neon.com](https://neon.com) (or [supabase.com](https://supabase.com)), create a project, and copy its connection string.
2. **Connect the repo to Netlify.** In the Netlify dashboard: Add new site → Import an existing project → choose `gidoty/goodluck-medical-laboratories`. Netlify will detect the Next.js plugin from `netlify.toml` automatically.
3. **Set environment variables** in Site configuration → Environment variables:
   - `DATABASE_URL` — the Neon/Supabase connection string from step 1
   - `AUTH_SECRET` — a fresh random string (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` — your Netlify site URL (e.g. `https://your-site.netlify.app`)
4. **Deploy.** Netlify runs `npm install` (which also runs `prisma generate` via the `postinstall` script) and `npm run build`.
5. **Create the database tables and seed data.** From your own machine (with `DATABASE_URL` pointed at the same Neon/Supabase database), run:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
6. **Log in as admin and change the seeded password immediately.**

## Project structure

```
app/            Routes (App Router) — public pages, /portal, /admin, /api/*
components/     Shared UI, home page sections, admin widgets
lib/            Prisma client, auth config, validation schemas, site constants, file storage
prisma/         Schema, seed script
storage/        Uploaded result files for local dev only (gitignored; Netlify uses Blobs instead)
netlify.toml    Netlify build configuration
```
