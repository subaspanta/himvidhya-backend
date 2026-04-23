# HimVidhya Server

Backend API for the HimVidhya platform, built with Express.js and MongoDB.

## What This Server Includes

- JWT cookie-based authentication (access + refresh token flow)
- Versioned REST API (`/api/v1`)
- Role-aware authorization middleware
- Class creation and join-request workflows
- User management endpoints
- Health probes for local/devops checks
- Security middleware (helmet, cors, rate limiting)

## Tech Stack

- Node.js + Express 4
- MongoDB + Mongoose
- Zod validation
- JWT + cookies
- Winston logging

## Prerequisites

- Node.js `>=24 <25`
- npm `>=11 <12`
- MongoDB instance

If you use nvm:

```bash
nvm use 24
```

## Installation

```bash
npm ci
```

## Environment Setup

Create a `.env` file in `server/` and configure the required values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/himvidhya
CLIENT_URL=http://localhost:3000

JWT_ACCESS_SECRET=replace_with_strong_access_secret
JWT_REFRESH_SECRET=replace_with_strong_refresh_secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

Required at startup:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_IN`
- `CLIENT_URL`

## Running the Server

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Default base URL:

```text
http://localhost:5000
```

## Available Scripts

- `npm run dev` - Start with nodemon
- `npm start` - Start with node
- `npm run audit:deps` - Run npm audit (high severity threshold)
- `npm run outdated:deps` - Show outdated dependencies
- `npm run health:deps` - Run dependency health checks

## API Base Path

Versioned API prefix:

```text
/api/v1
```

## Health Endpoints

- `GET /health`
- `GET /api/v1/health`

Health response includes service status, version, timestamp, uptime, and DB connectivity state.

## Route Overview (Current)

### Auth

Base: `/api/v1/auth`

- `POST /register`
- `POST /login`
- `POST /refresh-token`
- `POST /logout`
- `POST /forget-password`
- `POST /verify-otp`
- `POST /reset-password`
- `GET /me`

### Class

Base: `/api/v1/class`

- `POST /` (teacher/admin)
- `GET /my`
- `POST /join` (student)
- `GET /requests/count` (teacher/admin)
- `GET /requests` (teacher/admin)
- `PATCH /requests/:requestId/approve` (teacher/admin)
- `PATCH /requests/:requestId/reject` (teacher/admin)
- `GET /:id`

### Users

Base: `/api/v1/users`

- `GET /search`
- `GET /`
- `GET /profile`
- `GET /:id`
- `PUT /:id`

### Attendance

Base: `/api/v1/attendance`

- Route mounted, implementation in progress.

## Project Structure

```text
server/
	config/           # App, DB, JWT, RBAC config
	controllers/      # Request handlers by domain
	middleware/       # Auth, validation, rate limit, error middleware
	models/           # Mongoose schemas
	routes/           # Versioned API route modules
	schemas/          # Zod validation schemas
	services/         # Domain service layer
	utils/            # Shared helpers and error utilities
	permissions/      # Permission rules
	server.js         # Express entry point
	package.json
```

## Local Dependency Health Check

```bash
npm run health:deps
```

## Notes

- CORS is configured with credentials and uses `CLIENT_URL`.
- API versioning is managed from `config/apiVersion.js`.
- This backend powers HimVidhya workflows; references to old chat terminology in package metadata are legacy and can be cleaned separately.
