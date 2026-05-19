/**
 * scripts/purge-all-data.ts
 *
 * PURGE COMPLÈTE — supprime TOUTES les données de production:
 *   - Tous les comptes Firebase Auth
 *   - Toutes les collections Firestore (y compris les sous-collections)
 *   - Tous les fichiers Cloud Storage
 *
 * IRRÉVERSIBLE. Aucune corbeille. Faire un backup AVANT.
 *
 * Usage:
 *   npm run purge:production
 *
 * Deux confirmations textuelles requises:
 *   1. Taper exactement le projectId Firebase
 *   2. Taper exactement "PURGE PRODUCTION"
 *
 * Le script n'est JAMAIS exposé via HTTP. Exécution locale uniquement,
 * avec les credentials admin dans .env.local.
 */

import 'dotenv/config';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as admin from 'firebase-admin';

/* ── Initialisation Firebase Admin ─────────────────────────────── */

function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const credsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!credsJson) {
    console.error('❌ FIREBASE_ADMIN_CREDENTIALS manquant dans .env.local');
    process.exit(1);
  }

  let creds: admin.ServiceAccount;
  try {
    creds = JSON.parse(credsJson);
  } catch {
    console.error('❌ FIREBASE_ADMIN_CREDENTIALS n\'est pas du JSON valide');
    process.exit(1);
  }

  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    || `${(creds as { project_id?: string }).project_id}.appspot.com`;

  return admin.initializeApp({
    credential: admin.credential.cert(creds),
    storageBucket,
  });
}

/* ── Confirmations interactives ───────────────────────────────── */

async function confirm(): Promise<void> {
  const app = initAdmin();
  const projectId = app.options.projectId ?? 'INCONNU';

  console.log('\n' + '═'.repeat(60));
  console.log('  🔥 PURGE COMPLÈTE DE PRODUCTION 🔥');
  console.log('═'.repeat(60));
  console.log(`  Projet Firebase  : ${projectId}`);
  console.log(`  Storage bucket   : ${app.options.storageBucket}`);
  console.log('═'.repeat(60));
  console.log('  Cette opération supprime DÉFINITIVEMENT:');
  console.log('  • Tous les comptes utilisateur (y compris admins)');
  console.log('  • Toutes les collections Firestore');
  console.log('  • Tous les fichiers Cloud Storage');
  console.log('  Aucune corbeille. Aucun retour en arrière.');
  console.log('═'.repeat(60) + '\n');

  const rl = readline.createInterface({ input, output });
  try {
    const a1 = await rl.question(`1/2 — Tape le projectId exact pour confirmer la cible:\n> `);
    if (a1.trim() !== projectId) {
      console.log('\n❌ projectId incorrect — purge annulée.');
      process.exit(0);
    }

    const a2 = await rl.question(`\n2/2 — Tape exactement "PURGE PRODUCTION" pour confirmer:\n> `);
    if (a2.trim() !== 'PURGE PRODUCTION') {
      console.log('\n❌ Phrase incorrecte — purge annulée.');
      process.exit(0);
    }
  } finally {
    rl.close();
  }

  console.log('\n✅ Confirmations validées. Démarrage de la purge dans 5 secondes…');
  console.log('   (Ctrl+C maintenant pour annuler)\n');
  await new Promise(r => setTimeout(r, 5000));
}

/* ── 1. Suppression des comptes Firebase Auth ─────────────────── */

async function purgeAuth(): Promise<number> {
  console.log('🔐 [1/3] Suppression des comptes Firebase Auth…');
  let total = 0;
  let nextPageToken: string | undefined;

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    if (result.users.length === 0) break;

    /* deleteUsers prend max 1000 UIDs à la fois — pile la taille de
       la page de listUsers, donc on peut appeler directement. */
    const uids = result.users.map(u => u.uid);
    const delResult = await admin.auth().deleteUsers(uids);
    total += delResult.successCount;

    if (delResult.failureCount > 0) {
      console.log(`   ⚠️  ${delResult.failureCount} échecs (probablement comptes déjà supprimés)`);
      for (const err of delResult.errors.slice(0, 3)) {
        console.log(`      • UID ${err.index}: ${err.error.message}`);
      }
    }

    process.stdout.write(`\r   Comptes supprimés: ${total}`);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  console.log(`\n   ✅ Total: ${total} comptes supprimés.\n`);
  return total;
}

/* ── 2. Suppression des collections Firestore ─────────────────── */

const ROOT_COLLECTIONS = [
  'users',
  'feed_posts',
  'stories',
  'follows',
  'saved',
  'notifications',
  'chats',
  'missions',
  'transactions',
  'coin_purchase_requests',
  'payout_requests',
  'applications',
  'reports',
  'audit_logs',
];

/* Sous-collections à nettoyer explicitement (Firestore ne supprime
   pas les sous-collections quand on supprime le doc parent). */
const SUB_COLLECTIONS: Array<{ parent: string; sub: string }> = [
  { parent: 'feed_posts', sub: 'comments' },
  { parent: 'stories',    sub: 'viewers'  },
  { parent: 'chats',      sub: 'messages' },
  { parent: 'missions',   sub: 'declines' },
];

async function deleteQueryBatch(
  query: admin.firestore.Query,
  collectionLabel: string,
): Promise<number> {
  let total = 0;
  while (true) {
    const snap = await query.limit(500).get();
    if (snap.size === 0) return total;

    const batch = admin.firestore().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    total += snap.size;
    process.stdout.write(`\r   ${collectionLabel}: ${total} docs supprimés`);

    if (snap.size < 500) return total;
  }
}

async function purgeFirestore(): Promise<Record<string, number>> {
  console.log('📦 [2/3] Suppression des collections Firestore…');
  const counts: Record<string, number> = {};
  const db = admin.firestore();

  /* On supprime d'abord les sous-collections (sinon elles deviennent
     orphelines une fois le parent supprimé). Pour chaque parent on
     parcourt les docs et on vide leurs sous-collections. */
  for (const { parent, sub } of SUB_COLLECTIONS) {
    let subTotal = 0;
    const parentDocs = await db.collection(parent).select().get();
    for (const parentDoc of parentDocs.docs) {
      const subRef = parentDoc.ref.collection(sub);
      subTotal += await deleteQueryBatch(subRef, `${parent}/*/${sub}`);
    }
    counts[`${parent}/*/${sub}`] = subTotal;
    console.log(`\n   ✅ Sous-collection ${parent}/*/${sub}: ${subTotal} docs.`);
  }

  /* Puis les collections racines. */
  for (const name of ROOT_COLLECTIONS) {
    const total = await deleteQueryBatch(db.collection(name), name);
    counts[name] = total;
    console.log(`\n   ✅ ${name}: ${total} docs.`);
  }

  return counts;
}

/* ── 3. Suppression des fichiers Cloud Storage ───────────────── */

const STORAGE_PREFIXES = [
  'avatars/',
  'stories/',
  'reels/',
  'chats/',
  'applications/',
  'coin_proofs/',
  'feed_posts/',
];

async function purgeStorage(): Promise<Record<string, number>> {
  console.log('🗂️  [3/3] Suppression des fichiers Cloud Storage…');
  const bucket = admin.storage().bucket();
  const counts: Record<string, number> = {};

  for (const prefix of STORAGE_PREFIXES) {
    /* deleteFiles supprime tous les fichiers correspondant au prefix.
       On boucle aussi nous-mêmes par sécurité pour pouvoir compter. */
    const [files] = await bucket.getFiles({ prefix });
    if (files.length === 0) {
      counts[prefix] = 0;
      console.log(`   ${prefix}: 0 fichiers.`);
      continue;
    }
    process.stdout.write(`   ${prefix}: ${files.length} fichiers en cours de suppression…`);
    await bucket.deleteFiles({ prefix, force: true });
    counts[prefix] = files.length;
    console.log(` ✅`);
  }

  return counts;
}

/* ── Main ─────────────────────────────────────────────────────── */

async function main() {
  const start = Date.now();
  await confirm();

  const authCount = await purgeAuth();
  const fsCounts  = await purgeFirestore();
  const stCounts  = await purgeStorage();

  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ PURGE TERMINÉE');
  console.log('═'.repeat(60));
  console.log(`  Comptes Auth supprimés    : ${authCount}`);
  console.log(`  Firestore (toutes colls)  : ${Object.values(fsCounts).reduce((s, n) => s + n, 0)} docs`);
  console.log(`  Storage (tous préfixes)   : ${Object.values(stCounts).reduce((s, n) => s + n, 0)} fichiers`);
  console.log(`  Durée totale              : ${elapsedSec}s`);
  console.log('═'.repeat(60));
  console.log('\nProchaines étapes:');
  console.log('  1. Crée un compte sur /register avec ton email admin');
  console.log('  2. Récupère ton UID dans Firebase Console > Authentication');
  console.log('  3. Lance: npm run admin:bootstrap -- <uid> super');
  console.log('  4. Optionnel: npm run seed:test-accounts pour créer des comptes de démo\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Erreur fatale:', err);
  process.exit(1);
});
