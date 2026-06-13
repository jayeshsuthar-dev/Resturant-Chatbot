# Restaurant AI Chatbot — Vercel + Gemini (Free)
Built by Jayesh | Zero cost to demo | Reusable for any restaurant

---

## Project Structure

```
restaurant-chatbot/
├── api/
│   └── chat.js       ← Backend (keeps API key secret, calls Gemini)
├── index.html        ← Frontend chatbot UI
├── vercel.json       ← Vercel routing config
└── README.md
```

---

## STEP 1 — Get your FREE Gemini API Key (5 mins)

1. Go to → https://aistudio.google.com
2. Sign in with your Google account
3. Click "Get API Key" (top left)
4. Click "Create API Key"
5. Copy it — looks like: AIzaSyXXXXXXXXXXXXXXXXX
6. Save it somewhere safe

Free tier: 10 requests/min, 500 requests/day — enough for demos.

---

## STEP 2 — Upload to GitHub (10 mins)

1. Go to https://github.com → Sign up / Log in
2. Click "+" → "New repository"
3. Name: restaurant-chatbot
4. Click "Create repository"
5. Upload these 4 files:
   - api/chat.js
   - index.html
   - vercel.json
   - README.md
   NOTE: Create the "api" folder first, then upload chat.js inside it

---

## STEP 3 — Deploy on Vercel (10 mins)

1. Go to https://vercel.com → Sign up with GitHub
2. Click "Add New Project"
3. Click "Import" next to your restaurant-chatbot repo
4. Leave all settings as default
5. Click "Deploy"
6. Wait ~1 minute → your site is LIVE

---

## STEP 4 — Add your Gemini API Key to Vercel (5 mins)

⚠️ MOST IMPORTANT STEP — do not skip this

1. In Vercel → click your project
2. Go to "Settings" tab (top menu)
3. Click "Environment Variables" (left sidebar)
4. Fill in:
   Name:  GEMINI_API_KEY
   Value: AIzaSyXXXXXXXXXX  (paste your key here)
5. Click "Save"
6. Go to "Deployments" tab → click the 3 dots → "Redeploy"

---

## STEP 5 — Your live URL

After redeployment you get a URL like:
https://restaurant-chatbot-yourname.vercel.app

Share this with your client for demo!

---

## Customize for a new restaurant client (10 mins)

Open index.html and change only these 3 things:

### 1. Brand color (~line 14)
--brand-color: #3B6D11;   ← change hex color

### 2. Restaurant name + emoji (~line 100)
<p class="header-name">Classic Pure Veg</p>

### 3. System prompt (~line 140)
const SYSTEM_PROMPT = `You are a friendly assistant for [RESTAURANT NAME]...`
Paste all info from your IRL checklist here.

Push to GitHub → Vercel auto-redeploys in 30 seconds. Done.

---

## Embed on client's existing website

<iframe
  src="https://your-chatbot.vercel.app"
  style="width:420px; height:680px; border:none; border-radius:16px; box-shadow:0 4px 20px rgba(0,0,0,0.1);"
></iframe>

---

## Your pricing model

Setup fee:      ₹3,000 one time
Monthly:        ₹1,500/month (you update menu, monitor uptime)
Your API cost:  FREE (Gemini free tier, upgrade only when needed)
Your profit:    ₹1,500/month per client

10 clients = ₹15,000/month passive alongside your job.
