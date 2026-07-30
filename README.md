# ClassLedger — Student CRM

React + Express API to manage student name, age, attendance, and fees.

## Features

- **Add student details** — name, age, payment date, classes, fees, amount paid, batch
- **Students** — browse, edit, delete, view class dates
- **Attendance** — mark present / late / absent by date
- **Fees** — record extra payments
- **Export CSV** — from Overview
- **Database** — local SQLite file in development; **Turso** (cloud SQLite) on Vercel

## Run locally

```bash
npm install
npm run dev
```

- API: `http://localhost:3001`
- App: `http://localhost:5173` (proxies `/api`)

Local data is stored in `server/data/student-crm.db` (no Turso needed).

## Deploy on Vercel (live data)

Vercel cannot keep a local SQLite file. Use a free **Turso** database:

1. Create an account at [turso.tech](https://turso.tech)
2. Create a database and copy:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. Deploy this repo to Vercel
4. In the Vercel project → **Settings → Environment Variables**, add both values
5. Redeploy

After that, `/api/*` runs as a Vercel serverless function and all CRM data persists in Turso.

Optional: copy `.env.example` to `.env` and set the same Turso values locally if you want local + production to share one database.

## Build

```bash
npm run build
```
