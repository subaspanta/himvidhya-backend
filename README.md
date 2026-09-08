# HimVidhya API

The backend for HimVidhya, a classroom collaboration and learning-material
platform. It provides authentication, class membership, posts, comments, and
learning-material workflows for teachers and students.

This repository is an independent service. The frontend lives in the sibling
`client/` repository and communicates with this API through the versioned
`/api/v1` routes.

## What It Provides

- Cookie-based JWT authentication with access-token refresh
- Teacher and student role-based access control
- Private classes with join codes and approval-based membership
- Posts, comments, learning materials, and profile workflows
- Resource-level authorization at the service layer
- Request validation, centralized errors, structured responses, and logging

## Technology

- Node.js 24 and Express 4
- MongoDB with Mongoose
- Zod request validation
- Jest integration tests
- Winston logging

## Requirements

- Node.js `>=24 <25`
- npm `>=11 <12`
- MongoDB, either locally or through Docker Compose

## Local Setup

1. Install dependencies:

	```bash
	npm ci
	```

2. Create the environment file:

	```bash
	cp .env.example .env
	```

3. Set the required values in `.env`:

	```env
	PORT=5000
	MONGODB_URI=mongodb://localhost:27017/himvidhya
	JWT_ACCESS_SECRET=replace_with_a_long_random_value
	JWT_REFRESH_SECRET=replace_with_a_different_long_random_value
	ACCESS_TOKEN_EXPIRES_IN=15m
	REFRESH_TOKEN_EXPIRES_IN=7d
	CLIENT_URL=http://localhost:3000
	```

	See `.env.example` for the complete configuration, including storage and
	observability settings.

4. Start the development server:

	```bash
	npm run dev
	```

The API is available at `http://localhost:5000`, with application routes under
`http://localhost:5000/api/v1`.

## Docker Compose

Start the backend with MongoDB and MinIO:

```bash
docker compose up
```

Start the complete local stack, including the client checkout at `../client`:

```bash
docker compose --profile fullstack up
```

For a client checkout in another location, set `CLIENT_PATH` before starting:

```bash
CLIENT_PATH=../himvidhya-frontend docker compose --profile fullstack up
```

## Verification

Health endpoints:

```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/v1/health
```

Run the full local quality checks:

```bash
npm test
npm run lint
npm run typecheck
```

Dependency checks are available through `npm run health:deps`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API with Nodemon |
| `npm start` | Start the production server |
| `npm test` | Run Jest tests serially |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks for JSDoc-typed JavaScript |
| `npm run audit:deps` | Audit dependencies for high-severity vulnerabilities |
| `npm run outdated:deps` | List outdated dependencies |
| `npm run health:deps` | Run dependency audit and outdated checks |

## Project Structure

```text
config/         Runtime configuration
controllers/    HTTP request and response coordination
middleware/     Authentication, validation, rate limiting, and errors
models/         Mongoose schemas and model helpers
routes/         Versioned endpoint registration
services/       Business rules and authorization
tests/          Jest integration and domain tests
utils/          Shared response, cursor, email, and error utilities
```

The intended request flow is:

```text
route -> middleware -> controller -> service -> model
```

Routes stay focused on composition, controllers translate HTTP concerns, and
services own business rules and authorization.
