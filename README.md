# Chat App Backend

A clean, real-time chat application backend built with Express.js, Socket.IO, and MongoDB.

## Features

- User authentication with JWT
- Real-time messaging with Socket.IO
- User profiles and conversations
- Message history
- Online/offline status
- Rate limiting for API endpoints

## Project Structure

```
chat-backend/
├── config/              # Configuration files
├── controllers/         # Route controllers
├── models/             # MongoDB schemas
├── routes/             # API routes
├── middleware/         # Custom middleware
├── utils/              # Utility functions
├── sockets/            # Socket.IO event handlers
├── .env.example        # Environment variables template
├── server.js           # Application entry point
└── package.json
```

## Installation

```bash
npm install
```

## Environment Setup

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Update `.env` with your configuration:

- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: A strong secret key for JWT
- `PORT`: Server port (default: 5000)
- `CLIENT_URL`: Your client application URL

## Running the Server

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh JWT token

### Users

- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `GET /api/users/search?q=query` - Search users

### Conversations

- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id/messages` - Get messages in conversation

## Socket.IO Events

### Client → Server

- `join-room` - Join a conversation room
- `send-message` - Send a message
- `typing` - User is typing
- `stop-typing` - User stopped typing
- `disconnect` - User disconnected

### Server → Client

- `receive-message` - New message received
- `user-typing` - User is typing
- `user-stopped-typing` - User stopped typing
- `user-online` - User came online
- `user-offline` - User went offline

## Learning Resources

This backend demonstrates:

- Clean code architecture and best practices
- RESTful API design
- Real-time communication with WebSockets
- JWT authentication
- MongoDB schema design
- Error handling and validation
- Rate limiting and security
