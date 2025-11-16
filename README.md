# Cricket Discord Bot (Vercel)


This template posts real-time India match updates (C-style detailed) to a Discord webhook.


## Setup
1. Create a new GitHub repo and push this template.
2. Deploy to Vercel (Import Git Repository).
3. Set Environment Variable in Vercel Project Settings:
- `WEBHOOK` = your Discord webhook URL


## Vercel Cron
Use Vercel Cron Jobs to poll the function frequently (every 15s recommended but Vercel limits may apply).
Create Cron Job on Vercel: `/api/score` with schedule `*/15 * * * * *` (if supported) or `*/30 * * * * *`.


> **Note:** Vercel's UI may restrict minimum frequency. If you need <1min polling, consider a paid plan or an external scheduler.


## Production-grade notes
- This template uses an ephemeral file cache (`/tmp/cache.json`). For robust multi-instance consistency use a persistent store like Redis, Upstash KV, or Vercel KV.
- The data source is an **unofficial** Cricbuzz mobile endpoint. It is free but not guaranteed. For commercial/critical usage, use an official paid API.


## What it sends
- Score updates (C-style with batsmen & current bowler)
- Wicket alerts
- Boundary alerts
- Partnership milestones (every 10 runs)
- Status updates


## License
MIT