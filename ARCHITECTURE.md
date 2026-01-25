# Chat Backend – Architecture Guide

## ✅ Current Project Layout

```
chat-backend/
├── config/
│   ├── database.js              # MongoDB connection
│   └── jwt.js                   # JWT helpers
├── controllers/                 # HTTP orchestration
│   ├── auth.controller.js
│   ├── conversation.controller.js
│   ├── message.controller.js
│   └── user.controller.js
├── services/                    # Business logic
│   ├── auth.service.js
│   ├── conversation.service.js
│   ├── message.service.js
│   └── user.service.js
├── middleware/
│   ├── authMiddleware.js        # JWT protect
│   ├── errorHandler.js          # Global errors
│   └── rateLimiter.js           # Auth throttling
├── models/
│   ├── User.js
│   ├── Conversation.js
│   ├── conversationParticipant.js
│   └── Message.js
├── routes/
│   ├── authRoutes.js            # /api/auth
│   ├── userRoutes.js            # /api/users
│   ├── conversationRoutes.js    # /api/conversations
│   └── messageRoutes.js         # /api/messages
├── sockets/
│   └── chatSocket.js            # Socket.IO events
├── utils/
│   └── helpers.js
├── server.js                    # App bootstrap (Express + Socket.IO)
└── package.json
```

## 🧭 Architectural Pattern

Layered “Route → Controller → Service → Model”, with middleware for cross‑cutting concerns and Socket.IO for realtime.

- **Routes**: URL wiring only.
- **Controllers**: Validate inputs, shape HTTP responses, delegate to services.
- **Services**: Business logic and coordination with models.
- **Models**: Mongoose schemas and persistence.
- **Middleware**: Auth, rate limiting, error handling.
- **Sockets**: Event-driven chat (rooms, typing, presence).

## 🚀 Key Behaviors

- **Auth**: JWT issuance/verification, rate-limited register/login, bcrypt hashing via User pre-save.
- **Users**: Profile fetch/update, search, protected by `protect` middleware.
- **Conversations**: Create/fetch conversations, list messages with pagination.
- **Messages**: Send via HTTP or Socket.IO; conversation `lastMessage` kept updated.
- **Realtime**: Join rooms per conversation, typing indicators, online/offline presence, push new messages to room members.

## 🔌 API Surface (HTTP)

- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/users` (auth)
- GET `/api/users/:id` (auth)
- PUT `/api/users/:id` (auth, self-only)
- GET `/api/users/search?q=` (auth)
- GET `/api/conversations` (auth)
- POST `/api/conversations` (auth, body: participantId)
- GET `/api/conversations/:conversationId/messages` (auth, query: limit, skip)
- POST `/api/messages/send` (auth)

## 🔌 Socket.IO Events

**Client → Server**

- `join-room` (conversationId)
- `leave-room` (conversationId)
- `send-message` ({ conversationId, content })
- `typing` / `stop-typing` (conversationId)

**Server → Client**

- `receive-message` (message payload)
- `user-typing` / `user-stopped-typing` ({ userId })
- `user-online` / `user-offline` ({ userId })

## 🧪 Dev Commands

```bash
npm run dev    # start with nodemon
npm start      # production
curl http://localhost:5000/health
```

## 🎯 Next Enhancements

- Group chats (titles, roles via conversationParticipant).
- Message extras: uploads, edits, reactions, read receipts.
- Notifications: unread counts, push/webhooks.
- Tests: unit (services), integration (routes), Socket.IO flow tests.
- Ops: rate limits per role, better logging/metrics, indexes for queries.
  ✅ **Rate Limiting** - Protect auth endpoints  
  ✅ **Code Organization** - Clear folder structure  
  ✅ **Async/Await** - Modern JavaScript patterns  
  ✅ **Environment Variables** - Config management  
  ✅ **Password Security** - Bcrypt hashing  
  ✅ **CORS** - Cross-origin request handling

## 🎓 What You've Learned

This clean architecture teaches:

- How to structure a Node.js backend
- Real-time communication with WebSockets
- JWT authentication patterns
- MongoDB schema design
- Middleware implementation
- Error handling strategies
- RESTful API conventions

You now have a solid foundation to build upon. Each component is simple, focused, and easy to understand. Start by experimenting with adding new features!

---

**Happy coding! 🚀**
