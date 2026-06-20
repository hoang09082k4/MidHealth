# Vercel Environment Setup

MidHealth backend on Vercel must have the same backend environment variables as `backend/.env`.
The local `.env` file is intentionally ignored by git, so Vercel will not receive these values unless they are added in the Vercel dashboard.

## Required For Real Admin And Provider Login

Add these variables in Vercel Project Settings -> Environment Variables for Production, Preview, and Development as needed:

```text
FIREBASE_API_KEY
FIREBASE_PROJECT_ID
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
GMAIL_USER
GMAIL_APP_PASSWORD
FRONTEND_URL
ALLOWED_ORIGINS
```

`SUPABASE_SERVICE_ROLE_KEY` must be the Supabase service role key, not the anon key. Keep it server-side only.

Recommended values:

```text
FRONTEND_URL=https://midhealth.vercel.app
ALLOWED_ORIGINS=https://midhealth.vercel.app,http://localhost:5173,http://127.0.0.1:5173
```

After saving environment variables, redeploy the latest commit.

## Verify

Open:

```text
https://midhealth.vercel.app/api/health
```

The response should show:

```json
{
  "supabase": "connected",
  "missingConfig": []
}
```

If `missingConfig` contains `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`, admin and provider login cannot work with real data on Vercel.

## Seed Required Accounts

After Supabase is configured, run these locally or from a trusted environment:

```bash
npm run seed:admin --prefix backend
npm run seed:provider-test --prefix backend
```

The backend also auto-ensures these demo portal accounts when they log in:

```text
admin@gmail.com -> admin
hoang_2251220149@dau.edu.vn -> doctor
```
