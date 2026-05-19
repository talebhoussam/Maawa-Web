/**
 * Wilaya capital coordinates.
 *
 * One {lat, lng} per wilaya pointing at its capital city. Used by the
 * /explore map to drop pins for artisans whose user doc only stores
 * a wilaya label (the common case — we don't ask artisans to drop a
 * pin during registration).
 *
 * Coordinates are the capital city centers per the Algerian government
 * official register. Rounded to 4 decimals (~11 m accuracy — well more
 * than needed for "show this artisan is in this wilaya").
 *
 * Lookup is by zero-padded two-digit code. Use `wilayaCentroid()` which
 * accepts any of our stored shapes ("16 - Alger" / "Alger" / "16") and
 * returns null for unknown values.
 */

import { parseWilaya } from './wilayas';

export const WILAYA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  '01': { lat: 27.8744, lng: -0.2934 }, // Adrar
  '02': { lat: 36.1641, lng:  1.3317 }, // Chlef
  '03': { lat: 34.8419, lng:  5.7308 }, // Laghouat
  '04': { lat: 35.8753, lng:  7.1095 }, // Oum El Bouaghi
  '05': { lat: 35.5559, lng:  6.1741 }, // Batna
  '06': { lat: 36.7525, lng:  5.0556 }, // Béjaïa
  '07': { lat: 34.8500, lng:  5.7333 }, // Biskra
  '08': { lat: 31.6177, lng: -2.2289 }, // Béchar
  '09': { lat: 36.4700, lng:  2.8278 }, // Blida
  '10': { lat: 36.4500, lng:  3.9000 }, // Bouira
  '11': { lat: 22.7903, lng:  5.5267 }, // Tamanrasset
  '12': { lat: 35.4044, lng:  8.1167 }, // Tébessa
  '13': { lat: 34.8783, lng: -1.3150 }, // Tlemcen
  '14': { lat: 35.3711, lng:  1.3170 }, // Tiaret
  '15': { lat: 36.7167, lng:  4.0500 }, // Tizi Ouzou
  '16': { lat: 36.7525, lng:  3.0420 }, // Alger
  '17': { lat: 34.6692, lng:  3.2517 }, // Djelfa
  '18': { lat: 36.8211, lng:  5.7667 }, // Jijel
  '19': { lat: 36.1900, lng:  5.4100 }, // Sétif
  '20': { lat: 34.8333, lng:  0.1500 }, // Saïda
  '21': { lat: 36.8800, lng:  6.9075 }, // Skikda
  '22': { lat: 35.2050, lng: -0.6406 }, // Sidi Bel Abbès
  '23': { lat: 36.9000, lng:  7.7667 }, // Annaba
  '24': { lat: 36.4503, lng:  7.4356 }, // Guelma
  '25': { lat: 36.3650, lng:  6.6147 }, // Constantine
  '26': { lat: 36.2647, lng:  2.7531 }, // Médéa
  '27': { lat: 35.9311, lng:  0.0894 }, // Mostaganem
  '28': { lat: 35.7022, lng:  4.5419 }, // M'Sila
  '29': { lat: 35.4017, lng:  0.1467 }, // Mascara
  '30': { lat: 32.4842, lng:  3.6731 }, // Ouargla
  '31': { lat: 35.6911, lng: -0.6417 }, // Oran
  '32': { lat: 33.6800, lng:  1.0167 }, // El Bayadh
  '33': { lat: 26.4844, lng:  8.4467 }, // Illizi
  '34': { lat: 36.0628, lng:  4.7611 }, // Bordj Bou Arréridj
  '35': { lat: 36.7639, lng:  3.4717 }, // Boumerdès
  '36': { lat: 36.8961, lng:  8.2461 }, // El Tarf
  '37': { lat: 27.6711, lng:  8.1278 }, // Tindouf
  '38': { lat: 35.5947, lng:  1.3214 }, // Tissemsilt
  '39': { lat: 33.7064, lng:  6.8675 }, // El Oued
  '40': { lat: 35.4267, lng:  7.1428 }, // Khenchela
  '41': { lat: 35.8772, lng:  7.7944 }, // Souk Ahras
  '42': { lat: 36.5736, lng:  2.4233 }, // Tipaza
  '43': { lat: 36.4664, lng:  6.2647 }, // Mila
  '44': { lat: 36.2647, lng:  1.9686 }, // Aïn Defla
  '45': { lat: 32.7567, lng: -0.5675 }, // Naâma
  '46': { lat: 35.2972, lng: -1.1389 }, // Aïn Témouchent
  '47': { lat: 32.4881, lng:  3.6781 }, // Ghardaïa
  '48': { lat: 35.7311, lng:  0.5572 }, // Relizane
  '49': { lat: 29.2500, lng:  0.2833 }, // Timimoun
  '50': { lat: 27.2461, lng: -0.1719 }, // Bordj Badji Mokhtar
  '51': { lat: 33.1000, lng:  6.0667 }, // Ouled Djellal
  '52': { lat: 30.5715, lng:  2.8650 }, // Béni Abbès
  '53': { lat: 27.6708, lng:  8.1278 }, // In Salah
  '54': { lat: 19.0570, lng:  5.7370 }, // In Guezzam
  '55': { lat: 33.4647, lng:  6.0578 }, // Touggourt
  '56': { lat: 26.4844, lng:  8.4467 }, // Djanet
  '57': { lat: 34.9133, lng:  5.3050 }, // El M'Ghair
  '58': { lat: 29.7811, lng:  6.0856 }, // El Meniaa
};

export function wilayaCentroid(raw?: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  const parsed = parseWilaya(raw);
  if (!parsed?.code) return null;
  return WILAYA_CENTROIDS[parsed.code] ?? null;
}
