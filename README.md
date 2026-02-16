# 🚗 Rydin - Student Ride-Sharing Platform

Rydin is a **real-time student ride-matching platform** that helps students find co-passengers, save money, and travel safely together.

## ✨ Core Features

### 1. **Hopper** (Primary Feature)
- Create ride requests with pickup/drop locations and departure time
- **Real-time matching** with ±3-5 hours flexibility
- Request → Accept → Chat unlock flow
- Auto-expiry when time passes
- Safety-first design (no spam, verified students only)

### 2. **Events Nearby**
- Browse real upcoming events in Chennai (Concerts, Fests, Stand-up)
- Premium visual cards with high-res event banners
- Intent-based ride matching: Join auto-created carpool rooms
- Real-time interest tracking and participant counts
- Integrated distance markers for campus-to-event travel

### 3. **Train/Flight Matching**
- Add train/flight numbers silently
- Real-time notifications when other students on same trip
- Convert to Hopper for ride coordination
- No PNR/ticket needed

### 4. **Travel Timings**
- SRM ↔ Chennai shuttle schedules
- Local train timings
- Bus routes
- Always see free alternatives

### 5. **AI Travel Assistant** 🤖
- Smart travel advice: "When should I leave?", "Cheapest way?"
- Real-time cost recommendations
- Hopper vs alternatives comparison
- Chat interface with instant answers

### 6. **Profile & Community Ecosystem**
- **Profile Edit**: Dynamic profile management (UPI ID, Year, Dept, Phone)
- **Identity OCR & Verification**: Secure onboarding with college ID scanning and identity confirmation.
- **Trust Score**: Gamified reliability tracking with unlockable badges (e.g., "Safe Traveler", "Punctual").
- **Dynamic Participant Bubbles**: Real-time visual avatars in event rooms showing exactly who has joined.
- **Direct Messaging**: 1-on-1 personal chats that unlock only after a mutual match, preventing unsolicited spam.
- **Unified Ride Dashboard**: A consolidated "Activity" view for all hosted, joined, and requested rides with real-time status updates and unread message indicators.
- **Safe Mode**: Girls-only filters and 1-click emergency campus SOS buttons.

### 7. **Smart Utilities & Interaction**
- **Interactive Cost Estimator**: Real-time slider to visualize savings (Solo ₹1200 → Group ₹300).
- **Intelligent Intent Discovery**: A matching algorithm that accounts for ±3-5 hours of schedule flexibility to maximize student connections.
- **Smart Ride Links**: Paste links from Uber, Ola, or Rapido to automatically find matches and split costs.
- **Live Shuttle HUD**: Simulated real-time tracking of campus shuttles with arrival predictions and frequency markers.
- **Real-Time Travel Sync**: Auto-detect students on the same trains/flights with 0 sensitive data (No PNR sharing).
- **Automated Settlement Notices**: Integrated chat reminders to settle costs once a ride is completed.
- **College-Verified Badges**: Automatic reliability markers for verified `@srmist.edu.in` accounts.

---

## 🏗️ Tech Stack

### Frontend
- **Vite** - Lightning-fast build tool
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **React Router** - Navigation
- **shadcn/ui** - Component library

### Backend
- **Firebase** - Google OAuth + SMS OTP verification
- **Supabase** - PostgreSQL database + real-time subscriptions
- **PostgREST** - Auto-generated APIs

### Real-Time Features
- Supabase real-time subscriptions for hoppers
- Firebase Realtime Database for chat
- Live updates across all client connections

---

## 📋 Project Structure

```
src/
├── pages/
│   ├── Auth.tsx                 # Google OAuth login
│   ├── SMSVerification.tsx       # Phone OTP verification
│   ├── ProfileSetup.tsx          # Initial user onboarding
│   ├── ProfileEdit.tsx           # Premium profile management
│   ├── Index.tsx                 # Real-time dashboard feed
│   ├── Hopper.tsx               # Intent-based ride matching
│   ├── Events.tsx               # Live Chennai event hub
│   ├── Travel.tsx               # Transit integration (Shuttles/Trains)
│   ├── Activity.tsx             # Managed rides, chat inbox, and status
│   ├── Profile.tsx              # Trust score and user portfolio
│   └── AIAssistant.tsx          # Smart travel coordination logic
│
├── components/
│   ├── BottomNav.tsx            # Optimized mobile navigation
│   ├── EventCard.tsx            # Premium event showcasing
│   ├── EventModal.tsx           # Carpool coordination for events
│   ├── CostSavingEstimator.tsx   # Financial visualization
│   └── EmergencySafetyMode.tsx   # Critical safety features
│
├── integrations/
│   ├── firebase/
│   │   └── config.ts            # Auth & OTP setup
│   └── supabase/
│       ├── client.ts            # Data & Real-time setup
│       └── schema.sql           # Core database definitions
│
├── backend/
│   └── migrations/              # Robust, idempotent DB stabilization scripts
│
├── App.tsx                      # App routing & context providers
└── main.tsx                     # Entry point
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase account with Google OAuth configured
- Supabase account
- Bun or npm

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd rydin

# Install dependencies
npm install

# Create .env file with:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key

# Start dev server
npm run dev

# Open http://localhost:8080
```

---

## 🔧 Setup Instructions

### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project `rydin-a7b19`
3. Enable Authentication:
   - Google OAuth
   - Phone authentication
4. Add authorized domains:
   - `localhost:8080`
   - Your Fly.io domain
   - Your production domain

### 2. Supabase Setup
1. Go to [Supabase](https://supabase.com)
2. Create project
3. Run SQL from `src/integrations/supabase/schema.sql`
4. Add indexes:
```sql
CREATE INDEX idx_hoppers_date_location ON hoppers(date, pickup_location, drop_location);
CREATE INDEX idx_hoppers_time ON hoppers(departure_time);
CREATE INDEX idx_hoppers_active ON hoppers(status) WHERE status = 'active';
CREATE INDEX idx_events_date_category ON events(event_date, category);
CREATE INDEX idx_hopper_requests_pending ON hopper_requests(status) WHERE status = 'pending';
```

### 3. Stability & Harmonization
Rydin uses robust migration scripts to ensure database consistency. Run these in the SQL Editor:
- `backend/migrations/STABILIZE_DATABASE_FINAL.sql`: Fixes RLS recursion and schema mismatches.
- `backend/migrations/FIX_RPC_AND_SEED_EVENTS.sql`: Fixes RPC 404s and seeds Chennai events.

### 3. Enable Real-Time Subscriptions
In Supabase:
```sql
ALTER TABLE hoppers REPLICA IDENTITY FULL;
ALTER TABLE hopper_requests REPLICA IDENTITY FULL;
ALTER TABLE events REPLICA IDENTITY FULL;
ALTER TABLE event_interested_users REPLICA IDENTITY FULL;
```

---

## 🔄 Real-Time Features

### Hopper Matching (Real-Time)
- User creates hopper → triggers Postgres trigger
- Other users see new hoppers instantly via Supabase subscriptions
- Request sent → other user sees notification in real-time
- Accept request → chat unlocks immediately (both sides)

### Events Interest (Real-Time)
- Mark interested → counter updates instantly
- Auto ride rooms → users see updated participant count
- Join ride → seat count decreases in real-time

### Train/Flight Matching (Real-Time)
- Add trip → stored in database
- Another user adds same trip → instant notification
- Convert to Hopper → real-time sync

### Chat (Real-Time)
- Messages update instantly
- Typing indicators
- Read receipts

---

## 📱 Key Routes

| Route | Feature | Purpose |
|-------|---------|---------|
| `/auth` | Google Login | Initial authentication |
| `/sms-verification` | Phone OTP | Verify phone number |
| `/profile-setup` | Profile Creation | Complete user info |
| `/` | Home | Dashboard & main feed |
| `/hopper` | Ride Matching | Create & find rides |
| `/events` | Events Nearby | Browse & join events |
| `/travel` | Travel Info | Shuttles, trains, buses |
| `/ai` | AI Assistant | Smart travel advice |
| `/chat` | Messaging | Real-time chat |
| `/profile` | User Profile | Settings & info |

---

## 🔐 Authentication Flow

1. **Landing** → `/auth`
2. **Google OAuth** → User signs in with Google
3. **SMS Verification** → `/sms-verification` (Firebase OTP)
4. **Profile Setup** → `/profile-setup` (name, department, year, gender, emergency contact)
5. **Dashboard** → `/` (Ready to use all features)

---

## 💾 Database Schema

### Main Tables
- `profiles` - User info (Firebase UID)
- `hoppers` - Ride requests (active, expired, completed)
- `hopper_requests` - Join requests (pending, accepted, rejected)
- `events` - Event listings
- `event_interested_users` - User interests
- `event_ride_rooms` - Auto-created event rides
- `shuttle_timings` - Bus/shuttle schedules
- `train_info` - Train numbers & timings

---

## 🎮 Demo Script (5-7 mins for Judges)

```
1. AI Assistant (1 min)
   → Click AI tab
   → Ask "When should I leave for airport?"
   → Show smart response with recommendations

2. Cost Estimator (1 min)
   → Create hopper
   → Slide co-passenger slider
   → Show cost dropping: ₹1200 → ₹300

3. Emergency Mode (30 secs)
   → Click Emergency button
   → Show contacts: Police, Ambulance, etc.

4. Auto Ride Rooms (1 min)
   → Click Events
   → Show auto-created rides
   → Explain: "We create rides around intent"

5. Trust Score (30 secs)
   → Complete a ride
   → Show animation: 72 → 75
   → Badge unlocks

6. **Identity OCR (30 secs)**
   → Show the ID Scan step in Profile Setup
   → Explain: "Safety first with verified student IDs"

7. **Smart Links (1 min)**
   → Paste an Uber ride link
   → Show auto-extracted details: "Uber to Airport - ₹1450"
   → Invite others to split!

8. **Live Shuttle Map (30 secs)**
   → Switch to Travel → Shuttle HUD
   → Show the animated map and next arrival timing

9. **Core Hopper (1 min)**
   → Create hopper (Campus → Airport, Tomorrow 3:30 PM)
   → Show matching hoppers
   → Send request
   → Show accept flow
```

---

## 🎯 Key Statistics

- ✅ 0 drivers (we're not a cab service)
- ✅ 0 payments (no fintech)
- ✅ 1000+ users supported (Supabase scales)
- ✅ Request/Accept prevents spam
- ✅ Girls-only rides available
- ✅ Emergency mode built-in
- ✅ Real-time updates across all features
- ✅ ₹300-700 savings per trip

---

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📦 Deployment

### Fly.io
```bash
fly deploy
```

### Vercel
```bash
vercel deploy
```

### Docker
```bash
docker build -t rydin .
docker run -p 8080:8080 rydin
```

---

## 🔒 Security Features

- **Authentication**: Firebase + Google OAuth
- **Phone Verification**: OTP via Firebase
- **Request/Accept Only**: No auto-chat
- **College-Only Access**: @srmist.edu.in emails
- **Verified Badges**: Student ID verification (future)
- **Block/Report Users**: Safety controls
- **Girls-Only Rides**: Optional safety toggle
- **Emergency Mode**: 1-click emergency contacts

---

## 🚧 Future Features

- Student ID verification badges
- Calendar integration (Google Calendar)
- Push notifications
- Ride insurance
- Premium safety features
- Corporate partnerships
- Multi-city expansion
- Reward points system

---

## 🐛 Troubleshooting

### Google Login Not Working
→ Check Firebase authorized domains in Firebase Console

### SMS OTP Not Arriving
→ Check Firebase Phone Auth enabled
→ Verify phone number format (+91XXXXXXXXXX)

### Hopper Not Showing
→ Check database tables created
→ Verify status = 'active' and date >= today

### Slow Matching
→ Run database indexes (see Setup section)

### Real-Time Not Updating
→ Enable REPLICA IDENTITY FULL on tables
→ Check Supabase subscription is active

---

## 📞 Support

- **Firebase Issues**: https://firebase.google.com/support
- **Supabase Issues**: https://supabase.com/docs
- **React Issues**: https://react.dev/learn

---

## 📄 License

This project is licensed under the MIT License.

---

## 🎉 Final Notes

**Rydin isn't just cheaper travel. It's how students travel together, safely, in 2025.**

- Built for students first
- Safety-first architecture
- Network effect driven
- Real-time at scale
- Ready to launch

---

**Last Updated**: February 2025
**Status**: Ready for Production ✅
**Team**: Full-stack implementation complete
