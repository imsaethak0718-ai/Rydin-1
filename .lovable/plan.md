
# 🚕 Rydin SRM — Full Implementation Plan

## Phase 1: Foundation & Authentication
- **College email login** — Sign up/login restricted to `@srmist.edu.in` emails via Supabase Auth
- **User profiles** — Name, department, year, phone number, profile photo
- **Verification system** — Email verification required before accessing the platform
- **Trust score** — Initialize at a default score, updated after rides

## Phase 2: Ride Creation & Discovery
- **Home feed** — Scrollable list of available ride groups with cards showing source → destination, date/time, seats available, estimated cost, safety tags, and host rating
- **Create a ride** — Form to post a new ride: source, destination, date, time window, flight/train number (optional), max seats, girls-only toggle, estimated fare
- **Join a ride** — One-tap join with seat count confirmation
- **Filters & search** — Filter by destination, date, girls-only, time range

## Phase 3: Smart Matching
- **Auto-match engine** — When a user creates or searches for a ride, suggest existing rides matching same flight/train number, destination zone, or time window (±30 min)
- **Auto-created ride buckets** — Pre-generated ride slots for popular airport/station time slots
- **Seat locking** — Temporary 10-minute reservation when a user starts joining

## Phase 4: Ride Coordination & Group Chat
- **In-ride group chat** — Real-time messaging between ride members after joining
- **Driver details sharing** — Structured fields for driver name, vehicle number, phone
- **Pickup & drop point confirmation** — Each member confirms their pickup location
- **Smart drop sequencing** — Suggested optimal drop order for multiple stops

## Phase 5: Fare Splitting & Payments
- **Automatic fare split** — Equal split calculated based on number of riders
- **Manual adjustment** — Host can adjust individual shares if needed
- **Payment ledger** — Track who owes whom with status (paid/pending)
- **UPI reminder** — Copy-to-clipboard UPI payment links and nudge notifications
- **Savings display** — Post-ride summary showing money saved

## Phase 6: Girls Safety Features
- **Girls-only ride toggle** — Only verified female students can join
- **Anonymous mode** — Hide profile details until ride is confirmed
- **Emergency panic button** — Prominent SOS button during active rides
- **Live location sharing** — Share real-time location with ride members and emergency contacts
- **Emergency contacts** — Store up to 3 emergency contacts, auto-notified on panic
- **Ride participant logs** — Immutable log of all participants per ride

## Phase 7: Ratings, Trust & Gamification
- **Post-ride ratings** — Rate co-riders (1-5 stars + optional comment)
- **Trust score system** — Aggregated from ratings, completion rate, cancellation history
- **Cancellation penalties** — Trust score deduction for late cancellations
- **Hostel/batch leaderboards** — Rankings by department, hostel, or batch for most rides shared & money saved
- **Savings share cards** — Shareable post-ride card ("I saved ₹420 with Rydin!")

## Phase 8: Events & Virality
- **Event-based rides** — Special ride categories for fests, holidays, placements, internships
- **Invite system** — Invite friends via link, unlock badges
- **Campus ambassador badges** — Special profile badges for power users
- **Ride seeding** — Admin panel to pre-create popular routes during peak travel periods

## Design Direction
- **Modern & minimal** — Clean white background, soft shadows, generous whitespace
- **Accent color** — A warm taxi-yellow or vibrant teal as the primary accent
- **Card-based UI** — Ride cards as the central visual element
- **Mobile-first** — Optimized for phone use since students will use it on the go
- **Subtle animations** — Smooth transitions for joining rides, chat, and notifications

## Backend (Supabase)
- Authentication with college email restriction
- Database tables: profiles, rides, ride_members, messages, ratings, emergency_contacts, fare_splits, user_roles
- Row-Level Security on all tables
- Real-time subscriptions for chat and ride updates
- Edge functions for smart matching logic and notification triggers
