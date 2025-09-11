## Relatim - WhatsApp-style AI Messaging App (MERN + PostgreSQL)

### Tech Stack
- **Client**: React (Vite)
- **Server**: Node.js, Express
- **DB**: PostgreSQL

### Quick Start
1. Server
   - Copy env: `server/.env` from `server/env.example` (or set variables manually)
   - Install & run:
     - `cd server`
     - `npm install`
     - `npm run dev`
   - Health check: `GET http://localhost:3001/api/health`

2. Client
   - `cd client`
   - `npm install`
   - `npm run dev`
   - Open `http://localhost:5173`

Vite is configured to proxy `/api` to `http://localhost:3001` during development.

### Project Structure
```
relatim/
  client/           # React (Vite)
  server/           # Express API
    index.js        # API server with /api/health
    package.json
```

### Notes
- PostgreSQL variables can be provided as `DATABASE_URL` or individual params (`PGHOST`, `PGPORT`, etc.).
- Initial UI includes a top bar (Message/Dashboard), left sidebar tabs (Chat/Contacts), and a simple chat mock with composer.


