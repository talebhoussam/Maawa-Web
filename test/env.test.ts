import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Env validation behaviour. Each test mutates process.env then resets
 * the module cache (`vi.resetModules`) so the next dynamic import re-runs
 * lib/env.ts's top-level validation logic.
 */

describe('lib/env', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('parses valid env successfully', async () => {
    const env = await import('@/lib/env');
    expect(env.publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('test');
    expect(env.serverEnv.PLATFORM_COMMISSION_RATE).toBe(0.10);
  });

  it('coerces NEXT_PUBLIC_MC_RATE_DZD to a number', async () => {
    const env = await import('@/lib/env');
    expect(env.publicEnv.NEXT_PUBLIC_MC_RATE_DZD).toBe(50);
    expect(typeof env.publicEnv.NEXT_PUBLIC_MC_RATE_DZD).toBe('number');
  });

  it('flags twilioConfigured as false when SIDs are missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    vi.resetModules();
    const env = await import('@/lib/env');
    expect(env.twilioConfigured).toBe(false);
  });

  it('rejects an invalid PLATFORM_COMMISSION_RATE (out of [0,1])', async () => {
    process.env.PLATFORM_COMMISSION_RATE = '1.5';
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/Invalid server env/);
  });

  it('rejects a too-short NEXTAUTH_SECRET', async () => {
    process.env.NEXTAUTH_SECRET = 'too_short';
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/Invalid server env/);
  });

  it('rejects a missing NEXT_PUBLIC_FIREBASE_API_KEY', async () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    vi.resetModules();
    await expect(import('@/lib/env')).rejects.toThrow(/Invalid client env/);
  });

  it('seedEnabled stays false in production even with the flag on', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.ENABLE_SEED_ROUTES = 'true';
    vi.resetModules();
    const env = await import('@/lib/env');
    expect(env.seedEnabled).toBe(false);
    expect(env.isProd).toBe(true);
  });
});
