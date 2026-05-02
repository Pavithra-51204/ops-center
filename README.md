# Ops-Center — Enterprise War-Room Platform

## Architecture Overview

```
ops-center/
├── client/                          # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── auth/                # Login, Register forms
│       │   ├── layout/              # Sidebar, AppShell, TopBar
│       │   ├── rooms/               # WarRoom, RoomCard, Chat, ActionTracker
│       │   └── shared/              # Badge, Avatar, Button, Modal
│       ├── pages/                   # Dashboard, Lobby, RoomView, Profile
│       ├── hooks/                   # useAuth, useSocket, useRoom
│       ├── context/                 # AuthContext, SocketContext
│       └── lib/                     # api.js (axios), socket.js
│
└── server/                          # Node.js + Express
    ├── config/
    │   ├── db.js                    # MongoDB connection
    │   └── redis.js                 # Redis client
    ├── controllers/
    │   ├── authController.js        # register, login, logout, me
    │   ├── roomController.js        # CRUD for war rooms
    │   └── messageController.js     # Chat history
    ├── middleware/
    │   ├── auth.js                  # JWT verify middleware
    │   └── errorHandler.js
    ├── models/
    │   ├── User.js
    │   ├── Room.js
    │   └── Message.js
    ├── routes/
    │   ├── auth.js
    │   ├── rooms.js
    │   └── messages.js
    ├── lib/
    │   └── socketHandler.js         # Socket.io + Redis pub/sub
    └── index.js                     # Express entry point
```

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Socket.io-client, Axios, Lucide-React
- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB (Mongoose)
- **Cache/PubSub**: Redis (ioredis)
- **Auth**: JWT + HTTP-only cookies

## Quick Start

### Server
```bash
cd server
npm install
cp .env.example .env   # fill in MONGO_URI, REDIS_URL, JWT_SECRET
node index.js
```

### Client
```bash
cd client
npm install
npm run dev
```

## Environment Variables (server/.env)
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/ops-center
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```
