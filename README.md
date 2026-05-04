# Astra Living Voice Agent – Deployment Guide

## What this does
When someone calls your Twilio number, this server bridges the call to Grok's AI voice agent (your leasing assistant).

## Deploy to Railway (5 minutes, free)

### Step 1 – Create Railway account
Go to railway.app and sign up with GitHub (free, no credit card needed).

### Step 2 – Deploy this project
1. In Railway, click "New Project"
2. Choose "Deploy from GitHub repo" OR "Empty project" → then drag and drop this folder
3. Railway will detect it's a Node.js app and deploy automatically

### Step 3 – Add your environment variable
In Railway, go to your project → Variables → Add:
```
XAI_API_KEY = your_xai_api_key_here
```
Get your xAI API key from: console.x.ai → API Keys → Create

### Step 4 – Get your Railway URL
Once deployed, Railway gives you a URL like:
`https://astra-bridge-production.up.railway.app`

### Step 5 – Configure Twilio
1. Go to your Twilio console → Phone Numbers → Active Numbers → click your number
2. Under "Voice Configuration" → "A call comes in" → Webhook
3. Paste your Railway URL + /incoming:
   `https://astra-bridge-production.up.railway.app/incoming`
4. Make sure HTTP method is set to HTTP POST
5. Click Save

### Step 6 – Test it
Call your Twilio number. The Grok leasing agent will answer!

## Troubleshooting
- If the call connects but there's no audio, check your XAI_API_KEY is correct in Railway
- Railway logs are visible in the dashboard under "Deployments" → click the deployment → Logs
- Make sure your Twilio number has the /incoming URL saved correctly
