# PHASE 1 TESTING GUIDE
## Ride Loading & Ride Lock Logic

---

## PRE-TESTING CHECKLIST

Before testing, ensure:
- [ ] Code changes are committed to git
- [ ] `npm install` has been run (for skeleton component)
- [ ] Dev server is running: `npm run dev`
- [ ] Supabase project is accessible
- [ ] You have 2 test accounts ready (Host + Passenger)

**Stripe Payments SQL Migration NOT REQUIRED for this test**

---

## TEST 1: Ride Loading After Login (Auth Session Fix)

### Scenario A: Fresh Login - Smooth Loading
**Objective**: Verify auth session is confirmed before loading rides

**Steps**:
1. Open app in incognito/private window
2. Go to `/auth` page
3. Login with test account
4. **OBSERVE**: Should see loading skeleton (5 placeholder cards)
5. **WAIT**: 2-3 seconds
6. **VERIFY**: Real rides appear with smooth fade-in animation
7. Open DevTools → Console → Should see logs:
   ```
   ⏳ Waiting for auth session to be established...
   ✅ Fallback profile set immediately to unblock loading
   Starting fetch with filters: { status: ['open', 'full', 'locked'] }
   ```

**Expected Result**: ✅ PASS
- Loading skeleton shows immediately
- Rides appear without blank screen
- No "Unauthorized" or 403 errors

**If FAIL**:
- Check network tab (should see 200 responses)
- Run `debugSupabase()` in console
- Verify Supabase tables exist: `rides`, `profiles`

---

### Scenario B: Network Retry Logic
**Objective**: Verify retry mechanism works on network failures

**Steps**:
1. Open DevTools → Network tab
2. Set network throttle to "Offline"
3. Login and navigate to home
4. **OBSERVE**: Should attempt to load, fail gracefully
5. Set throttle to "Fast 3G"
6. **OBSERVE**: Should auto-retry after 1 second
7. **WAIT**: Up to 3 retries possible (1s, 2s, 3s intervals)
8. Check console for retry logs:
   ```
   Network error, retrying (1/3)...
   Network error, retrying (2/3)...
   Network error, retrying (3/3)...
   ```

**Expected Result**: ✅ PASS
- App doesn't hang on network failure
- Shows clear error message
- Encourages user to check connection

**If FAIL**:
- Check internet connection
- Verify Supabase URL in `.env`
- Check firewall/VPN blocking

---

### Scenario C: Session Persistence
**Objective**: Verify rides load on refresh with saved session

**Steps**:
1. Login successfully, rides loaded
2. Refresh page (Cmd+R or Ctrl+R)
3. **OBSERVE**: Session should persist (no re-login needed)
4. **OBSERVE**: Rides should load again with skeleton
5. Check localStorage → Should contain session data

**Expected Result**: ✅ PASS
- No need to login again
- Rides load smoothly on refresh
- Session persists across page reloads

**If FAIL**:
- Check browser localStorage settings
- Verify auth context is persisting session
- Check console for auth errors

---

## TEST 2: Ride Lock Logic

### Scenario A: Lock Badge Display
**Objective**: Verify locked rides show visual indicator

**Prerequisites**:
- Host account creates a ride (e.g., "Airport → Downtown")
- At least 1 other user joins the ride

**Steps**:
1. As HOST: Open app, view "My Rides"
2. Find the created ride
3. If ride has all seats filled → Should see "LOCKED" badge (orange)
4. If ride has some empty seats → Should see "OPEN" badge
5. **VERIFY**: Badge has lock icon 🔒

**Expected Result**: ✅ PASS
- Auto-locked rides show "LOCKED" badge
- Badge is orange/distinct color
- Icon clearly visible

**If FAIL**:
- Check ride status in database (should be 'locked')
- Verify RideCard component has lock imports
- Check browser console for errors

---

### Scenario B: Disable Join on Locked Rides
**Objective**: Prevent users from joining locked rides

**Prerequisites**:
- A locked ride exists (all seats filled or host locked it)
- Logged in as PASSENGER (not host)

**Steps**:
1. Open app, see ride list
2. Find the locked ride → Should show "Locked" badge
3. **Try to click "Join" button** → Button should be DISABLED
4. Button should be grayed out/inactive
5. Hover over button → Should show tooltip: "This ride is locked - no more joins allowed"
6. Try clicking anyway → Nothing should happen

**Expected Result**: ✅ PASS
- Join button is disabled (grayed)
- Cannot click to join locked ride
- Error message shown on hover

**If FAIL**:
- Check RideCard onClick handler
- Verify button has `disabled` prop set
- Check if ride status is correctly fetched

---

### Scenario C: Host Manual Lock
**Objective**: Verify host can lock ride manually

**Prerequisites**:
- Host account with an "OPEN" or "FULL" ride
- At least 1 other user joined

**Steps**:
1. As HOST: Click on your ride → Opens RideDetailsModal
2. Look for "Lock Ride" button
3. Click "Lock Ride" button
4. **OBSERVE**: Button changes, modal updates
5. **VERIFY**: Ride status now shows "LOCKED"
6. Close modal and return to ride list
7. **VERIFY**: Ride card now shows "LOCKED" badge
8. Check database (optional):
   ```sql
   SELECT id, status, locked_at FROM rides WHERE id = '[your_ride_id]';
   ```
   Should show: `status='locked'`, `locked_at=NOW()`

**Expected Result**: ✅ PASS
- Lock button exists in ride details
- Clicking lock changes status to "LOCKED"
- All UI updates immediately
- Database records locked_at timestamp

**If FAIL**:
- Check RideDetailsModal component
- Verify lockRideByHost() function exists
- Check if RPC function is working
- Run SQL: `SELECT * FROM rides WHERE status = 'locked';`

---

### Scenario D: Host Manual Unlock
**Objective**: Verify host can unlock before ride starts

**Prerequisites**:
- Host account with a "LOCKED" ride
- Ride hasn't started yet (date is today or future)

**Steps**:
1. As HOST: Open locked ride details
2. Look for "Unlock Ride" button
3. Click "Unlock Ride" button
4. **OBSERVE**: Status reverts to "OPEN"
5. Return to ride list
6. **VERIFY**: Badge now shows "OPEN" instead of "LOCKED"
7. **VERIFY**: Other users can now join again

**Expected Result**: ✅ PASS
- Unlock button visible on locked rides
- Status changes to "OPEN"
- Join button re-enabled for others
- Can lock/unlock multiple times

**If FAIL**:
- Check unlock function exists
- Verify ride date is not in past
- Check RPC permissions

---

### Scenario E: Auto-Lock on Seats Full
**Objective**: Verify ride auto-locks when all seats taken

**Prerequisites**:
- Need to fill a ride completely
- Ride with 4 seats, 3 already taken
- Need 1 more user to join

**Steps**:
1. As USER 3: Find ride with 3/4 seats taken
2. Click "Join"
3. **OBSERVE**: Ride now shows "FULL" status (4/4 seats)
4. **WAIT**: 2-3 seconds for trigger
5. **REFRESH PAGE** or check real-time
6. **VERIFY**: Ride status changed to "LOCKED"
7. **VERIFY**: "LOCKED" badge now visible
8. As another user: Cannot join anymore

**Expected Result**: ✅ PASS
- Auto-lock triggers when seats = seatsTotal
- Happens within 3 seconds
- All users see locked status in real-time
- Cannot override auto-lock

**If FAIL**:
- Check SQL trigger is active:
  ```sql
  SELECT trigger_name FROM information_schema.triggers
  WHERE trigger_name = 'trigger_auto_lock_ride';
  ```
- Run trigger manually:
  ```sql
  UPDATE rides SET seats_taken = seats_total WHERE id = '[ride_id]';
  ```

---

## COMPREHENSIVE TEST MATRIX

| Feature | Scenario | Status | Notes |
|---------|----------|--------|-------|
| **RIDE LOADING** | Fresh Login | ⬜ | Should show skeleton |
| | Network Offline | ⬜ | Should retry |
| | Session Persist | ⬜ | Should remember login |
| **LOCK DISPLAY** | Badge Shows | ⬜ | Orange lock icon |
| | Lock Styling | ⬜ | Visually distinct |
| **LOCK PREVENT** | Join Disabled | ⬜ | Button grayed out |
| | Tooltip Shows | ⬜ | Lock message visible |
| **LOCK MANUAL** | Host Lock | ⬜ | Status → locked |
| | Host Unlock | ⬜ | Status → open |
| **LOCK AUTO** | Seats Full | ⬜ | Auto-locks at full capacity |
| | Real-time Sync | ⬜ | Others see lock immediately |

---

## DEBUGGING COMMANDS

### Console Commands (Browser DevTools):
```javascript
// Test auth
console.log(window.localStorage);

// Debug Supabase
debugSupabase();

// Check RLS policies
supabase.from("rides").select("*").limit(1);

// Test lock function
supabase.rpc("lock_ride_by_host", {
  p_ride_id: "YOUR_RIDE_ID",
  p_user_id: "YOUR_USER_ID"
});
```

### SQL Queries (Supabase Editor):
```sql
-- Check rides table
SELECT id, status, seats_taken, seats_total, locked_at
FROM rides
ORDER BY created_at DESC
LIMIT 10;

-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_%lock%';

-- Check lock RPC
SELECT proname FROM pg_proc
WHERE proname IN ('lock_ride_by_host', 'unlock_ride_by_host');

-- Check RLS policies
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'rides';
```

---

## REPORTING RESULTS

After testing, please report:
1. ✅ PASS / ❌ FAIL for each scenario
2. 📝 Any error messages from console
3. 🐛 Unexpected behavior
4. 💡 Suggestions for improvements

---

## NEXT STEPS

### If ALL TESTS PASS:
→ Ready for Phase 2 features (Stripe, Email Verification)

### If SOME TESTS FAIL:
→ Debug using commands above
→ Check SQL migrations
→ Verify environment variables

### If NEED HELP:
1. Run `debugSupabase()` in console
2. Share error messages
3. Check network tab for API errors
4. Verify database tables exist

---

**Testing Date**: _______________
**Tester**: _______________
**Results**: _______________

**Document Version**: 1.0
**Last Updated**: February 2026
