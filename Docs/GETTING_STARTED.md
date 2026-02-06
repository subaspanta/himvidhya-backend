# 🚀 Getting Started - Chat Backend

## What You Have Now

✅ **Clean chat backend architecture** - Ready to learn and develop  
✅ **Production-ready structure** - Following best practices  
✅ **Real-time messaging** - With Socket.IO  
✅ **User authentication** - JWT-based  
✅ **MongoDB integration** - With proper schemas  
✅ **API endpoints** - RESTful design  
✅ **Error handling** - Centralized middleware  
✅ **Rate limiting** - Security built-in  

---

## 📁 File-by-File Explanation

### **server.js** - Main Entry Point
- Express app setup
- Socket.IO initialization
- Database connection
- Route mounting
- Error handling setup

### **config/database.js** - MongoDB Connection
- Simple, clean connection logic
- Error handling
- Environment variable support

### **config/jwt.js** - Authentication Logic
- Token generation
- Token verification
- Reusable functions

### **middleware/**
- **authMiddleware.js** - Protects routes, extracts userId
- **errorHandler.js** - Catches all errors, returns consistent responses
- **rateLimiter.js** - Prevents brute force attacks on auth endpoints

### **models/User.js** - User Schema
- Name, email, password fields
- Password hashing with `pre-save` hook
- `comparePassword()` method for login
- `toJSON()` removes password from responses

### **models/Conversation.js** - Conversation Schema
- Participants array (supports 1-on-1 and groups)
- Group name support
- Last message reference (for UI optimization)

### **models/Message.js** - Message Schema
- Links to Conversation and sender (User)
- Content and read status
- Timestamps for sorting

### **routes/**
- **authRoutes.js** - Register and login
- **userRoutes.js** - Profile and search
- **conversationRoutes.js** - Create and list conversations
- **messageRoutes.js** - Send and mark messages as read

### **sockets/chatSocket.js** - Real-time Events
- User connection/disconnection
- Message broadcasting
- Typing indicators
- Online/offline status

---

## 🎯 How to Use

### 1. **Start Developing**

```bash
cd /home/subas/chat-backend

# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

### 2. **Test the API**

See `API_TESTING.md` for complete examples using `curl`

Quick test:
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"123456"}'
```

### 3. **Understand the Flow**

1. User registers → Password hashed → JWT token generated
2. User login → Password compared → JWT token returned
3. User authenticated endpoints → Token verified → userId extracted
4. Create conversation → Link two users
5. Send message → Saved to DB + broadcast via Socket.IO
6. Receive message → Real-time update

---

## 💡 Key Learning Points

### Authentication Pattern
```
User Registration
    ↓
Password hashed with bcryptjs
    ↓
JWT token generated
    ↓
Token sent to client
    ↓
Client sends token in Authorization header
    ↓
Middleware verifies token
    ↓
userId extracted and passed to route
```

### Real-time Messaging Pattern
```
Client emits 'send-message'
    ↓
Socket handler receives event
    ↓
Message saved to MongoDB
    ↓
Message broadcasted to room
    ↓
All clients in room receive 'receive-message'
```

### Error Handling Pattern
```
Try-catch in routes
    ↓
Pass error to next(error)
    ↓
Global error middleware catches it
    ↓
Returns consistent JSON response
    ↓
Status code set appropriately
```

---

## 🔧 Common Tasks

### Add a New Route

1. Create controller function
2. Add to `routes/yourRoutes.js`
3. Mount in `server.js`

Example:
```javascript
// routes/yourRoutes.js
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // Your logic
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// server.js
app.use('/api/your', require('./routes/yourRoutes'));
```

### Add a New Model

1. Create `models/YourModel.js`
2. Define schema
3. Export mongoose model

### Add Socket.IO Event

1. Open `sockets/chatSocket.js`
2. Add `socket.on('event-name', handler)`
3. Use `socket.emit()` or `io.to().emit()` to send

---

## 📊 Database Collections

After running, your MongoDB will have:

```
chat-app/
├── users (with indexes on email)
├── conversations
├── messages
└── (system collections)
```

---

## 🔐 Security Features Already Included

✅ Password hashing with bcryptjs  
✅ JWT token authentication  
✅ Rate limiting on auth endpoints  
✅ CORS configured  
✅ Environment variables for secrets  
✅ Password excluded from JSON responses  

---

## 🎓 Next Features to Add

### Easy Level
- [ ] Update user avatar/profile
- [ ] Delete message
- [ ] Mark all messages as read
- [ ] Search conversations

### Medium Level
- [ ] Group conversations
- [ ] Add/remove group members
- [ ] Message reactions (emoji)
- [ ] Last seen timestamp

### Hard Level
- [ ] File/image uploads
- [ ] Message search
- [ ] User blocking
- [ ] End-to-end encryption concepts

---

## 📚 Learning Resources

- **Express.js** - `server.js` and `routes/`
- **MongoDB** - `models/` and `config/database.js`
- **JWT** - `config/jwt.js` and `middleware/authMiddleware.js`
- **Socket.IO** - `sockets/chatSocket.js`
- **Middleware** - `middleware/`
- **Error Handling** - `middleware/errorHandler.js`

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Set `NODE_ENV=production`
- [ ] Use a managed MongoDB service (Atlas, Compose, etc.)
- [ ] Add HTTPS/SSL certificate
- [ ] Set proper `CLIENT_URL`
- [ ] Add database backups
- [ ] Add logging and monitoring
- [ ] Rate limit in production
- [ ] Use environment-specific configs

---

## 📞 Questions to Ask Yourself

As you learn:

1. **Why use middleware?** - Reusable, cross-cutting concerns
2. **Why hash passwords?** - Never store plain text passwords
3. **Why JWT tokens?** - Stateless authentication, scalable
4. **Why Socket.IO?** - Real-time bidirectional communication
5. **Why separate routes?** - Clean organization, easy maintenance
6. **Why try-catch?** - Handle errors gracefully
7. **Why rate limiting?** - Prevent brute force attacks
8. **Why CORS?** - Control who can access your API

---

## 🎉 You're Ready!

This is a solid foundation. Start by:

1. Running the server
2. Testing the API with curl (see API_TESTING.md)
3. Reading through each file to understand the pattern
4. Modifying and adding new features
5. Building the frontend to connect to this backend

**Happy coding! 🚀**

---

**Need help?** Check the code comments and the ARCHITECTURE.md file for detailed explanations.
