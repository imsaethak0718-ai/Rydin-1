# Rydin Implementation Roadmap

## PHASE 1: CRITICAL (Fix Now - Core Functionality)

### 1️⃣ Fix Ride Loading After Login ⚠️ CRITICAL BUG
**Status**: In Progress
**Impact**: High - Breaks user experience

**Problem**: Race condition between auth session and ride database query
- User logs in → redirected too fast → rides endpoint not ready → blank page

**Solution**:
- Wait for `onAuthStateChange` before running ride query
- Add loading skeleton/spinner
- Implement retry logic (3 attempts with exponential backoff)
- Timeout handling (force load after 5 seconds)

**Files to Modify**:
- `src/hooks/useRealtimeRides.ts` - Add auth state check
- `src/pages/Index.tsx` - Add loading state UI
- `src/contexts/AuthContext.tsx` - Ensure session is confirmed

---

### 2️⃣ Complete Ride Lock Logic 🔒
**Status**: Partially Implemented
**Impact**: High - Prevents overbooking

**Current State Flow**: OPEN → FULL → LOCKED → COMPLETED → CANCELLED

**What's Missing**:
- Auto-lock when all seats filled
- Manual lock by host (before ride starts)
- Disable "Join" button when locked
- Lock notification to all ride members
- Prevent edits after lock

**Implementation**:
- Add `locked_at` timestamp trigger
- RLS policy: prevent ride edits after locked
- UI: Show "LOCKED" badge
- Notification: Broadcast to ride members

**Files to Create/Modify**:
- `src/lib/rideLock.ts` - Lock state machine
- `src/components/RideCard.tsx` - Lock UI badge
- `src/hooks/useRealtimeRides.ts` - Listen for lock status
- SQL: Trigger for auto-lock on full seats

---

### 3️⃣ Implement Real Payment System 💳 REVENUE CRITICAL
**Status**: Not Started
**Impact**: CRITICAL - No revenue without payments

**Must Integrate**: Stripe

**Minimum Requirements**:
1. Stripe Checkout Session
2. Platform fee (3–5% per transaction)
3. Split payment logic (host gets 95%, platform gets 5%)
4. Escrow: Payment held until ride complete
5. Webhook: Listen for payment success
6. Refund policy rules

**Data Model**:
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  ride_id UUID REFERENCES rides(id),
  user_id UUID REFERENCES profiles(id),
  amount DECIMAL,
  platform_fee DECIMAL,
  stripe_payment_intent_id TEXT,
  status TEXT ('pending', 'completed', 'refunded'),
  created_at TIMESTAMP
);
```

**Workflow**:
1. User joins ride → Enter payment
2. Stripe checkout session created
3. Payment processed → Marked as 'pending'
4. Ride completes → Payment marked 'completed'
5. Host can request refund (time-limited)

**Files to Create**:
- `src/pages/PaymentCheckout.tsx`
- `src/lib/stripe.ts` - Stripe integration
- `src/lib/paymentHandling.ts` - Payment logic
- `backend/migrations/PAYMENTS_TABLE.sql`

---

### 4️⃣ Enable College Email + Verification 🎓
**Status**: Not Started
**Impact**: Medium - Trust & legitimacy

**Implementation**:
1. Force `.edu` email domains at signup (configurable)
2. Email verification required before profile complete
3. Optional: Upload college ID for "Verified Student" badge
4. Display badge on profile

**Config**:
- Allowed domains: `*.edu`, institution-specific domains
- Verification email sent on signup
- 24-hour expiration for verification link

**Files to Modify**:
- `src/pages/Auth.tsx` - Validate email domain
- `src/pages/ProfileSetup.tsx` - Add college ID upload
- `src/integrations/supabase/client.ts` - Add email verification

---

### 5️⃣ Add Proper Error Logging 📊
**Status**: Not Started
**Impact**: Medium - Production visibility

**Tools**: Sentry (free tier covers basics)

**What to Track**:
- Auth failures
- Database query errors
- Payment processing errors
- Real-time subscription errors
- Network timeouts

**Files to Create**:
- `src/lib/errorLogging.ts` - Sentry setup
- Environment variables: `VITE_SENTRY_DSN`

---

### 6️⃣ RLS Security Stress Test 🔐
**Status**: Not Started
**Impact**: High - Data security

**Test Scenarios**:
| User Type | Should Access | Should NOT Access |
|-----------|---------------|-------------------|
| Host | Own rides, edit, delete | Other's rides |
| Passenger | Own memberships | Other's payments |
| Stranger | View open rides | Edit any ride |
| Logged Out | Nothing (redirect) | Anything |

**Test Methods**:
- Unit tests with `supabase-js`
- Manual testing as different roles
- Check messages scope (only ride members)

---

## PHASE 2: TRUST & RETENTION (After Phase 1 Stable)

### 7️⃣ Rating & Review System ⭐
- Post-ride mandatory 1-5 star rating
- Written review (optional)
- Auto-update `trust_score` in profiles
- Penalize no-shows (-1 star, visible flag)
- Trust score formula: (sum of ratings) / (number of rides)

### 8️⃣ Seat Reservation Timer ⏱️
- User clicks "Join" → Seat reserved for 5 minutes
- Show countdown timer
- If payment not completed by 5 min → Auto-cancel reservation
- Prevent fake bookings

### 9️⃣ Ride Reminder Notifications 🔔
- 30 min before ride: "Reminder: Ride starting soon"
- 10 min before ride: "Host is starting, be ready"
- Send via email + push notification
- Include pickup location, driver contact

### 🔟 Ride QR Code Confirmation 📱
- Generate QR code for each ride
- Host scans QR at pickup to mark passenger present
- Reduces no-show fraud
- Data: QR → ride_id + user_id

### 1️⃣1️⃣ Analytics Tracking 📈
**Tool**: PostHog or Mixpanel (free tier)

**Metrics to Track**:
- Rides created per day
- Join conversion rate (views → joins)
- Cancellation rate
- Seat fill rate (avg seats filled / total)
- Revenue per ride
- User retention (30-day cohort)

---

## PHASE 3: SCALE (After 100+ Real Rides)

### 1️⃣2️⃣ Referral System 🎁
- Give ₹50 credit per successful referral
- Unique invite link per user
- Track referral source in DB
- Leaderboard of top referrers

### 1️⃣3️⃣ Leaderboards & Badges 🏆
- "Top Reliable Rider" (highest rating)
- "10 Rides Club" badge
- "Event Champion" (most events attended)
- Gamifies trust & retention

### 1️⃣4️⃣ Event Auto Ride Rooms 🎪
- For campus events: Auto-generate ride groups
- Lock pricing for event
- Sponsor branding/logos
- Built-in event registration

### 1️⃣5️⃣ Admin Dashboard 👨‍💼
**Critical Features**:
- Ride moderation (review reported rides)
- User management (ban suspicious users)
- Refund trigger (manual override)
- Revenue dashboard
- Issue reporting system (user complaints)

---

## Implementation Priority Matrix

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| 1. Fix Ride Loading | 🔴 Critical | 🟢 Low | **P0** |
| 2. Ride Lock Logic | 🔴 Critical | 🟡 Medium | **P0** |
| 3. Stripe Payments | 🔴 Critical | 🔴 High | **P0** |
| 4. College Email | 🟡 High | 🟢 Low | **P1** |
| 5. Error Logging | 🟡 High | 🟢 Low | **P1** |
| 6. RLS Testing | 🔴 Critical | 🟡 Medium | **P0** |
| 7. Rating System | 🟡 High | 🟡 Medium | **P2** |
| 8. Seat Timer | 🟢 Medium | 🟢 Low | **P2** |
| 9. Notifications | 🟡 High | 🔴 High | **P2** |
| 10. QR Codes | 🟢 Medium | 🟡 Medium | **P2** |
| 11. Analytics | 🟡 High | 🟢 Low | **P2** |
| 12-15. Phase 3 | 🟢 Medium | 🟢 Low | **P3** |

---

## Current Setup Status

✅ Database schema (all tables created)
✅ Supabase auth (email/password)
✅ Real-time subscriptions
✅ Frontend structure (React + Vite)
✅ RLS policies (basic)
❌ Payment system (NOT INTEGRATED)
❌ Error logging (NOT INTEGRATED)
❌ Email verification (NOT ENABLED)
❌ Analytics (NOT INTEGRATED)

---

## Next Actions

1. **This Week**: Tackle Phase 1 items
2. **Get Stripe account**: https://stripe.com
3. **Get Sentry account**: https://sentry.io (free tier)
4. **Set up college email validation**
5. **Test RLS policies thoroughly**

---

**Document Version**: 1.0
**Last Updated**: February 2026
**Owner**: Prithish Mishra
