# Roomly Test Credentials

## Test Setup

The Roomly application uses **Supabase Auth** for authentication. New accounts can be created via the registration page at `/registreren`.

### Live test instance
- Frontend URL: `https://18570093-3de4-41fd-8fb4-1100b54428d6.preview.emergentagent.com/`
- Supabase project: `https://gjjwctzgkujtlegcvxwy.supabase.co`

### Recommended test accounts (testing agent should create on the fly)

For this Supabase project, please create new users via `/registreren` with unique email addresses. Examples:

```
Landlord (verhuurder):
  email: landlord-test+<timestamp>@roomly-test.nl
  password: TestPassword123!

Tenant (huurder):
  email: tenant-test+<timestamp>@roomly-test.nl
  password: TestPassword123!

Auto-verified student (uses .nl university domain):
  email: student-test+<timestamp>@uva.nl  (or any .edu / vu.nl / tudelft.nl)
  password: TestPassword123!
```

### Notes for testing
- Supabase has **email confirmation enabled by default**. When testing, you may need to disable "Confirm email" in Supabase Dashboard → Authentication → Providers → Email, OR seed users via SQL with `email_confirmed_at`.
- The app gracefully handles unconfirmed accounts but may not allow login until confirmed.
- After creating a user, the `handle_new_user` trigger auto-creates a row in `profiles` and auto-verifies students whose email domain is in the whitelist (uva.nl, vu.nl, tudelft.nl, .edu, etc.).

### Universal test password
`TestPassword123!`
