# REVISED ROADMAP: Ride Cost Splitting Platform

## MAJOR PIVOT

**Old Idea**: Build ride-sharing (create own rides)  
**New Idea**: Cost-splitting platform (split existing Uber/Ola/Rapido rides)

### Why This is Better:
- ✅ No payments infrastructure needed
- ✅ No complex driver verification
- ✅ Users already use Uber/Ola/Rapido
- ✅ Simpler MVP
- ✅ Immediate market fit
- ✅ Network effect (share links with friends)

---

## NEW FEATURE SET

### PHASE 1: IDENTITY + COST SPLITTING (Core)

#### 1️⃣ OpenCV ID Card Scanning ⭐ NEW
**Purpose**: One-time student identity verification

**How It Works**:
1. Student opens app → "Verify Identity"
2. Uses device camera to scan ID card (one side)
3. OpenCV extracts:
   - Name
   - ID number / Roll number
   - College name (optional)
4. Saved to database with encrypted data
5. Gets "Verified Student" badge
6. Badge never expires (scan once, done)

**Tech Stack**:
- OpenCV.js (client-side, no backend needed)
- Computer Vision API (optional: Google Vision API for OCR)
- Encrypted storage in Supabase

**Database**:
```sql
CREATE TABLE id_verifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  id_image_url TEXT,  -- Stored in Supabase Storage
  extracted_name TEXT,
  extracted_id_number TEXT,
  college_name TEXT,
  verified_at TIMESTAMP,
  verification_status TEXT ('pending', 'verified', 'rejected'),
  is_valid BOOLEAN DEFAULT TRUE
);
```

**UI Flow**:
```
Profile → Verify Identity → Camera → Scan ID → Processing → "Verified!" Badge
```

---

#### 2️⃣ Ride Link Parser 🔗 NEW
**Purpose**: Extract ride details from Uber/Ola/Rapido links

**Supported Platforms**:
- 🚗 Uber (uber.com/request links)
- 🚕 Ola (olarides.com links)
- 🏎️ Rapido (rapido.in links)
- Any other ride service link

**How It Works**:
1. User creates new split: "Add Ride"
2. Paste ride link (from Uber app share button)
3. App extracts:
   - Pickup location
   - Dropoff location
   - Ride type (UberX, Ola Premium, etc.)
   - **PRICE** ← Most important
   - Estimated time
4. Shows preview: "Pickup: SRM, Dropoff: Airport, Price: ₹580"
5. Saves as "Cost Split" in database

**Parser Implementation**:
```javascript
// Extract from different URL formats
parseUberLink(url) → { pickup, dropoff, price, estimatedTime }
parseOlaLink(url) → { pickup, dropoff, price, estimatedTime }
parseRapidoLink(url) → { pickup, dropoff, price, estimatedTime }
```

**Database**:
```sql
CREATE TABLE ride_links (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  platform TEXT,  -- 'uber', 'ola', 'rapido', etc.
  original_link TEXT,
  pickup_location TEXT,
  dropoff_location TEXT,
  ride_type TEXT,
  base_price DECIMAL,
  total_price DECIMAL,
  currency TEXT DEFAULT 'INR',
  extracted_at TIMESTAMP,
  created_at TIMESTAMP
);
```

---

#### 3️⃣ Cost Splitting & Calculation 💰 NEW
**Purpose**: Divide ride cost among all passengers

**How It Works**:
1. Host creates split: "Airport Ride - ₹580"
2. Shares link with friends
3. Friends join the split
4. App calculates:
   ```
   Total: ₹580
   Passengers: 4 (Host + 3 friends)
   Per person: ₹580 / 4 = ₹145
   ```
5. Shows who paid and settlement needed

**Features**:
- Equal split (default)
- Custom split (if someone paid extra)
- Track who paid (host usually)
- Show settlement: "Alice paid ₹580, you owe ₹145"

**Database**:
```sql
CREATE TABLE cost_splits (
  id UUID PRIMARY KEY,
  created_by UUID REFERENCES profiles(id),
  ride_link_id UUID REFERENCES ride_links(id),
  total_amount DECIMAL,
  split_count INT,
  amount_per_person DECIMAL,
  status TEXT ('active', 'settled', 'expired'),
  created_at TIMESTAMP,
  expires_at TIMESTAMP  -- 24 hours
);

CREATE TABLE split_members (
  id UUID PRIMARY KEY,
  split_id UUID REFERENCES cost_splits(id),
  user_id UUID REFERENCES profiles(id),
  amount_owed DECIMAL,
  amount_paid DECIMAL DEFAULT 0,
  status TEXT ('pending', 'paid', 'settled'),
  joined_at TIMESTAMP
);
```

---

#### 4️⃣ Shareable Group Links 🔗 NEW
**Purpose**: Invite friends to split a ride

**How It Works**:
1. Host creates split from Uber link
2. Click "Share" → Generates unique link:
   ```
   rydin.app/split/abc123xyz
   ```
3. Host shares link (WhatsApp, Telegram, etc.)
4. Friends click → See ride details
5. Click "Join Split" → Added to group
6. All see real-time updates

**Link Format**:
```
https://rydin.app/split/{split_id}

Example:
https://rydin.app/split/550e8400-e29b-41d4-a716-446655440000
```

**Share Preview**:
```
"🚗 Alice is splitting a ride to Airport
📍 SRM → Chennai Airport
💰 ₹145 per person (4 people)
✅ Join the split"
```

---

#### 5️⃣ Settlement & History 📊 NEW
**Purpose**: Track who owes whom money

**Features**:
- "You owe Alice ₹145"
- "Bob paid you ₹290"
- Mark as settled (UPI screenshot upload)
- History of all splits
- Trust score based on payment history

**Settlement Flow**:
1. Ride completed
2. Show: "Alice paid ₹580, you owe ₹145"
3. User pays via UPI/Paytm
4. Upload proof (optional)
5. Marked as settled
6. Increases trust score

---

## DATABASE SCHEMA (New Tables)

```sql
-- 1. ID Verification
CREATE TABLE id_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  id_image_url TEXT NOT NULL,
  extracted_name TEXT,
  extracted_id_number TEXT,
  college_name TEXT,
  verified_at TIMESTAMP,
  verification_status TEXT DEFAULT 'verified',
  is_valid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Ride Links (parsed from Uber/Ola/Rapido)
CREATE TABLE ride_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,  -- 'uber', 'ola', 'rapido'
  original_link TEXT NOT NULL,
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  ride_type TEXT,
  base_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  extracted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Cost Splits (shared rides)
CREATE TABLE cost_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ride_link_id UUID REFERENCES ride_links(id) ON DELETE SET NULL,
  title TEXT,  -- "Airport ride", "Mall trip", etc.
  total_amount DECIMAL(10, 2) NOT NULL,
  split_count INT DEFAULT 1,
  amount_per_person DECIMAL(10, 2),
  status TEXT DEFAULT 'active',  -- 'active', 'settled', 'expired'
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 4. Split Members (people in the split)
CREATE TABLE split_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id UUID NOT NULL REFERENCES cost_splits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_owed DECIMAL(10, 2),
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',  -- 'pending', 'paid', 'settled'
  joined_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP,
  UNIQUE(split_id, user_id)
);

-- 5. Settlement Transactions (payment tracking)
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id UUID NOT NULL REFERENCES profiles(id),
  payee_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10, 2) NOT NULL,
  split_id UUID REFERENCES cost_splits(id),
  status TEXT DEFAULT 'pending',  -- 'pending', 'completed'
  proof_url TEXT,  -- UPI screenshot, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_id_verifications_user ON id_verifications(user_id);
CREATE INDEX idx_ride_links_user ON ride_links(user_id);
CREATE INDEX idx_cost_splits_creator ON cost_splits(created_by);
CREATE INDEX idx_cost_splits_status ON cost_splits(status);
CREATE INDEX idx_split_members_user ON split_members(user_id);
CREATE INDEX idx_settlements_status ON settlements(status);
```

---

## TECH STACK FOR NEW FEATURES

### Frontend
- **OpenCV.js** - Client-side ID scanning (no server needed)
- **Tesseract.js** - OCR for text extraction
- **Link-parsing library** - Parse Uber/Ola/Rapido URLs
- **QR Code** - Generate shareable links
- **React** - UI (already have)

### Backend
- **Supabase** - Database + storage
- **RLS Policies** - Secure cost splits
- **Edge Functions** - Optional: Link validation

### Optional External APIs
- Google Vision API - Better ID recognition
- UPI verification APIs - Payment confirmation

---

## PHASE 1: IMPLEMENTATION ORDER

1. **Database Setup** (30 mins)
   - Create new tables
   - Set up RLS policies
   - Create indexes

2. **ID Verification with OpenCV** (2 hours)
   - OpenCV.js setup
   - Camera component
   - Image capture & storage
   - Name extraction

3. **Ride Link Parser** (1.5 hours)
   - Parse Uber links
   - Parse Ola links
   - Parse Rapido links
   - Store in database

4. **Cost Splitting UI** (1.5 hours)
   - Create split form
   - Add members form
   - Show calculations
   - Share button

5. **Settlement & History** (1 hour)
   - Settlement tracking UI
   - History page
   - Trust score updates

---

## REVENUE MODEL (New)

Instead of taking ride fees, you can:

1. **Freemium Model**
   - Free: Split up to 5 rides/month
   - Premium: ₹49/month unlimited splits

2. **Marketplace**
   - Partner with Uber/Ola for referrals
   - Small commission on rides created via your app

3. **College Partnerships**
   - Partner with colleges
   - Branded versions
   - Campus shuttle integration

---

## COMPETITIVE ADVANTAGES

✅ **ONE-TIME ID VERIFICATION** - Trust is locked in  
✅ **ALL RIDE PLATFORMS** - Works with any service  
✅ **OFFLINE-FIRST** - No servers needed for parsing  
✅ **PRIVACY-FOCUSED** - Data encrypted  
✅ **COLLEGE-SPECIFIC** - Campus market focus  
✅ **ZERO PAYMENT RISK** - No payment processing needed  

---

## TIMELINE

| Phase | Duration | Status |
|-------|----------|--------|
| Database Setup | 30 min | Ready |
| ID Verification | 2 hours | Next |
| Link Parsing | 1.5 hours | Next |
| Cost Splitting | 1.5 hours | Next |
| Settlement | 1 hour | Next |
| **TOTAL MVP** | **6 hours** | Doable today |

---

## COMPETITORS

- **Splitwise** - Generic expense splitting (no ID verification)
- **Paytm Group Expense** - Limited to Paytm ecosystem
- **WhatsApp Group Payments** - Manual tracking
- **Homies** - Ride-sharing focused

**Our Advantage**: First platform combining ID verification + ride cost splitting

---

## NEXT STEPS

1. ✅ Finalize feature list (done)
2. 🔄 Create database migration SQL
3. 🔄 Set up OpenCV.js
4. 🔄 Build link parser (Uber/Ola/Rapido)
5. 🔄 Create UI components
6. 🔄 Test end-to-end

Ready to start implementing? Which feature first?

---

**Document Version**: 2.0 (REVISED)  
**Previous Idea**: Ride-sharing (DROPPED)  
**New Idea**: Ride cost-splitting (ACTIVE)  
**Status**: Ready for implementation
