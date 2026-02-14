# RYDIN - Rideshare Platform for Students

## Project Overview
Rydin is a peer-to-peer rideshare platform designed specifically for college students. Built with Vite + React + TypeScript + Tailwind CSS, with Supabase as the backend.

---

## FEATURES & STATUS

### WORKING ✅

#### Authentication
- Email/Password signup and login via Supabase
- Session persistence with localStorage
- Profile-based user identification
- Future: OAuth providers can be enabled in Supabase

#### Core Ride Features
- **Create Rides**: Users can create new rides (source → destination)
- **Browse Rides**: Real-time ride listings with filters
- **Join Rides**: Users can join open rides
- **Ride Details**: View ride information, pricing, passenger list
- **Ride Status Tracking**: Open → Full → Locked → Completed → Cancelled

#### User Profile
- Profile setup with personal details (name, department, year, gender)
- Emergency contact information
- Trust score system (1-5 stars)
- Phone number verification readiness

#### Ride Filtering
- All rides view
- Airport routes
- Station routes
- Girls-only rides option

#### Real-time Updates
- Supabase real-time subscriptions for rides
- Live ride member updates
- Instant status changes (database changes reflect in UI)

#### Safety Features
- Emergency contact sharing
- Trust scoring system
- Reliability tracking (no-show penalties)
- Parent safe mode (share trip details with parents)
- Platform disclaimer and safety guidelines

#### Advanced Features
- Cost savings calculator (shows per-person savings)
- Ride memory/history (completed rides)
- Event-based ride creation (for campus events)
- Hopper matching (flexible ride requests)
- Multi-modal transport support (buses, trains, shuttles)

#### Chat & Messaging
- Real-time messaging between ride participants
- Message persistence
- User presence tracking

---

### PARTIALLY WORKING ⚠️

#### Ride Loading
- **Issue**: After fresh login, rides may not load immediately
- **Cause**: Race condition between auth state and DB query
- **Workaround**: Page refresh loads rides
- **Status**: Foreign key fixed, RLS policies verified

#### Profile Creation
- **Issue**: Sometimes asks for name twice
- **Cause**: Redirect logic timing issue (now fixed)
- **Status**: FIXED in latest version

---

### NOT WORKING ❌

#### Payment System
- Stripe integration not implemented
- Payment processing not active
- All payment amounts are mock/estimated

#### Ride Lock Feature
- "Lock" button may not function properly
- Associated locks handling incomplete

#### Event Creation Dashboard
- Event management interface partially complete
- Auto-ride-room creation incomplete

#### Hopper Matching Algorithm
- Complex matching logic not fully implemented
- Request status handling incomplete

---

## DATABASE SCHEMA

### Main Tables
- **profiles**: User profiles (id, name, email, phone, trust_score, etc.)
- **rides**: Ride listings (id, host_id, source, destination, date, time, seats, status)
- **ride_members**: Ride participation (ride_id, user_id, status)
- **users**: Legacy user table (being phased out for profiles)
- **events**: Campus events
- **hoppers**: Flexible ride requests
- **hopper_requests**: Hopper matching
- **event_ride_rooms**: Auto-created rides for events
- **messages**: Real-time chat
- **ride_memories**: Completed ride history

### Foreign Keys (CRITICAL)
- rides.host_id → profiles.id ✅ FIXED
- ride_members.user_id → profiles.id ✅
- ride_members.ride_id → rides.id ✅

---

## ENVIRONMENT VARIABLES CONFIGURED ✅

Only Supabase is now configured. No Firebase or Google OAuth dependencies.

```
VITE_SUPABASE_URL=https://ylyxhdlncslvqdkhzohs.supabase.co
VITE_SUPABASE_ANON_KEY=[JWT token from Supabase]
VITE_SUPABASE_PUBLISHABLE_KEY=[Publishable key from Supabase]
```

See `.env.example` for template.

---

## RECENT FIXES

### Session 1
1. Fixed foreign key relationship: rides.host_id → profiles.id
2. Removed lovable-tagger dependency
3. Fixed auth redirect flow (no more profile setup loop)
4. Verified RLS policies for rides table

### Session 2
1. Removed all Firebase environment variables
2. Removed all Google OAuth configuration
3. Simplified to Supabase-only authentication
4. Created .env.example with clean template

---

## TECH STACK

**Frontend**
- React 18.3.1
- TypeScript 5.8.3
- Vite 5.4.19
- TailwindCSS 3.4.17
- Shadcn/ui components
- Framer Motion (animations)
- Lucide Icons

**Backend**
- Supabase (PostgreSQL + PostgREST API + Auth)
- Real-time subscriptions via WebSockets
- Row Level Security (RLS) policies
- Email/Password authentication (Supabase Auth)

**Dev Tools**
- ESLint 9.32.0
- Vitest 3.2.4
- TypeScript ESLint

---

## KNOWN ISSUES & TODO

1. **Rides not loading immediately after login** → SQL foreign key fixed, needs verification
2. **Payment system incomplete** → Stripe not connected
3. **Ride lock mechanism** → Partially implemented
4. **Event creation dashboard** → Needs completion
5. **File structure** → Should be reorganized (frontend/backend separation)

---

## HOW TO RUN

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

**Dev Server**: http://localhost:8080

---

## NEXT STEPS FOR DEPLOYMENT

1. Verify rides load immediately after login in Supabase
2. Complete payment integration (Stripe)
3. Implement ride lock mechanism
4. Test all RLS policies with real users
5. Set up email notifications via Supabase
6. Configure OAuth in Supabase (if needed in future)
7. Reorganize project structure (frontend/backend)
8. Add comprehensive error logging
9. Set up analytics tracking
10. Performance optimization and caching

---

## SUPABASE SETUP CHECKLIST

- [x] Database tables created
- [x] Foreign keys configured
- [x] RLS policies enabled
- [x] Real-time subscriptions enabled
- [x] Email/Password authentication configured
- [ ] Email verification enabled (optional)
- [ ] Custom JWT claims for authorization (if needed)
- [ ] Backup strategy configured
- [ ] Monitoring/alerts configured
- [ ] OAuth providers configured (if needed)

---

**Last Updated**: February 2026
**Project Status**: MVP Phase - Core features working, advanced features in progress
