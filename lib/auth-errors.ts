/**
 * Friendly French translations for Firebase Auth error codes.
 *
 * Firebase throws errors with a `code` like `auth/wrong-password`. The raw
 * code is fine for logs but useless to a French-speaking user. This module
 * is the single source of truth for converting those codes into a:
 *  - human-readable message (FR, EN, AR available),
 *  - optional `field` hint so the caller can highlight the offending input.
 *
 * Default behaviour (FR) is exported as `friendlyAuthError`. The EN/AR
 * tables are exported for tests + consumers wired into the i18n layer.
 */

export type AuthErrorField = 'email' | 'password' | 'phone' | null;

export interface FriendlyAuthError {
  field?: AuthErrorField;
  message: string;
}

/* The mapping table. Each entry has:
 *   - field: which input (if any) is to blame
 *   - fr/en/ar: localised user-facing message
 *
 * Keep this list in sync with EN/AR translations added to lib/i18n-platform.ts. */
interface AuthErrorEntry {
  field: AuthErrorField;
  fr: string;
  en: string;
  ar: string;
}

const TABLE: Record<string, AuthErrorEntry> = {
  'auth/wrong-password': {
    field: 'password',
    fr: 'Mot de passe incorrect',
    en: 'Incorrect password',
    ar: 'كلمة المرور غير صحيحة',
  },
  'auth/user-not-found': {
    field: 'email',
    fr: 'Aucun compte avec cet email',
    en: 'No account with this email',
    ar: 'لا يوجد حساب بهذا البريد الإلكتروني',
  },
  'auth/invalid-credential': {
    // Firebase v9+ collapses wrong-password and user-not-found into this
    // single code for security. We can't be sure which field is at fault,
    // but `password` is the more useful hint visually (red-borders the
    // password field) than nothing.
    field: 'password',
    fr: 'Identifiants invalides',
    en: 'Invalid credentials',
    ar: 'بيانات تسجيل الدخول غير صالحة',
  },
  'auth/invalid-login-credentials': {
    /* Alias used by some Firebase Auth versions */
    field: 'password',
    fr: 'Identifiants invalides',
    en: 'Invalid credentials',
    ar: 'بيانات تسجيل الدخول غير صالحة',
  },
  'auth/email-already-in-use': {
    field: 'email',
    fr: 'Cet email est déjà utilisé',
    en: 'This email is already in use',
    ar: 'هذا البريد الإلكتروني مستخدم بالفعل',
  },
  'auth/weak-password': {
    field: 'password',
    fr: 'Mot de passe trop faible (minimum 8 caractères)',
    en: 'Password too weak (minimum 8 characters)',
    ar: 'كلمة المرور ضعيفة (8 أحرف على الأقل)',
  },
  'auth/invalid-email': {
    field: 'email',
    fr: "Format d'email invalide",
    en: 'Invalid email format',
    ar: 'تنسيق البريد الإلكتروني غير صالح',
  },
  'auth/missing-email': {
    field: 'email',
    fr: "Veuillez saisir votre email",
    en: 'Please enter your email',
    ar: 'الرجاء إدخال بريدك الإلكتروني',
  },
  'auth/missing-password': {
    field: 'password',
    fr: 'Veuillez saisir votre mot de passe',
    en: 'Please enter your password',
    ar: 'الرجاء إدخال كلمة المرور',
  },
  'auth/invalid-phone-number': {
    field: 'phone',
    fr: 'Numéro de téléphone invalide',
    en: 'Invalid phone number',
    ar: 'رقم الهاتف غير صالح',
  },
  'auth/too-many-requests': {
    field: null,
    fr: 'Trop de tentatives. Réessayez dans quelques minutes.',
    en: 'Too many attempts. Try again in a few minutes.',
    ar: 'محاولات كثيرة. حاول مرة أخرى بعد بضع دقائق.',
  },
  'auth/network-request-failed': {
    field: null,
    fr: 'Connexion internet instable. Réessayez.',
    en: 'Unstable internet connection. Please try again.',
    ar: 'اتصال إنترنت غير مستقر. حاول مرة أخرى.',
  },
  'auth/requires-recent-login': {
    field: null,
    fr: 'Veuillez vous reconnecter pour effectuer cette action',
    en: 'Please sign in again to perform this action',
    ar: 'يرجى تسجيل الدخول مرة أخرى للقيام بهذا الإجراء',
  },
  'auth/user-disabled': {
    field: null,
    fr: 'Ce compte a été désactivé',
    en: 'This account has been disabled',
    ar: 'تم تعطيل هذا الحساب',
  },
  'auth/popup-closed-by-user': {
    field: null,
    fr: 'Fenêtre fermée avant la fin de la connexion',
    en: 'Window closed before sign-in completed',
    ar: 'تم إغلاق النافذة قبل اكتمال تسجيل الدخول',
  },
  'auth/popup-blocked': {
    field: null,
    fr: 'La fenêtre de connexion a été bloquée par votre navigateur',
    en: 'Sign-in popup was blocked by your browser',
    ar: 'تم حظر نافذة تسجيل الدخول بواسطة المتصفح',
  },
  'auth/account-exists-with-different-credential': {
    field: 'email',
    fr: 'Un compte existe déjà avec cet email via un autre fournisseur',
    en: 'An account already exists with this email under a different provider',
    ar: 'يوجد حساب مسجّل بهذا البريد عبر مزود آخر',
  },
};

const DEFAULT_ENTRY: AuthErrorEntry = {
  field: null,
  fr: 'Une erreur est survenue. Réessayez.',
  en: 'An error occurred. Please try again.',
  ar: 'حدث خطأ. حاول مرة أخرى.',
};

/* Internal helper: pull the Firebase error code out of an unknown value.
 * Firebase throws FirebaseError with a `.code` string. Sometimes wrapped
 * (e.g. by Functions or our own try/catch). Be defensive. */
function extractCode(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const anyErr = err as { code?: unknown; message?: unknown };
    if (typeof anyErr.code === 'string') return anyErr.code;
    if (typeof anyErr.message === 'string') {
      /* Some SDK errors put `auth/foo` in the message. Try to extract. */
      const m = anyErr.message.match(/auth\/[a-z0-9-]+/i);
      if (m) return m[0];
    }
  }
  return '';
}

/**
 * Translate an unknown Firebase Auth error into a UI-ready message.
 * Defaults to French. Pass `'en'` or `'ar'` for the other supported langs.
 *
 * @example
 *   try { await signInWithEmailAndPassword(...); }
 *   catch (err) {
 *     const { field, message } = friendlyAuthError(err);
 *     // field === 'password', message === 'Mot de passe incorrect'
 *   }
 */
export function friendlyAuthError(
  err: unknown,
  lang: 'fr' | 'en' | 'ar' = 'fr',
): FriendlyAuthError {
  const code = extractCode(err);
  const entry = TABLE[code] || DEFAULT_ENTRY;
  return {
    field: entry.field,
    message: entry[lang],
  };
}

/* For tests + i18n integration. */
export const AUTH_ERROR_CODES = Object.keys(TABLE);
export { TABLE as _AUTH_ERROR_TABLE };
