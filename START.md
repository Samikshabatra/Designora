# Designora — Quick Start Guide

## Step 1 — Setup API Keys
In the `backend` folder:
- Rename `.env.local.template` to `.env.local`
- Fill in your REPLICATE_API_TOKEN (from replicate.com)
- JWT_SECRET is pre-filled (change if you want)

## Step 2 — Install & Start Backend (Terminal 1)
```
cd backend
npm install
node server.js
```
Wait for: ✅ Tables ready

## Step 3 — Install & Start Frontend (Terminal 2)  
```
npm install
npm run dev
```

## Step 4 — Open in Browser
http://localhost:3000

## ⚠️ IMPORTANT
- Always start BACKEND first, then FRONTEND
- Backend runs on port 3001 (API only — don't open in browser)
- Frontend runs on port 3000 (open this in browser)
- Never run both in the same terminal
