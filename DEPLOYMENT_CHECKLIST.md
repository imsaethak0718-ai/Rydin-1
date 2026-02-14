# RYDIN - DEPLOYMENT & SETUP CHECKLIST

## 🎯 WHAT YOU NEED TO DO

Everything is built and ready. Follow this checklist to get live.

---

## STEP 1: SUPABASE DATABASE SETUP (Required)

### 1.1 Run SQL Migrations

Go to: **Supabase Dashboard → Your Project → SQL Editor**

#### Migration 1: Ride Lock Logic (5 min)
1. Click **"New Query"**
2. Copy entire content from: `backend/migrations/RIDE_LOCK_LOGIC.sql`
3. Paste into SQL Editor
4. Click **"Run"**
5. ✅ Should see: "✅ Ride lock logic implemented successfully"

#### Migration 2: Cost Splitting (5 min)
1. Click **"New Query"**
2. Copy entire content from: `backend/migrations/RIDE_COST_SPLITTING.sql`
3. Paste into SQL Editor
4. Click **"Run"**
5. ✅ Should see: "✅ Ride cost splitting database setup complete!"

### 1.2 Verify Tables Created

Go to: **Supabase → Database → Tables**

You should now see:
- ✅ `id_verifications`
- ✅ `ride_links`
- ✅ `cost_splits`
- ✅ `split_members`
- ✅ `settlements`

### 1.3 Enable Real-time (Already done by SQL)

Go to: **Supabase → Database → Replication**

Verify these tables have replication enabled:
- ✅ `cost_splits`
- ✅ `split_members`
- ✅ `settlements`
- ✅ `rides` (should already be enabled)

### 1.4 Setup Storage Buckets (for ID Images)

Go to: **Supabase → Storage**

Create a new bucket:
1. Click **"Create a new bucket"**
2. Name: `id-verifications`
3. Make it **Private** (not public)
4. Click **"Create bucket"**

---

## STEP 2: ENVIRONMENT VARIABLES

### 2.1 Add to `.env` file (Already has these):
```
VITE_SUPABASE_URL=https://ylyxhdlncslvqdkhzohs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_6u9ljp3UeIi2YMQTh1Js2w_u3QHepXn
```

### 2.2 (Optional) Add Analytics Keys

If you want analytics:
```
VITE_POSTHOG_KEY=phc_your_key_here
VITE_SENTRY_DSN=https://your_dsn@sentry.io/project_id
```

**Note**: Analytics are optional. App works without them.

---

## STEP 3: UPDATE NAVIGATION (5 min)

Edit: `src/components/BottomNav.tsx`

Add these new nav links:

```tsx
// Add these imports at top
import { Share2, DollarSign } from "lucide-react";

// Add these in the NavLink list (inside your navigation):
<NavLink to="/create-split" icon={Share2} label="Split" />
<NavLink to="/settlement" icon={DollarSign} label="Pay" />
<NavLink to="/admin" icon={BarChart3} label="Admin" />
```

---

## STEP 4: DATABASE RLS POLICIES (Already Applied!)

The SQL migrations already set up all RLS policies. No action needed.

**Verify policies exist**:
1. Go to: **Supabase → Database → Policies**
2. Filter by table: `cost_splits`
3. You should see multiple policies ✅

---

## STEP 5: NPM INSTALL & BUILD

Run in your terminal:

```bash
# Install any new dependencies
npm install

# Build the project
npm run build

# Start dev server
npm run dev
```

**Expected**: Should start on `http://localhost:8080`

---

## STEP 6: TEST LOCALLY (30 min)

### Test 6.1: Create a Split
1. Login to app
2. Go to **"Split"** tab (bottom nav)
3. Paste this sample link:
   ```
   https://uber.com/request?pickup_latitude=13.0827&pickup_longitude=80.2707&dropoff_latitude=13.1939&dropoff_longitude=80.2738
   ```
4. Click **"Parse Ride Details"**
5. ✅ Should extract: SRM → Downtown, ₹500

### Test 6.2: Create Split & Share
1. Select **4 people** in the split
2. Click **"Create Split"**
3. ✅ Should generate shareable link
4. Copy link

### Test 6.3: Join Split (Different User)
1. Open link in **different browser or incognito**
2. Login with **different account**
3. Click **"Join Split"**
4. ✅ Should show "You joined this split"

### Test 6.4: Settlement
1. Go to **"Pay"** tab (bottom nav)
2. ✅ Should see splits you owe
3. Click **"Mark as Paid"**
4. Select payment method (UPI/Cash)
5. ✅ Should mark as settled

---

## STEP 7: DEPLOY TO PRODUCTION

Choose your hosting:

### Option A: Vercel (Recommended for Next.js)
```bash
npm install -g vercel
vercel
```
Follow prompts.

### Option B: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Option C: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

### Option D: AWS/Railway/Render
Use their respective CLI tools.

---

## STEP 8: POST-DEPLOYMENT CHECKLIST

After deploying:

- [ ] Test app on production URL
- [ ] Test creating a split
- [ ] Test joining a split (different user)
- [ ] Test settlement flow
- [ ] Verify Supabase queries work
- [ ] Check browser console for errors
- [ ] Test on mobile device
- [ ] Verify real-time updates work

---

## OPTIONAL: ADVANCED SETUP

### A. Email Notifications (Optional)

If you want email reminders, setup:
1. **SendGrid** or **Mailgun**
2. Add API key to backend
3. Uncomment email code in `src/lib/notifications.ts`

### B. Push Notifications (Optional)

Setup **Firebase Cloud Messaging**:
1. Create Firebase project
2. Generate FCM key
3. Add to backend
4. Users can opt-in for notifications

### C. Analytics (Optional)

Setup **PostHog** or **Mixpanel**:
1. Create account
2. Get API key
3. Add to `.env`: `VITE_POSTHOG_KEY=...`
4. Analytics will auto-track

### D. Error Tracking (Optional)

Setup **Sentry**:
1. Create account
2. Create project for your app
3. Get DSN
4. Add to `.env`: `VITE_SENTRY_DSN=...`
5. Errors auto-tracked

### E. ID Verification with Google Vision API (Optional)

For better OCR:
1. Create **Google Cloud Project**
2. Enable **Vision API**
3. Create service account
4. Add to backend
5. Update `src/lib/idScanner.ts` to use Vision API

---

## TROUBLESHOOTING

### Issue: "Split not found"
**Fix**: Make sure SQL migrations ran successfully

### Issue: "Cannot create split"
**Fix**: Check Supabase tables exist, RLS policies allow inserts

### Issue: "Real-time not updating"
**Fix**: Go to Supabase → Database → Replication, enable for tables

### Issue: "Storage bucket error"
**Fix**: Create `id-verifications` bucket in Supabase Storage

### Issue: "Rides not loading"
**Fix**: Run the existing `FIX_FOREIGN_KEY_RELATIONSHIP.sql` migration

---

## FINAL VERIFICATION CHECKLIST

- [ ] SQL migrations executed (RIDE_LOCK_LOGIC.sql + RIDE_COST_SPLITTING.sql)
- [ ] Storage bucket created (id-verifications)
- [ ] All 5 tables visible in Supabase
- [ ] RLS policies visible
- [ ] Real-time enabled for 3 tables
- [ ] BottomNav updated with new routes
- [ ] npm install ran successfully
- [ ] npm run dev works
- [ ] Can create split locally
- [ ] Can join split (different user)
- [ ] Can settle payment
- [ ] App deployed to production
- [ ] Production URL works
- [ ] Real-time works in production

---

## ESTIMATED TIMELINE

| Task | Time |
|------|------|
| Run SQL migrations | 10 min |
| Create storage bucket | 5 min |
| Update BottomNav | 5 min |
| npm install + test | 10 min |
| Deploy to production | 15 min |
| **TOTAL** | **45 min** |

---

## 🚀 YOU'RE READY!

Once you complete this checklist, **RYDIN is LIVE**.

---

## ADDITIONAL RESOURCES

- **Supabase Docs**: https://supabase.com/docs
- **React Router**: https://reactrouter.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **Vite**: https://vitejs.dev/

---

## SUPPORT

If you encounter issues:

1. **Check Supabase Dashboard** for error logs
2. **Check browser console** (F12) for JavaScript errors
3. **Check network tab** for failed API calls
4. **Read error messages carefully** - they often explain the fix

---

**Status**: Ready for deployment
**All features**: Implemented
**Tests**: Manual testing recommended
**Time to launch**: ~1 hour from now

**GO LIVE! 🚀**

