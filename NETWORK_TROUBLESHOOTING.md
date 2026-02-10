# Network Troubleshooting: "Failed to Fetch" Error

## What This Error Means

Your app **cannot reach Supabase servers**. This is a network-level error, not a database error.

## Checklist

### 1. Check Your Internet Connection

```bash
# In terminal/PowerShell:
ping google.com
```

**Expected:** Should get responses
**If fails:** Your internet is down - reconnect and try again

### 2. Check Supabase Server Status

Visit: https://status.supabase.com/

Look for any incident reports. If Supabase is down, wait for them to restore service.

### 3. Verify Supabase URL is Correct

In browser console, run:
```javascript
console.log(import.meta.env.VITE_SUPABASE_URL)
```

Should show: `https://ylyxhdlncslvqdkhzohs.supabase.co`

If it's blank or undefined:
- Environment variables not set properly
- Restart dev server: `npm run dev`

### 4. Check if Domain is Reachable

In browser console:
```javascript
fetch("https://ylyxhdlncslvqdkhzohs.supabase.co/rest/v1/health")
  .then(r => {
    console.log("✅ Reachable! Status:", r.status);
  })
  .catch(e => {
    console.error("❌ Not reachable:", e.message);
  });
```

**Expected:** Should show Status: 200 or 404 (not a network error)

**If shows network error:** Firewall/network issue

### 5. Check Firewall & Network Settings

**If using VPN:**
- Try disabling VPN temporarily
- Add `supabase.co` to whitelist

**If on corporate network:**
- Check if `supabase.co` is blocked
- Check if HTTPS/CORS is blocked
- Contact IT to whitelist the domain

**If using DNS filter (Pi-hole, etc):**
- Check logs for blocked supabase.co requests
- Whitelist the domain

### 6. Check Browser Network Tab

1. Open DevTools: **F12**
2. Go to **Network** tab
3. Refresh page
4. Look for requests to `supabase.co`
5. Check if they show:
   - ✅ Status 200 = OK
   - ❌ Failed = Network error
   - ❌ CORS error = Server configuration issue

### 7. Try Different Network

Test on different connection:
- Use mobile hotspot instead of WiFi
- Use mobile data if available
- Try from different location

If it works elsewhere, your network has the issue.

### 8. Check Supabase Configuration

Verify your Supabase project is:
1. Active (not paused)
2. Has valid billing (if required)
3. Not rate-limited

Visit: https://supabase.com/dashboard/project/ylyxhdlncslvqdkhzohs

## Common Solutions

| Issue | Solution |
|-------|----------|
| Internet down | Reconnect to internet |
| Supabase down | Wait for Supabase to come back online |
| VPN blocking | Disable VPN or whitelist supabase.co |
| Firewall blocking | Ask IT to whitelist supabase.co |
| Wrong environment variables | Restart dev server after setting vars |
| Stale DNS cache | Clear browser cache (Ctrl+Shift+Delete) or flush DNS |

## Advanced Debugging

### Check DNS Resolution

```javascript
// In browser console
fetch("https://ylyxhdlncslvqdkhzohs.supabase.co")
  .catch(e => {
    console.log("Error type:", e.constructor.name);
    console.log("Error message:", e.message);
  });
```

### Check Browser Console Logs

Run in console:
```javascript
debugSupabase()
```

Look for the step that fails (0️⃣, 1️⃣, 2️⃣, etc)

That's where the problem is.

## Still Having Issues?

1. **Note the exact error message**
2. **Run `debugSupabase()` and copy output**
3. **Check browser Network tab for failed requests**
4. **Check what Supabase URL you're using**
5. **Verify environment variables are set**

Then share these with support along with:
- Your operating system
- Your network type (home WiFi, corporate, VPN, etc)
- Whether it works on different networks
