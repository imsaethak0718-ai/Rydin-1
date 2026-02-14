# Rydin - Folder Structure Reorganization

## Target Structure

```
rydin/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── pages/              # Page components
│   │   ├── components/         # Reusable UI components
│   │   ├── contexts/           # React contexts (Auth, etc.)
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utility functions
│   │   ├── integrations/       # External service integrations
│   │   ├── data/               # Mock data
│   │   ├── test/               # Tests
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── eslint.config.js
│   └── index.html
│
├── backend/                     # Backend infrastructure (Future)
│   ├── migrations/             # SQL migration files
│   │   ├── COMPLETE_DB_SETUP.sql
│   │   ├── SUPABASE_MIGRATIONS.sql
│   │   ├── FIX_FOREIGN_KEY_RELATIONSHIP.sql
│   │   ├── FIX_RIDES_POLICIES.sql
│   │   ├── FIX_RLS_POLICIES_V3.sql
│   │   └── [other migration files]
│   ├── functions/              # Supabase edge functions (future)
│   ├── storage/               # Supabase storage policies (future)
│   └── README.md              # Backend setup instructions
│
├── docs/                        # Documentation
│   ├── SETUP.md                # Setup instructions
│   ├── ARCHITECTURE.md         # Architecture overview
│   ├── DATABASE.md             # Database schema
│   └── API.md                  # API documentation
│
├── .env                        # Environment variables (root level)
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

## Migration Steps (Manual)

Since we need to maintain build integrity, here's how to reorganize:

### Step 1: Create Directory Structure

```bash
# Create main directories
mkdir -p frontend/src
mkdir -p frontend/public
mkdir -p backend/migrations
mkdir -p docs

# Create subdirectories
mkdir -p frontend/src/{pages,components,contexts,hooks,lib,integrations,data,test}
mkdir -p backend/functions
mkdir -p backend/storage
```

### Step 2: Move Frontend Files

```bash
# Move all src files to frontend/
mv src/* frontend/src/

# Move config files
mv package.json frontend/
mv vite.config.ts frontend/
mv tsconfig.json frontend/
mv tsconfig.app.json frontend/
mv tsconfig.node.json frontend/
mv tailwind.config.ts frontend/
mv postcss.config.js frontend/
mv eslint.config.js frontend/
mv index.html frontend/
mv public/* frontend/public/ 2>/dev/null || true

# Move .lovable to frontend if keeping (or delete)
# mv .lovable frontend/.lovable
```

### Step 3: Move Backend Files

```bash
# Move all SQL migration files to backend/migrations
mv *.sql backend/migrations/

# Create README for backend
cat > backend/README.md << 'EOF'
# Rydin Backend

## Database Migrations

All SQL migration files are in `migrations/` folder.

### Running Migrations

In Supabase SQL Editor, run migrations in this order:

1. COMPLETE_DB_SETUP.sql
2. SUPABASE_MIGRATIONS.sql
3. FIX_FOREIGN_KEY_RELATIONSHIP.sql
4. FIX_RIDES_POLICIES.sql
5. FIX_RLS_POLICIES_V3.sql

### Future: Edge Functions

Add Supabase edge functions here for:
- Email notifications
- Payment processing
- Complex business logic

### Future: Storage Rules

Add storage bucket policies for:
- User avatars
- Ride receipts
- Documents
EOF
```

### Step 4: Update Frontend Package Configuration

Update `frontend/package.json`:
- Change name to `@rydin/frontend`
- Update any path references if needed

### Step 5: Update Development Commands

From project root, you can now run:
```bash
cd frontend && npm install
cd frontend && npm run dev
cd frontend && npm run build
```

Or add scripts to root `package.json`:
```json
{
  "scripts": {
    "dev": "cd frontend && npm run dev",
    "build": "cd frontend && npm run build",
    "preview": "cd frontend && npm run preview"
  }
}
```

## Important Notes

1. **No Breaking Changes Yet**: The app will work exactly the same after reorganization
2. **Environment Variables**: Keep `.env` in root - it's used by frontend via `import.meta.env`
3. **Git**: Don't forget to remove `.lovable/` from git tracking
4. **Dependencies**: All npm packages stay in `frontend/package.json`

## What We've Already Done

- [x] Removed lovable-tagger from dependencies
- [x] Updated vite.config.ts to remove lovable plugin
- [x] Fixed auth redirect flow
- [x] Fixed foreign key (rides → profiles)
- [ ] Reorganized folder structure (manual steps above)

## Next Phase (Optional)

After reorganization completes, consider:
- Adding Node/Express backend in `backend/server/`
- Implementing edge functions in `backend/functions/`
- Setting up database seeding scripts in `backend/seeds/`
- Adding API documentation in `docs/API.md`

---

**Status**: Ready for manual reorganization following steps above
