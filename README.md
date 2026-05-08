# 🗨️ RealChat — Real-time Business Chat System

A production-ready real-time chat system built with **Node.js · Express · MongoDB · Redis · Passport.js · Socket.IO** following strict MVC architecture.

---

## 📁 Folder Structure

```
realtime-chat/
├── server.js              # Entry point — creates HTTP server, mounts Socket.IO
├── app.js                 # Express app — middleware, routes, session, Passport
├── .env                   # Environment variables (never commit)
├── .env.example           # Template
│
├── config/
│   ├── database.js        # MongoDB connection (Mongoose)
│   ├── redis.js           # ioredis client with auto-reconnect
│   └── passport.js        # Passport Local Strategy + serialize/deserialize
│
├── models/
│   ├── Business.js        # Business schema (name, email, hashed password)
│   ├── User.js            # User schema (name, email, password, business ref)
│   └── Message.js         # Message schema (sender, receiver, business, content)
│
├── controllers/
│   ├── businessController.js  # register, login, getById
│   ├── userController.js      # register, login, logout, me, listByBusiness
│   └── chatController.js      # getConversation (Redis→DB), sendMessage
│
├── routes/
│   ├── businessRoutes.js  # POST /register, POST /login, GET /:id
│   ├── userRoutes.js      # POST /register, POST /login, POST /logout, GET /me, GET /
│   └── chatRoutes.js      # GET /:receiverId, POST /send
│
├── services/
│   ├── redisService.js    # Online users (Sets) + message cache (Lists)
│   └── socketService.js   # Socket.IO init, auth middleware, event handlers
│
├── middlewares/
│   ├── auth.js            # isAuthenticated guard
│   ├── errorHandler.js    # Global error handler
│   └── requestLogger.js   # Dev request logger
│
├── utils/
│   └── AppError.js        # Operational error class
│
└── public/
    ├── index.html         # Demo chat UI
    ├── css/style.css
    └── js/client.js       # Socket.IO + fetch client
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally (or Atlas URI)
- Redis running locally

### Installation

```bash
# Clone / unzip the project
cd realtime-chat
npm install

# Copy env template and fill in values
cp .env.example .env

# Start development server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 🔑 Authentication Design Decision: Sessions vs JWT

**This system uses server-side sessions backed by Redis.** Here's why:

| | Sessions (chosen) | JWT |
|---|---|---|
| Invalidation | Instant — delete Redis key | Hard — requires a deny-list |
| Server state | Required (Redis) | Stateless |
| Horizontal scale | Redis = shared state across nodes ✅ | Any node can verify ✅ |
| Complexity | Lower for web apps | Higher (refresh tokens, rotation) |
| Security | HttpOnly cookie, not accessible to JS | Token stored in JS memory or localStorage |

For a business chat SaaS (same-origin web app), sessions win on simplicity and instant logout. JWT is better for mobile-first APIs or microservices.

---

## 🔌 Socket.IO Integration

```
server.js
  └─ http.createServer(app)          ← Express app wrapped in Node HTTP server
       └─ initSocket(httpServer)     ← Socket.IO attaches to same port
            ├─ sessionMiddleware     ← shares Express session
            ├─ passport.initialize() ← hydrates req.user from session
            └─ auth guard            ← rejects unauthenticated sockets

Connection flow:
  Client connects
    → joins user:{userId}       (private room for DMs)
    → joins business:{bizId}    (broadcast room for online list)
    → addOnlineUser() in Redis
    → broadcast "online_users" to business room

Message flow:
  Client emits "send_message" { receiverId, content }
    → Validate payload
    → Message.create() → MongoDB  (source of truth)
    → appendMessageToCache()     → Redis  (fast reads)
    → io.to("user:{receiverId}").emit("new_message", msg)
    → socket.emit("message_sent", msg)  ← echo to sender
```

---

## 🧠 Redis Caching Flow

```
GET /api/chat/:receiverId
  │
  ├─ getCachedMessages(id1, id2)
  │     Redis key: conv:{smallerId}:{largerId}   ← canonical, order-independent
  │     Structure: Redis List (RPUSH / LRANGE)
  │
  ├─ Cache HIT ──→ return last N messages instantly ⚡
  │
  └─ Cache MISS
        ├─ Query MongoDB (sort: createdAt desc, limit N)
        ├─ cacheMessages() → RPUSH all messages, EXPIRE key
        └─ return messages

On every new message (Socket.IO send_message):
  appendMessageToCache()
    → RPUSH new message JSON
    → LTRIM to keep last MAX_CACHED (default 20)
    → EXPIRE refresh TTL (keeps active convos in cache)

Online users:
  Redis SET per business: online:{businessId}
    SADD on connect
    SREM on disconnect / logout
    SMEMBERS for contact list enrichment
```

---

## 📡 REST API Reference

### Business
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/business/register` | `{ name, email, password }` | ❌ |
| POST | `/api/business/login` | `{ email, password }` | ❌ |
| GET | `/api/business/:id` | — | ❌ |

### Users
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/users/register` | `{ name, email, password, businessId }` | ❌ |
| POST | `/api/users/login` | `{ email, password, businessId }` | ❌ |
| POST | `/api/users/logout` | — | ✅ |
| GET | `/api/users/me` | — | ✅ |
| GET | `/api/users` | — | ✅ |

### Chat
| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| GET | `/api/chat/:receiverId` | — | ✅ |
| POST | `/api/chat/send` | `{ receiverId, content }` | ✅ |

### Socket.IO Events
| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | `send_message` | `{ receiverId, content }` |
| Client → Server | `typing_start` | `{ receiverId }` |
| Client → Server | `typing_stop` | `{ receiverId }` |
| Server → Client | `new_message` | Full message object |
| Server → Client | `message_sent` | Full message object (echo) |
| Server → Client | `online_users` | `[userId, ...]` |
| Server → Client | `user_offline` | `{ userId }` |
| Server → Client | `user_typing` | `{ userId, name }` |
| Server → Client | `user_stopped_typing` | `{ userId }` |

---

## 🗄️ MongoDB Schemas

### Business
```js
{ name, email, password (hashed), isActive, timestamps }
```

### User
```js
{ name, email, password (hashed), business: ObjectId, isActive, timestamps }
// Unique index: { email, business } — same email allowed across different businesses
```

### Message
```js
{ sender: ObjectId, receiver: ObjectId, business: ObjectId, content, isRead, timestamps }
// Compound index: { sender, receiver, createdAt } for fast conversation queries
```
