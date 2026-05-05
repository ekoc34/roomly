# Roomly Test Credentials

## Test Setup

The Roomly application uses **Supabase Auth** for authentication. New accounts can be created via the registration page at `/registreren`.

### Live test instance
- Frontend URL: `https://18570093-3de4-41fd-8fb4-1100b54428d6.preview.emergentagent.com/`
- Supabase project: `https://gjjwctzgkujtlegcvxwy.supabase.co`

### ⚠️ IMPORTANT prerequisite for E2E auth tests
Supabase free tier has **"Confirm email" enabled by default**. To test login flows you MUST do ONE of:

**Option A (recommended, fastest):** Disable email confirmation
1. Open your Supabase project dashboard
2. Go to **Authentication → Sign In / Providers → Email**
3. Toggle **"Confirm email"** OFF
4. Save

**Option B:** Manually confirm test users via SQL after registering them
```sql
update auth.users
  set email_confirmed_at = now(), confirmed_at = now()
  where email like '%@roomly-test.nl' or email like '%@uva.nl';
```

### Universal test password
`TestPassword123!`

### Suggested test accounts (created on the fly)

```
Landlord:
  email: landlord-{timestamp}@roomly-test.nl
  password: TestPassword123!

Tenant (general):
  email: tenant-{timestamp}@roomly-test.nl
  password: TestPassword123!

Auto-verified student (uses .nl university domain):
  email: student-{timestamp}@uva.nl
  password: TestPassword123!
  → Will be marked email_auto_verified=true and student_verified=true automatically
```

### Auto-verified university domains
The `handle_new_user` trigger auto-marks accounts as student-verified when the email domain matches:
- `*.edu`
- `uva.nl`, `student.uva.nl`, `vu.nl`, `tudelft.nl`, `tue.nl`, `utwente.nl`, `rug.nl`, `ru.nl`, `uu.nl`, `eur.nl`, `maastrichtuniversity.nl`, `wur.nl`, `tilburguniversity.nl`, `hva.nl`, `hu.nl`, `saxion.nl`, etc.

### Seed data
After registering at least one account, run `/app/frontend/supabase/migrations/003_dev_seed.sql` in the Supabase SQL editor to:
- Auto-confirm test emails
- Seed 6 sample listings owned by the first user in the system
