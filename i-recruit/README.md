# I-Recruit website

Marketing site for I-Recruit, a construction recruitment agency placing masons and labourers
(sourced in Nigeria, Cameroon and Kenya) with employers in Alberta, Canada.

Standalone Next.js 16 app inside this repository. It shares no code or config with the other projects here.

## Run

```bash
cd i-recruit
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Structure

- `src/app/` pages: home, `employers`, `workers`, `services`, `about`, `contact`, `privacy`, plus sitemap, robots, OG image
- `src/components/` header, footer, logo, brick wall hero art, enquiry form, FAQ
- `src/lib/site.ts` contact details, nav, site URL. Edit client details here.
- `src/app/globals.css` brand tokens (charcoal `#2c2d31`, orange `#f58b1e`), fonts are Barlow and Barlow Condensed via `@fontsource`

## Forms

There is no backend. Each form builds a message and opens WhatsApp or the visitor's email app, so nothing is stored.
To switch to server-side submission later, replace `EnquiryForm.tsx` with a Formspree or Resend call.

## Deploy on Vercel

1. Import the repository in the target Vercel account.
2. Set **Root Directory** to `i-recruit`. Framework preset: Next.js.
3. Add the env var `NEXT_PUBLIC_SITE_URL` (for example `https://www.your-domain.com`) so the sitemap, canonical URLs and share image use the real domain.
