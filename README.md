# HimVidhya LMS Backend

An Educational LMS backend handling batches, students, teachers, and attendance. Built with Express, MongoDB, and modern Node.js practices.

## Core Architecture

- **Express.js** API using Node >= 24
- **MongoDB + Mongoose** for data storage
- **JWT Authentication** (access and refresh tokens)
- **Role-Based Access Control (RBAC)** for admin, teacher, and student roles
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
