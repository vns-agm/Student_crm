# ClassLedger — Student CRM

React app with a real **SQLite** database to manage student name, age, attendance, and fees.

## Features

- **Add student details** — dedicated form; all values come from you (nothing hardcoded)
- **Students** — browse, edit, and delete database records
- **Attendance** — mark present / late / absent by date
- **Fees** — record amounts paid; balances use only data you enter
- **SQLite** file stored at `server/data/student-crm.db`

## Run locally

```bash
npm install
npm run dev
```

This starts:
- API + database on `http://localhost:3001`
- React app on `http://localhost:5173` (proxies `/api` to the backend)

## Build

```bash
npm run build
```
