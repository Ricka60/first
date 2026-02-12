# Pats Peak Rental Intake (Multi‑Step)

Two-step wizard to find a guest (Step 1) and collect rental details (Step 2). Includes a Node/Express backend with validation, security hardening, and optional mock mode for local testing.

## Quick Start

```bash
# 1) Navigate to the server folder
cd server

# 2) Install dependencies
npm install

# 3) Run in development (serves the frontend at /public)
npm run dev

# 4) Open the app
# http://localhost:3000
```

## Configuration

Environment variables live in `server/.env`.

```ini
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# External API endpoints (not used in MOCK_MODE)
TARGET_API_SEARCH_URL=https://api.example.com/v1/guests/search
TARGET_API_URL=https://api.example.com/v1/intake
TARGET_API_KEY=REPLACE_ME

SITE_LABEL=PatsPeak
MOCK_MODE=true
```

- Set `MOCK_MODE=true` to test locally without a real API. Lookup returns mock matches; submit returns success.
- Switch `MOCK_MODE=false` and set your real `TARGET_API_*` values to forward to your provider.

## What’s Inside

- **Frontend** (`/public`):
  - `index.html` – Multi-step UI (Lookup → Details)
  - `styles.css` – Responsive styling & stepper
  - `app.js` – Wizard logic, validation, prefill, and API calls
- **Backend** (`/server`):
  - `server.js` – Express app, security (helmet), logging (morgan), rate limiting, CORS, routes `/api/lookup` & `/api/intake`
  - `validators.js` – Joi schemas for lookup and intake
  - `package.json` – Dependencies and scripts
  - `.env` – Local environment variables

## Routes
- `POST /api/lookup` → Validates Step 1 and (in prod) calls `TARGET_API_SEARCH_URL`. In `MOCK_MODE`, returns fake matches.
- `POST /api/intake` → Validates Step 2. In `MOCK_MODE`, returns success immediately; otherwise forwards to `TARGET_API_URL`.
- `GET /api/health` → Simple health check.

## Notes
- CSP is enabled; if you add external scripts or fonts, update `helmet` CSP in `server.js`.
- Never commit real secrets. Use `.env` or your host’s secret manager.
- For production, run `npm start` (sets `NODE_ENV=production`).

## License
MIT (use freely at Pats Peak)
