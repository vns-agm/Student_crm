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

## Deploy on Vercel (required for live data)

Vercel cannot keep a local SQLite file. You **must** add a Turso database or the app will show an API error after deploy.

### 1. Create Turso DB (free)

1. Sign up at [turso.tech](https://turso.tech)
2. Install CLI (optional) or use the dashboard
3. Create a database and copy:
   - `TURSO_DATABASE_URL` (starts with `libsql://...`)
   - `TURSO_AUTH_TOKEN`

### 2. Add env vars in Vercel

In your Vercel project:

**Settings → Environment Variables**

| Name | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | your Turso URL |
| `TURSO_AUTH_TOKEN` | your Turso token |

Apply to **Production**, **Preview**, and **Development**, then **Redeploy**.

### 3. Verify

Open `https://YOUR-APP.vercel.app/api/health`

You should see:

```json
{ "ok": true, "database": "turso", "vercel": true }
```

If `database` is `"missing-turso"`, the env vars are not set (or you need to redeploy after adding them).

## Build

```bash
npm run build
```
