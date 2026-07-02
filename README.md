# Airzz Receipts

Receipt generator: pick a template, fill in a form, watch it update live on the right, export a PDF. Accounts get 3 free generates a month; you top people up from `/admin`.

## What's inside

- `server.js` — Express app, all routes
- `db.js` — Postgres (Neon) connection + schema (auto-creates tables on boot)
- `lib/templateSchema.js` — figures out which form fields each receipt template needs
- `lib/exportPdf.js` — PDF export via iLovePDF, ported unchanged from the old project
- `templates/*.html` — the 22 receipt templates
- `views/`, `public/` — the dark-themed frontend (signup/login, template picker, editor + live preview, admin panel)

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (see below), `ADMIN_USERNAME`/`ADMIN_PASSWORD`, and the iLovePDF keys.
3. `npm start` — runs on `http://localhost:3000`.

Note: PDF export will NOT work on localhost (iLovePDF has to fetch your HTML over a public URL). Signup, login, the template picker, and the live preview all work fine locally — only the "Download PDF" button needs a real deployed domain.

## Deploying on Render

1. Push this folder to a GitHub repo (it already has a `.gitignore` that excludes `node_modules` and `.env`).
2. On Render: New -> Web Service -> connect the repo. `render.yaml` is included so Render will pick up the build/start commands automatically; otherwise set:
   - Build command: `npm install`
   - Start command: `npm start`
3. In the service's Environment tab, set:
   - `DATABASE_URL` — your Neon connection string (see below)
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — whatever you want to log into `/admin` with
   - `ILOVEPDF_PUBLIC_KEY` / `ILOVEPDF_SECRET_KEY` — from your iLovePDF developer account
   - `SESSION_SECRET` — any random string (Render can auto-generate this)
   - `CONTACT_EMAIL` — shown to users when they run out of free generates (defaults to kapeairzz7@gmail.com)
   - `FREE_MONTHLY_CREDITS` — defaults to 3
4. Deploy. Once it's live, `/` will redirect you through signup/login, and `/admin` is where you manage accounts and grant bonus generates.

## Setting up Neon (Postgres)

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string it gives you (starts with `postgres://` and ends with `?sslmode=require`).
3. Paste it into `DATABASE_URL` in Render's environment settings (and your local `.env` if running locally).
4. That's it — the app creates its own tables (`users`, `sessions`, `generations`, `login_attempts`) automatically on first boot. No manual SQL needed.

## Setting up iLovePDF

1. Sign in at [developer.ilovepdf.com](https://developer.ilovepdf.com/) and grab your project's **Public key** and **Secret key**.
2. Set them as `ILOVEPDF_PUBLIC_KEY` / `ILOVEPDF_SECRET_KEY`.
3. PDF export settings are unchanged from the old project: A4 portrait, 768px render width, single page, no margin.

## How credits work

- Every account gets `FREE_MONTHLY_CREDITS` (default 3) free generates, resetting automatically on the 1st of each month.
- From `/admin`, you can grant "bonus" generates to any account (they stack and don't expire/reset) or flip an account to **Unlimited**.
- When someone's account is out of generates, the app shows a "your free generates reset next month, ask for more" banner with a pre-filled `mailto:` link to `CONTACT_EMAIL`.
- The admin account itself is never limited.

## Notes on what changed vs. the old project

- **Accounts instead of one-time codes.** Sign up with email + password instead of DM'ing for an access code.
- **Postgres instead of SQLite**, so data survives Render restarts/redeploys (SQLite on Render's free tier resets on every deploy since there's no persistent disk).
- **PDF export logic is untouched** — same iLovePDF `htmlpdf` task, same `page_size/page_margin/view_width/remove_popups` settings that worked in v1.
- **Modal/mobile bugs fixed:** the old CSS used `backdrop-filter` without the `-webkit-` prefix Safari needs, plain `100vh` (which iOS Safari miscalculates because of the address bar), and toggled a fixed overlay without locking body scroll — all of which is what made modals break on iPad/Mac. The template picker and editor are now separate full pages (not modals) so there's a lot less to break; the one remaining overlay (admin login) uses prefixed `-webkit-backdrop-filter`, `dvh` units, and proper scroll-locking.
- **iOS downloads:** iOS Safari ignores the `download` attribute on blob links, so on iPhone/iPad the generated PDF opens in a new tab (Share -> Save to Files) instead of silently failing.
