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
- Announcement posts with private file, link, and YouTube attachments
- Searchable learning materials with upload, replace, download, and delete
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

4. Start MongoDB and MinIO, then run the API locally:

   ```bash
   docker compose up -d mongo minio minio-init
   npm run dev
   ```

   This is the recommended development mode: infrastructure runs in Docker,
   while Nodemon runs the API. Do not also run `docker compose up server`; that
   would start a second API process and reserve port `5000`.

The API is available at `http://localhost:5000`, with application routes under
`http://localhost:5000/api/v1`. MinIO's console is available at
`http://localhost:9001`.

## File Workflows

HimVidhya has two intentionally separate file experiences:

- **Materials** is the durable, searchable class library. Teachers can upload,
  replace, and delete resources; active members can view and download them.
- **Post attachments** add context to one announcement. A post may contain up
  to 10 allowed files, HTTP(S) links, or YouTube videos.

Allowed file types are PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG, JPG, and
JPEG, with a 25 MB per-file limit. Both workflows use private S3-compatible
storage:

```text
browser -> request authorized URL from API -> transfer bytes with MinIO/S3
        -> API verifies object metadata -> API stores safe metadata only
```

Storage keys are never returned in post or material read responses. Active
class membership is checked before the API issues a short-lived download URL.

## Docker Compose

Start the complete backend stack (API, MongoDB, and MinIO):

```bash
docker compose up -d
```

Start the complete local stack, including the client checkout at `../client`:

```bash
docker compose --profile fullstack up -d
```

For a client checkout in another location, set `CLIENT_PATH` before starting:

```bash
CLIENT_PATH=../himvidhya-frontend docker compose --profile fullstack up -d
```

Inspect status and logs with `docker compose ps` and
`docker compose logs -f server`. Stop the stack with `docker compose down`.

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

| Command                 | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Start the API with Nodemon                           |
| `npm start`             | Start the production server                          |
| `npm test`              | Run Jest tests serially                              |
| `npm run lint`          | Run ESLint                                           |
| `npm run typecheck`     | Run TypeScript checks for JSDoc-typed JavaScript     |
| `npm run audit:deps`    | Audit dependencies for high-severity vulnerabilities |
| `npm run outdated:deps` | List outdated dependencies                           |
| `npm run health:deps`   | Run dependency audit and outdated checks             |

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
