import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '@/lib/ratelimit';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the max within the window', () => {
    const rl = createRateLimiter({ window: 60_000, max: 3 });
    expect(rl.check('k1')).toBe(true);
    expect(rl.check('k1')).toBe(true);
    expect(rl.check('k1')).toBe(true);
    expect(rl.check('k1')).toBe(false);
    expect(rl.check('k1')).toBe(false);
  });

  it('isolates different keys', () => {
    const rl = createRateLimiter({ window: 60_000, max: 1 });
    expect(rl.check('a')).toBe(true);
    expect(rl.check('b')).toBe(true);
    expect(rl.check('a')).toBe(false);
    expect(rl.check('b')).toBe(false);
  });

  it('frees slots as the window slides', () => {
    const rl = createRateLimiter({ window: 1_000, max: 2 });
    expect(rl.check('k')).toBe(true);
    expect(rl.check('k')).toBe(true);
    expect(rl.check('k')).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(rl.check('k')).toBe(true);
    expect(rl.check('k')).toBe(true);
    expect(rl.check('k')).toBe(false);
  });

  it('reset() clears the counter for a key', () => {
    const rl = createRateLimiter({ window: 60_000, max: 1 });
    expect(rl.check('k')).toBe(true);
    expect(rl.check('k')).toBe(false);
    rl.reset('k');
    expect(rl.check('k')).toBe(true);
  });

  it('mixes old + new timestamps correctly at the boundary', () => {
    /* If we make 2 calls at t=0 with window=1000 and max=2, then 1 call at
       t=999, we expect rejection at t=999 (still within window). At
       t=1001, the t=0 entries fall off — should allow. */
    const rl = createRateLimiter({ window: 1_000, max: 2 });
    rl.check('k');                /* t=0 */
    rl.check('k');                /* t=0 */
    vi.advanceTimersByTime(999);
    expect(rl.check('k')).toBe(false);  /* still within window */
    vi.advanceTimersByTime(2);          /* now t=1001 — first 2 evicted */
    expect(rl.check('k')).toBe(true);
  });
});
