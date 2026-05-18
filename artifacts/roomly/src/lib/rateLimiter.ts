// ─────────────────────────────────────────────────────────────────────────────
// Client-side rate limiter using localStorage.
// UX-level protection — not a security boundary. Supplements server-side limits.
// ─────────────────────────────────────────────────────────────────────────────

type RateLimitState = { attempts: number[] };

function loadState(key: string): RateLimitState {
  try {
    const raw = localStorage.getItem(`rl_${key}`);
    if (!raw) return { attempts: [] };
    return JSON.parse(raw) as RateLimitState;
  } catch {
    return { attempts: [] };
  }
}

function saveState(key: string, state: RateLimitState): void {
  try {
    localStorage.setItem(`rl_${key}`, JSON.stringify(state));
  } catch {
    // Storage may be unavailable in some browsers/contexts — fail silently.
  }
}

/** Check whether the action is currently allowed under the rate limit. */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const state = loadState(key);
  const valid = state.attempts.filter((t) => now - t < windowMs);

  if (valid.length >= maxAttempts) {
    const oldest = Math.min(...valid);
    return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - oldest)) };
  }
  return { allowed: true, retryAfterMs: 0 };
}

/** Record one attempt for the given key. Call after checkRateLimit returns allowed. */
export function recordAttempt(key: string, windowMs: number): void {
  const now = Date.now();
  const state = loadState(key);
  const valid = state.attempts.filter((t) => now - t < windowMs);
  valid.push(now);
  saveState(key, { attempts: valid });
}

/** Clear all recorded attempts for a key (e.g., after a successful action). */
export function clearRateLimit(key: string): void {
  try {
    localStorage.removeItem(`rl_${key}`);
  } catch {
    // ignore
  }
}

/** Format milliseconds as a human-readable Dutch duration string. */
export function formatRetryTime(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec} seconden`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min} minuten`;
  return `${Math.ceil(min / 60)} uur`;
}

// ── Pre-configured limits ─────────────────────────────────────────────────────

export const RL = {
  login:          { key: "login",     max: 5,  windowMs: 5   * 60 * 1000 }, // 5 / 5 min
  signup:         { key: "signup",    max: 3,  windowMs: 10  * 60 * 1000 }, // 3 / 10 min
  forgotPassword: { key: "forgot_pw", max: 3,  windowMs: 60  * 60 * 1000 }, // 3 / hr
} as const;
