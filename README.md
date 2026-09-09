# Bulk Email Verification Application

A complete full-stack web application for bulk email verification, built using React, Express, Node.js, and SQLite.

## Features
- **Frontend Dashboard:** React, Vite, Tailwind CSS, Recharts
- **Verification Engine:** Node.js, `dns` module, `net` (raw socket SMTP)
- **Database:** SQLite (better-sqlite3) with WAL mode
- **Architecture:** Monolithic single repository. Run frontend and backend together.
- **Layers:** 
  - Syntax & Regex
  - Disposable Domain Detection
  - Role-based Detection
  - DNS / MX Record Resolution with fallback
  - Raw SMTP Handshake Verification

## Requirements
- Node.js 18+
- NPM

## Installation
From the root directory, run:
```bash
npm install
```

## Development
Run both frontend and backend concurrently:
```bash
npm run dev
```

## Production
Build the React frontend and run the production server:
```bash
npm run build
npm start
```

## Known Limitations of SMTP Verification
- SMTP verification is not 100% accurate.
- Major providers (Gmail, Outlook, Yahoo) actively block residential IPs and cloud providers connecting directly via port 25 without proper reputation, SPF, and DKIM.
- "Catch-all" domains will accept any address.
- Greylisting (4xx responses) requires retries, which this engine attempts, but may still be inconclusive without waiting long periods.
- Therefore, the app produces a **Confidence Score** and classifies emails as DELIVERABLE, RISKY, UNDELIVERABLE, or UNKNOWN. It never guarantees delivery.
