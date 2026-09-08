# HimVidhya LMS Backend

An Educational LMS backend handling classes, join requests, students, and teachers. Built with Express, MongoDB, and modern Node.js practices.

## Core Architecture

- **Express.js** API using Node >= 24
- **MongoDB + Mongoose** for data storage
- **JWT Authentication** (access and refresh tokens)
- **Role-Based Access Control (RBAC)** for teacher and student roles
- **Zod Validation** for structured request body validation
- **Centralized Error Handling** with Winston logging

## Setup & Run

1. Install strict dependencies: `npm install`
2. Create `.env` from the required variables (see below)
3. Start development server: `npm run dev`

## Environment Variables Needed

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/himvidhya
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

See `.env.example` for the full list, including object storage and Sentry variables consumed by later phases.

## Available Scripts

- `npm run dev` - Start with nodemon (auto-restart)
- `npm start` - Start production server
- `npm test` - Run the Jest test suite (`--runInBand`)
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checks (JSDoc/type-checked JS)
- `npm run audit:deps` - Run npm audit with high severity threshold
- `npm run outdated:deps` - Show outdated dependencies
- `npm run health:deps` - Run audit + outdated checks

The server exposes `/health` and `/api/v1/health` for readiness checks.

Verify a running instance with:

```bash
curl http://localhost:5000/health
```

## Running with Docker Compose

```bash
docker compose up
```

Starts MongoDB, MinIO and the server. Self-contained on a server-only clone - no client checkout required.

```bash
docker compose --profile fullstack up
```

Additionally builds and starts the client, expected to be checked out as a sibling directory (`../client`). If your client checkout lives elsewhere, point `CLIENT_PATH` at it:

```bash
CLIENT_PATH=../himvidhya-frontend docker compose --profile fullstack up
```
