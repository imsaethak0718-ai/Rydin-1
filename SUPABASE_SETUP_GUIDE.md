# Supabase Connection Setup Guide

## Error: "Failed to fetch"

This error means the app cannot connect to your Supabase database. Here's how to fix it:

## Step 1: Get Your Supabase Credentials

1. Go to **[supabase.com](https://supabase.com)** and log in
2. Select your **RideMate Connect** project
3. Click **Settings** → **API** (in the left sidebar)
4. Copy:
   - **Project URL** (starts with `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 2: Set Environment Variables

You have two options:

### Option A: Using Environment Variables (Recommended)

Create a `.env.local` file in the project root with:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Then restart the dev server** (the app will automatically pick these up).

### Option B: Update Hardcoded Credentials (Quick Fix)

Edit `src/integrations/supabase/client.ts`:

```typescript
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key-here";
```

## Step 3: Run Database Migrations

After setting credentials, you MUST run the SQL migration in Supabase:

1. Go to your Supabase Dashboard
2. Click **SQL Editor** → **New Query**
3. Paste the contents of `REALTIME_DATABASE_SETUP.sql`
4. Click **Run**

## Step 4: Verify Connection

Once complete, you should see:
- ✅ No "Failed to fetch" errors
- ✅ Rides appear on the home page
- ✅ Real-time updates work (try joining a ride)

## Troubleshooting

### Still getting "Failed to fetch"?

Check the browser console (F12) for detailed errors:

1. **"Missing Supabase environment variables"** → You skipped Step 2
2. **"Invalid credentials"** → Check your URL and anon key match exactly
3. **Network timeout** → Supabase project might be down or unreachable

### Database shows empty?

Run the migrations from `REALTIME_DATABASE_SETUP.sql` in the SQL Editor (Step 3).

### Real-time not working?

Ensure you ran all SQL migrations, especially:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE rides;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_members;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

## Next Steps

Once Supabase is connected:
1. Create test rides via the **Create Ride** button
2. Test joining rides to verify real-time updates
3. Test chat to verify message subscriptions
4. Check Profile section for user trust scores
