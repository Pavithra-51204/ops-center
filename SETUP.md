# Ops-Center — Setup Guide

## Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`)
- Redis running locally (`redis-server`)

---

## Step 1 — Environment
```bash
cd ops-center/server
cp .env.example .env
# Edit .env and set a real JWT_SECRET value
```

## Step 2 — Install dependencies
```bash
# Server
cd ops-center/server
npm install

# Client (in a new terminal)
cd ops-center/client
npm install
```

## Step 3 — Start the server
```bash
cd ops-center/server
node index.js
# You should see:
# ✅ MongoDB connected: localhost
# ✅ Redis connected
# 🚀 Ops-Center server running on port 5000
```

## Step 4 — Start the client
```bash
cd ops-center/client
npm run dev
# Open http://localhost:5173  (or 5174 if 5173 is busy)
```

---

## Troubleshooting blank/white screen

1. **Open browser DevTools** (F12) → Console tab — look for red errors
2. **Common errors and fixes:**

| Error | Fix |
|---|---|
| `Cannot find module 'date-fns'` | Run `npm install` in `client/` |
| `Cannot find module 'socket.io-client'` | Run `npm install` in `client/` |
| `axios network error` | Make sure server is running on port 5000 |
| `CORS error` | Check `CLIENT_URL` in server `.env` matches your Vite port |
| `401 redirect loop` | Clear cookies: DevTools → Application → Cookies → Clear all |

3. **Hard reset:**
```bash
# In client/
rm -rf node_modules
npm install
npm run dev
```

4. **MongoDB not connecting:**
```bash
# macOS
brew services start mongodb-community
# Linux
sudo systemctl start mongod
```

5. **Redis not connecting:**
```bash
# macOS
brew services start redis
# Linux
sudo systemctl start redis
```

---

## Quick check — is everything working?
```
http://localhost:5000/api/health
```
Should return: `{"status":"ok","timestamp":"..."}`
