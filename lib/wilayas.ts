/**
 * Algerian wilayas — single source of truth.
 *
 * Reflects the post-2019 administrative reorganisation: 58 wilayas total
 * (codes 01–58). Codes are zero-padded two-digit strings to match official
 * usage and existing Firestore data ("16 - Alger").
 *
 * Wilaya values stored in Firestore historically had varying shapes:
 *   - "16 - Alger" (most common, from the original register dropdown)
 *   - "Alger"     (older free-text inputs from /settings)
 *   - "16"        (rare, from admin imports)
 *   - undefined / empty
 *
 * The helpers below normalise reads against any of those shapes. New
 * writes should always use {@link displayLabel} (e.g. "16 - Alger") to
 * keep the dataset consistent.
 */

export interface Wilaya {
  /** Two-digit zero-padded code, "01"–"58". */
  code: string;
  /** French/Latin name (the canonical UI label). */
  name: string;
  /** Arabic name. */
  nameAr: string;
}

/* Order is by code. Names follow the Algerian government's official
   transliteration (with French accents where canonical). */
export const WILAYAS = [
  { code: '01', name: 'Adrar',              nameAr: 'أدرار' },
  { code: '02', name: 'Chlef',              nameAr: 'الشلف' },
  { code: '03', name: 'Laghouat',           nameAr: 'الأغواط' },
  { code: '04', name: 'Oum El Bouaghi',     nameAr: 'أم البواقي' },
  { code: '05', name: 'Batna',              nameAr: 'باتنة' },
  { code: '06', name: 'Béjaïa',             nameAr: 'بجاية' },
  { code: '07', name: 'Biskra',             nameAr: 'بسكرة' },
  { code: '08', name: 'Béchar',             nameAr: 'بشار' },
  { code: '09', name: 'Blida',              nameAr: 'البليدة' },
  { code: '10', name: 'Bouira',             nameAr: 'البويرة' },
  { code: '11', name: 'Tamanrasset',        nameAr: 'تمنراست' },
  { code: '12', name: 'Tébessa',            nameAr: 'تبسة' },
  { code: '13', name: 'Tlemcen',            nameAr: 'تلمسان' },
  { code: '14', name: 'Tiaret',             nameAr: 'تيارت' },
  { code: '15', name: 'Tizi Ouzou',         nameAr: 'تيزي وزو' },
  { code: '16', name: 'Alger',              nameAr: 'الجزائر' },
  { code: '17', name: 'Djelfa',             nameAr: 'الجلفة' },
  { code: '18', name: 'Jijel',              nameAr: 'جيجل' },
  { code: '19', name: 'Sétif',              nameAr: 'سطيف' },
  { code: '20', name: 'Saïda',              nameAr: 'سعيدة' },
  { code: '21', name: 'Skikda',             nameAr: 'سكيكدة' },
  { code: '22', name: 'Sidi Bel Abbès',     nameAr: 'سيدي بلعباس' },
  { code: '23', name: 'Annaba',             nameAr: 'عنابة' },
  { code: '24', name: 'Guelma',             nameAr: 'قالمة' },
  { code: '25', name: 'Constantine',        nameAr: 'قسنطينة' },
  { code: '26', name: 'Médéa',              nameAr: 'المدية' },
  { code: '27', name: 'Mostaganem',         nameAr: 'مستغانم' },
  { code: '28', name: "M'Sila",             nameAr: 'المسيلة' },
  { code: '29', name: 'Mascara',            nameAr: 'معسكر' },
  { code: '30', name: 'Ouargla',            nameAr: 'ورقلة' },
  { code: '31', name: 'Oran',               nameAr: 'وهران' },
  { code: '32', name: 'El Bayadh',          nameAr: 'البيض' },
  { code: '33', name: 'Illizi',             nameAr: 'إيليزي' },
  { code: '34', name: 'Bordj Bou Arréridj', nameAr: 'برج بوعريريج' },
  { code: '35', name: 'Boumerdès',          nameAr: 'بومرداس' },
  { code: '36', name: 'El Tarf',            nameAr: 'الطارف' },
  { code: '37', name: 'Tindouf',            nameAr: 'تندوف' },
  { code: '38', name: 'Tissemsilt',         nameAr: 'تيسمسيلت' },
  { code: '39', name: 'El Oued',            nameAr: 'الوادي' },
  { code: '40', name: 'Khenchela',          nameAr: 'خنشلة' },
  { code: '41', name: 'Souk Ahras',         nameAr: 'سوق أهراس' },
  { code: '42', name: 'Tipaza',             nameAr: 'تيبازة' },
  { code: '43', name: 'Mila',               nameAr: 'ميلة' },
  { code: '44', name: 'Aïn Defla',          nameAr: 'عين الدفلى' },
  { code: '45', name: 'Naâma',              nameAr: 'النعامة' },
  { code: '46', name: 'Aïn Témouchent',     nameAr: 'عين تموشنت' },
  { code: '47', name: 'Ghardaïa',           nameAr: 'غرداية' },
  { code: '48', name: 'Relizane',           nameAr: 'غليزان' },
  /* 2019 reorganisation — 10 new wilayas split off from southern provinces. */
  { code: '49', name: 'Timimoun',           nameAr: 'تيميمون' },
  { code: '50', name: 'Bordj Badji Mokhtar', nameAr: 'برج باجي مختار' },
  { code: '51', name: 'Ouled Djellal',      nameAr: 'أولاد جلال' },
  { code: '52', name: 'Béni Abbès',         nameAr: 'بني عباس' },
  { code: '53', name: 'In Salah',           nameAr: 'عين صالح' },
  { code: '54', name: 'In Guezzam',         nameAr: 'عين قزام' },
  { code: '55', name: 'Touggourt',          nameAr: 'تقرت' },
  { code: '56', name: 'Djanet',             nameAr: 'جانت' },
  { code: '57', name: "El M'Ghair",         nameAr: 'المغير' },
  { code: '58', name: 'El Meniaa',          nameAr: 'المنيعة' },
] as const satisfies readonly Wilaya[];

export type WilayaCode = typeof WILAYAS[number]['code'];

/**
 * Canonical display label for storage and rendering, e.g. "16 - Alger".
 * Use this when writing to Firestore so historical and future records
 * share a single shape.
 */
export function displayLabel(w: Wilaya): string {
  return `${w.code} - ${w.name}`;
}

/**
 * Lookup table by code for O(1) access.
 */
const BY_CODE: Readonly<Record<string, Wilaya>> = Object.freeze(
  Object.fromEntries(WILAYAS.map(w => [w.code, w])) as Record<string, Wilaya>,
);

/**
 * Best-effort parse of a stored wilaya value into a {@link Wilaya}.
 *
 * Accepts any of:
 *   - "16 - Alger"     → Alger
 *   - "16"             → Alger
 *   - "Alger"          → Alger
 *   - "alger"          → Alger (case-insensitive)
 *   - "الجزائر"        → Alger
 *   - undefined / ""   → undefined
 *
 * Returns `undefined` if no match is found, so callers can decide
 * whether to fall back to free-text rendering or hide the field.
 */
export function parseWilaya(input: string | undefined | null): Wilaya | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  /* "16 - Alger" or "16" — leading two-digit code wins. */
  const codeMatch = trimmed.match(/^(\d{1,2})\b/);
  if (codeMatch) {
    const code = codeMatch[1].padStart(2, '0');
    if (BY_CODE[code]) return BY_CODE[code];
  }

  /* Fallback: name match (case + accent insensitive on Latin names,
     exact match on Arabic). Light effort — production data should
     migrate to canonical labels. */
  const norm = trimmed.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const w of WILAYAS) {
    if (w.nameAr === trimmed) return w;
    const wn = w.name.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (wn === norm) return w;
  }
  return undefined;
}

/**
 * Pick the locale-correct name for a wilaya. Falls back to the French
 * name when AR isn't requested.
 */
export function localName(w: Wilaya, lang: 'fr' | 'en' | 'ar'): string {
  return lang === 'ar' ? w.nameAr : w.name;
}
