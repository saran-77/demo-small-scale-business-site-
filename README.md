# Small Business Security Practice

> ⚠️ Intentionally vulnerable. Do not deploy publicly. For local security testing only.

This project contains:

- `demo-site/frontend/` is a self-contained React/Vite small-business website with local in-memory mock data.
- `scanner/` is retained as an independent read-only Node.js CLI for a future HTTP target.

## Quick start

Requirements: Node.js 20 or newer and npm.

```powershell
npm run install:all
npm run dev
```

Open `http://127.0.0.1:5173`. There is no backend or database; demo accounts and changes live in browser memory and reset on refresh.

The local-only seeded accounts are:

- Customer: `alex@example.test` / `password123`
- Admin: `admin@example.test` / `admin123`

These are fake training credentials and must not be reused anywhere else.

## Safety boundaries

- The Vite development server binds to loopback by default.
- No real personal data, credentials, API keys, or third-party services are included.
- Do not deploy this practice frontend publicly.
