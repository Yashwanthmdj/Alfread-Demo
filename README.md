# Alfred Mini — Finance Assistant

A small full-stack demo of an AI-powered accounts receivable assistant. Alfred reviews overdue invoices, assigns a priority, and drafts a polite reminder email. **Nothing is sent automatically** — a person must click **Approve & Send**. This is a human-in-the-loop AI assistant prototype, inspired by Alfred AI’s approach to automating finance workflows with human approval before any action is taken.

## How to run locally

You need two terminals, Python 3.9+, and Node.js 18+.

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Then:

```bash
uvicorn main:app --reload
```

API: [http://localhost:8000](http://localhost:8000)

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Deploy: Railway (backend) + Vercel (frontend)

This repo is a monorepo. Railway serves `backend/`. Vercel serves `frontend/`.

### A. Railway — FastAPI

1. Go to [railway.app](https://railway.app) and create a new project from this GitHub repo.
2. Optional: set **Root Directory** to `backend`. The repo also includes a root `Procfile` so Railway can build from the monorepo root.
3. Railway will detect Python and run:

   `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. In **Variables**, add:

   ```
   NVIDIA_API_KEY=nvapi-your-key
   NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
   ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   ```

5. Generate a public domain (**Settings → Networking → Generate Domain**).
   Copy it, for example `https://alfred-mini-backend.up.railway.app`.
6. Confirm it works: open `/` and `/invoices` on that URL.

### B. Vercel — Next.js

1. Go to [vercel.com](https://vercel.com) and import the same GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Framework: **Next.js**.
4. In **Environment Variables**, add:

   ```
   NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app
   ```

   Use the Railway URL from step A. No trailing slash.
5. Deploy. After the first Vercel URL exists, go back to Railway and set `ALLOWED_ORIGINS` to that `https://….vercel.app` URL, then redeploy the backend if needed.

Vercel preview URLs (`*.vercel.app`) are already allowed by CORS.

### After both are live

Open the Vercel URL. The dashboard talks to Railway. Approvals are stored on the Railway container disk and reset when that service is redeployed.

## What you can do

1. See overdue invoices ranked by priority (red = High, yellow = Medium, green = Low).
2. Open an invoice to read Alfred’s reason and edit the drafted email.
3. Click **Approve & Send**. The invoice is marked **Approved** with a timestamp. No email is actually sent.

## Project layout

```
backend/     FastAPI + LangChain (NVIDIA NIM) + invoices.json
frontend/    Next.js App Router + Tailwind CSS
```
