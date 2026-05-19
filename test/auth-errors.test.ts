import { describe, it, expect } from 'vitest';
import { friendlyAuthError, AUTH_ERROR_CODES, _AUTH_ERROR_TABLE } from '@/lib/auth-errors';

/**
 * Coverage:
 *   1. Each required code maps to the exact French message from the brief.
 *   2. Field detection is correct (wrong-password → 'password', etc.).
 *   3. Default fallback for unknown / missing codes.
 *   4. EN and AR translations exist for every mapped code.
 *   5. Defensive code extraction:
 *      - Firebase-shaped object: { code: 'auth/...' }
 *      - Bare string code
 *      - Error with the code embedded in the message
 *      - null/undefined → default
 *      - Random shape → default
 */

describe('lib/auth-errors — friendlyAuthError', () => {
  describe('required code → French message mapping (per brief)', () => {
    const REQUIRED: ReadonlyArray<[string, string]> = [
      ['auth/wrong-password',         'Mot de passe incorrect'],
      ['auth/user-not-found',         'Aucun compte avec cet email'],
      ['auth/invalid-credential',     'Identifiants invalides'],
      ['auth/email-already-in-use',   'Cet email est déjà utilisé'],
      ['auth/weak-password',          'Mot de passe trop faible (minimum 8 caractères)'],
      ['auth/invalid-email',          "Format d'email invalide"],
      ['auth/too-many-requests',      'Trop de tentatives. Réessayez dans quelques minutes.'],
      ['auth/network-request-failed', 'Connexion internet instable. Réessayez.'],
      ['auth/requires-recent-login',  'Veuillez vous reconnecter pour effectuer cette action'],
    ];
    for (const [code, expected] of REQUIRED) {
      it(`${code} → "${expected}"`, () => {
        const r = friendlyAuthError({ code });
        expect(r.message).toBe(expected);
      });
    }
  });

  describe('field detection', () => {
    it('auth/wrong-password → field "password"', () => {
      expect(friendlyAuthError({ code: 'auth/wrong-password' }).field).toBe('password');
    });
    it('auth/user-not-found → field "email"', () => {
      expect(friendlyAuthError({ code: 'auth/user-not-found' }).field).toBe('email');
    });
    it('auth/invalid-email → field "email"', () => {
      expect(friendlyAuthError({ code: 'auth/invalid-email' }).field).toBe('email');
    });
    it('auth/email-already-in-use → field "email"', () => {
      expect(friendlyAuthError({ code: 'auth/email-already-in-use' }).field).toBe('email');
    });
    it('auth/weak-password → field "password"', () => {
      expect(friendlyAuthError({ code: 'auth/weak-password' }).field).toBe('password');
    });
    it('auth/invalid-credential → field "password" (defensive default)', () => {
      // v9+ collapses wrong-password and user-not-found into invalid-credential.
      // We tag the password field by convention so users see a red border there.
      expect(friendlyAuthError({ code: 'auth/invalid-credential' }).field).toBe('password');
    });
    it('auth/invalid-phone-number → field "phone"', () => {
      expect(friendlyAuthError({ code: 'auth/invalid-phone-number' }).field).toBe('phone');
    });
    it('auth/too-many-requests → field null (not tied to one input)', () => {
      expect(friendlyAuthError({ code: 'auth/too-many-requests' }).field).toBeNull();
    });
    it('auth/network-request-failed → field null', () => {
      expect(friendlyAuthError({ code: 'auth/network-request-failed' }).field).toBeNull();
    });
    it('auth/requires-recent-login → field null', () => {
      expect(friendlyAuthError({ code: 'auth/requires-recent-login' }).field).toBeNull();
    });
  });

  describe('default fallback', () => {
    const DEFAULT_FR = 'Une erreur est survenue. Réessayez.';
    it('unknown code → default French message', () => {
      const r = friendlyAuthError({ code: 'auth/some-unknown-code' });
      expect(r.message).toBe(DEFAULT_FR);
      expect(r.field).toBeNull();
    });
    it('null → default', () => {
      expect(friendlyAuthError(null).message).toBe(DEFAULT_FR);
    });
    it('undefined → default', () => {
      expect(friendlyAuthError(undefined).message).toBe(DEFAULT_FR);
    });
    it('empty object → default', () => {
      expect(friendlyAuthError({}).message).toBe(DEFAULT_FR);
    });
    it('object with non-string code → default', () => {
      expect(friendlyAuthError({ code: 12345 }).message).toBe(DEFAULT_FR);
    });
  });

  describe('code extraction from various error shapes', () => {
    it('Firebase-shaped: { code: "auth/wrong-password" }', () => {
      expect(friendlyAuthError({ code: 'auth/wrong-password' }).message).toBe('Mot de passe incorrect');
    });
    it('bare string', () => {
      expect(friendlyAuthError('auth/weak-password').message).toBe('Mot de passe trop faible (minimum 8 caractères)');
    });
    it('Error with code embedded in message', () => {
      const err = new Error('Firebase: Error (auth/invalid-email).');
      expect(friendlyAuthError(err).message).toBe("Format d'email invalide");
    });
    it('object with code property and unrelated message', () => {
      const err = { code: 'auth/too-many-requests', message: 'something unrelated' };
      expect(friendlyAuthError(err).message).toBe('Trop de tentatives. Réessayez dans quelques minutes.');
    });
  });

  describe('localisation: EN and AR translations', () => {
    it('returns English text when lang="en"', () => {
      const r = friendlyAuthError({ code: 'auth/wrong-password' }, 'en');
      expect(r.message).toBe('Incorrect password');
    });
    it('returns Arabic text when lang="ar"', () => {
      const r = friendlyAuthError({ code: 'auth/wrong-password' }, 'ar');
      expect(r.message).toBe('كلمة المرور غير صحيحة');
    });
    it('every mapped code has a non-empty translation in all three languages', () => {
      for (const code of AUTH_ERROR_CODES) {
        const entry = _AUTH_ERROR_TABLE[code];
        expect(entry, `missing entry for ${code}`).toBeTruthy();
        expect(entry.fr, `missing FR for ${code}`).toBeTruthy();
        expect(entry.en, `missing EN for ${code}`).toBeTruthy();
        expect(entry.ar, `missing AR for ${code}`).toBeTruthy();
      }
    });
    it('unknown code falls back to default in EN', () => {
      expect(friendlyAuthError({ code: 'auth/foo' }, 'en').message).toBe('An error occurred. Please try again.');
    });
    it('unknown code falls back to default in AR', () => {
      expect(friendlyAuthError({ code: 'auth/foo' }, 'ar').message).toBe('حدث خطأ. حاول مرة أخرى.');
    });
  });

  describe('AUTH_ERROR_CODES export', () => {
    it('covers all 9 codes required by the brief', () => {
      const required = [
        'auth/wrong-password',
        'auth/user-not-found',
        'auth/invalid-credential',
        'auth/email-already-in-use',
        'auth/weak-password',
        'auth/invalid-email',
        'auth/too-many-requests',
        'auth/network-request-failed',
        'auth/requires-recent-login',
      ];
      for (const code of required) {
        expect(AUTH_ERROR_CODES).toContain(code);
      }
    });
  });
});
