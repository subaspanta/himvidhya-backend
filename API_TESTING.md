# Chat Backend - API Testing Guide

## Prerequisites

- Server running on `http://localhost:5000`
- MongoDB running
- A tool like `curl`, Postman, or VS Code REST Client

## 1. Register a User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice",
    "email": "alice@example.com",
    "password": "password123"
  }'
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "user_id_here",
    "name": "Alice",
    "email": "alice@example.com",
    "status": "offline",
    "createdAt": "2024-01-22T..."
  }
}
```

## 2. Login User

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "password123"
  }'
```

## 3. Search for Users

```bash
curl -X GET "http://localhost:5000/api/users/search?q=alice" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 4. Get User Profile

```bash
curl -X GET http://localhost:5000/api/users/:userId \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 5. Update User Profile

```bash
curl -X PUT http://localhost:5000/api/users/:userId \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Alice Updated",
    "avatar": "https://example.com/avatar.jpg"
  }'
```

## 6. Create a Conversation

```bash
curl -X POST http://localhost:5000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "participantId": "other_user_id_here"
  }'
```

**Response:**

```json
{
  "_id": "conversation_id_here",
  "participants": ["user1_id", "user2_id"],
  "isGroup": false,
  "createdAt": "2024-01-22T..."
}
```

## 7. Get All Conversations

```bash
curl -X GET http://localhost:5000/api/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 8. Get Messages in Conversation

```bash
curl -X GET "http://localhost:5000/api/conversations/conversation_id/messages?limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 9. Send a Message (REST - for Socket.IO see below)

```bash
curl -X POST http://localhost:5000/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "conversation": "conversation_id_here",
    "content": "Hello!"
  }'
```

## 10. Real-time Chat with Socket.IO

### Client-side connection (JavaScript):

```javascript
const io = require("socket.io-client");

const socket = io("http://localhost:5000", {
  auth: {
    token: "YOUR_JWT_TOKEN",
  },
});

// Connect
socket.on("connect", () => {
  console.log("Connected!");

  // Join a conversation room
  socket.emit("join-room", "conversation_id_here");
});

// Send message
socket.emit("send-message", {
  conversationId: "conversation_id_here",
  content: "Hello from Socket.IO!",
});

// Receive message
socket.on("receive-message", (message) => {
  console.log("New message:", message);
});

// Typing indicator
socket.emit("typing", "conversation_id_here");
socket.emit("stop-typing", "conversation_id_here");

// User events
socket.on("user-typing", (data) => {
  console.log("User typing:", data.userId);
});

socket.on("user-online", (data) => {
  console.log("User online:", data.userId);
});

socket.on("user-offline", (data) => {
  console.log("User offline:", data.userId);
});
```

## Full Test Workflow

### Step 1: Register first user

```bash
TOKEN1="<token_from_register>"
USER1_ID="<user_id_from_register>"
```

### Step 2: Register second user

```bash
TOKEN2="<token_from_second_register>"
USER2_ID="<user_id_from_second_register>"
```

### Step 3: Create conversation (as user 1)

```bash
CONV_ID=$(curl -s -X POST http://localhost:5000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{\"participantId\": \"$USER2_ID\"}" | jq -r '._id')
```

### Step 4: Send message (as user 1)

```bash
curl -X POST http://localhost:5000/api/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{"content": "Hello User 2!"}'
```

### Step 5: Get messages (as user 2)

```bash
curl -X GET http://localhost:5000/api/conversations/$CONV_ID/messages \
  -H "Authorization: Bearer $TOKEN2"
```

## Error Responses

### Missing Token

```json
{
  "error": "No token provided"
}
```

### Invalid Token

```json
{
  "error": "Invalid or expired token"
}
```

### User Not Found

```json
{
  "error": "User not found"
}
```

### Duplicate Email

```json
{
  "error": "Email already registered"
}
```

---

**Pro Tip:** Use Postman or VS Code REST Client extension to save and organize these requests!
