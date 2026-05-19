/**
 * scripts/seed-test-accounts.ts
 *
 * Crée un jeu de comptes de test après une purge:
 *   - 1 super-admin
 *   - 3 clients
 *   - 6 artisans (4 vérifiés, 2 non-vérifiés) dans différentes wilayas
 *     et métiers
 *   - Quelques posts, une mission, une story, un follow
 *
 * Tous les mots de passe sont les mêmes (configurable via env
 * SEED_PASSWORD, défaut "Test123!Maawa") pour faciliter les démos.
 * Les emails suivent le schéma `<role>-<n>@maawa.test`.
 *
 * Idempotent: si un compte existe déjà avec l'email cible, on le
 * réutilise (fetch then upsert) plutôt que de créer un doublon.
 *
 * Usage:
 *   npm run seed:test-accounts
 *
 * À lancer APRÈS purge-all-data, pas avant.
 */

import 'dotenv/config';
import * as admin from 'firebase-admin';

/* ── Init ─────────────────────────────────────────────────────── */

import * as fs from 'node:fs';

function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const keyPath = '/Users/talebhoussam/Downloads/maawa-baa09-firebase-adminsdk-fbsvc-4aaa8a62b2.json';
  if (fs.existsSync(keyPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      return admin.initializeApp({
        credential: admin.credential.cert(creds),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${creds.project_id}.appspot.com`,
      });
    } catch (err) {
      console.warn('⚠️ Erreur lors de la lecture du fichier de clé direct, repli sur env:', err);
    }
  }
  
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    .replace(/^"/, '')
    .replace(/"$/, '');

  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    || `${projectId}.appspot.com`;

  if (projectId && clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  }

  const credsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!credsJson) {
    console.error('❌ FIREBASE_ADMIN_CREDENTIALS ou variables individuelles manquantes');
    process.exit(1);
  }
  const creds = JSON.parse(credsJson);
  return admin.initializeApp({
    credential: admin.credential.cert(creds),
    storageBucket,
  });
}

const PASSWORD = process.env.SEED_PASSWORD || 'Test123!Maawa';

/* ── Définition des comptes ───────────────────────────────────── */

interface SeedAccount {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'admin' | 'client' | 'artisan';
  adminTier?: 'super' | 'manager' | 'ops';
  wilaya: string;
  trade?: string;     /* artisans uniquement */
  verified?: boolean; /* artisans uniquement */
  available?: boolean;
  rating?: number;
  experience?: number;
  bio?: string;
}

const ACCOUNTS: SeedAccount[] = [
  /* Admin */
  {
    email: 'admin@maawa.test',
    displayName: 'Admin Maawa',
    firstName: 'Admin',
    lastName: 'Maawa',
    phone: '+213500000001',
    role: 'admin',
    adminTier: 'super',
    wilaya: '16 - Alger',
  },

  /* Clients */
  {
    email: 'client-1@maawa.test',
    displayName: 'Amina Benali',
    firstName: 'Amina',
    lastName: 'Benali',
    phone: '+213501000001',
    role: 'client',
    wilaya: '16 - Alger',
  },
  {
    email: 'client-2@maawa.test',
    displayName: 'Yacine Cherif',
    firstName: 'Yacine',
    lastName: 'Cherif',
    phone: '+213501000002',
    role: 'client',
    wilaya: '31 - Oran',
  },
  {
    email: 'client-3@maawa.test',
    displayName: 'Sara Mansouri',
    firstName: 'Sara',
    lastName: 'Mansouri',
    phone: '+213501000003',
    role: 'client',
    wilaya: '25 - Constantine',
  },

  /* Artisans vérifiés */
  {
    email: 'artisan-1@maawa.test',
    displayName: 'Karim Plombier',
    firstName: 'Karim',
    lastName: 'Hadj',
    phone: '+213502000001',
    role: 'artisan',
    wilaya: '16 - Alger',
    trade: 'Plombier',
    verified: true,
    available: true,
    rating: 4.8,
    experience: 12,
    bio: 'Plombier professionnel à Alger. Interventions rapides 7j/7. Spécialiste fuites et installations sanitaires.',
  },
  {
    email: 'artisan-2@maawa.test',
    displayName: 'Mohamed Électricien',
    firstName: 'Mohamed',
    lastName: 'Ali',
    phone: '+213502000002',
    role: 'artisan',
    wilaya: '16 - Alger',
    trade: 'Électricien',
    verified: true,
    available: true,
    rating: 4.9,
    experience: 15,
    bio: 'Électricien certifié. Tableaux électriques, prises, éclairage, dépannage urgent.',
  },
  {
    email: 'artisan-3@maawa.test',
    displayName: 'Rachid Menuisier',
    firstName: 'Rachid',
    lastName: 'Saadi',
    phone: '+213502000003',
    role: 'artisan',
    wilaya: '31 - Oran',
    trade: 'Menuisier',
    verified: true,
    available: true,
    rating: 4.7,
    experience: 20,
    bio: 'Menuisier ébéniste. Meubles sur mesure, portes, fenêtres, parquet.',
  },
  {
    email: 'artisan-4@maawa.test',
    displayName: 'Samira Peintre',
    firstName: 'Samira',
    lastName: 'Boudjedra',
    phone: '+213502000004',
    role: 'artisan',
    wilaya: '25 - Constantine',
    trade: 'Peintre',
    verified: true,
    available: true,
    rating: 4.6,
    experience: 8,
    bio: 'Peintre en bâtiment. Intérieur, extérieur, façades. Devis gratuit.',
  },

  /* Artisans non vérifiés (en attente de validation NIN) */
  {
    email: 'artisan-5@maawa.test',
    displayName: 'Toufik Carreleur',
    firstName: 'Toufik',
    lastName: 'Brahim',
    phone: '+213502000005',
    role: 'artisan',
    wilaya: '06 - Béjaïa',
    trade: 'Carreleur',
    verified: false,
    available: true,
    rating: 0,
    experience: 5,
    bio: 'Carreleur, faïenceur. Salle de bain, cuisine, terrasse.',
  },
  {
    email: 'artisan-6@maawa.test',
    displayName: 'Nadia Couturière',
    firstName: 'Nadia',
    lastName: 'Benhamou',
    phone: '+213502000006',
    role: 'artisan',
    wilaya: '09 - Blida',
    trade: 'Couturière',
    verified: false,
    available: true,
    rating: 0,
    experience: 10,
    bio: 'Couturière à domicile. Retouches, robes traditionnelles, rideaux.',
  },
];

/* ── Création / upsert d'un compte ────────────────────────────── */

async function upsertAccount(acc: SeedAccount): Promise<string> {
  /* 1. Compte Firebase Auth (idempotent). */
  let uid: string;
  try {
    const existing = await admin.auth().getUserByEmail(acc.email);
    uid = existing.uid;
    /* Mettre le mot de passe à jour au cas où il aurait changé. */
    await admin.auth().updateUser(uid, {
      password: PASSWORD,
      displayName: acc.displayName,
      phoneNumber: acc.phone,
      disabled: false,
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
    const created = await admin.auth().createUser({
      email: acc.email,
      password: PASSWORD,
      displayName: acc.displayName,
      phoneNumber: acc.phone,
      emailVerified: true, /* on saute le flow OTP pour les comptes de test */
    });
    uid = created.uid;
  }

  /* 2. Custom claims pour les admins. */
  if (acc.role === 'admin') {
    await admin.auth().setCustomUserClaims(uid, {
      admin: true,
      role: acc.adminTier ?? 'super',
    });
  } else {
    /* Reset les claims si jamais on réutilise un UID. */
    await admin.auth().setCustomUserClaims(uid, {});
  }

  /* 3. Doc Firestore /users/{uid}. */
  const now = admin.firestore.Timestamp.now();
  const userDoc: Record<string, unknown> = {
    uid,
    email:        acc.email,
    firstName:    acc.firstName,
    lastName:     acc.lastName,
    displayName:  acc.displayName,
    phone:        acc.phone,
    wilaya:       acc.wilaya,
    role:         acc.role,
    verified:     acc.verified ?? false,
    banned:       false,
    available:    acc.available ?? true,
    createdAt:    now,
    updatedAt:    now,
  };
  if (acc.role === 'artisan') {
    userDoc.trade        = acc.trade ?? null;
    userDoc.rating       = acc.rating ?? 0;
    userDoc.experience   = acc.experience ?? 0;
    userDoc.bio          = acc.bio ?? null;
    userDoc.missionsCount = 0;
    userDoc.reviewCount   = 0;
    userDoc.payableBalance = 0;
  }
  await admin.firestore().collection('users').doc(uid).set(userDoc, { merge: true });

  /* 4. Thread Maawa Support (créé normalement par /api/me/register-profile,
        on le reproduit ici pour avoir tous les éléments dès le seed). */
  if (acc.role !== 'admin') {
    const supportChatId = `maawa-support_${uid}`;
    await admin.firestore().collection('chats').doc(supportChatId).set({
      participants:   [uid, '_maawa_support'],
      isSupport:      true,
      lastMessage:    null,
      lastMessageAt:  now,
      unread:         { [uid]: 0, _maawa_support: 0 },
      createdAt:      now,
      updatedAt:      now,
    }, { merge: true });
  }

  return uid;
}

/* ── Contenu de démonstration (posts + mission + follow) ─────── */

async function seedContent(accountsByEmail: Map<string, string>) {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const karim   = accountsByEmail.get('artisan-1@maawa.test')!;
  const mohamed = accountsByEmail.get('artisan-2@maawa.test')!;
  const rachid  = accountsByEmail.get('artisan-3@maawa.test')!;
  const samira  = accountsByEmail.get('artisan-4@maawa.test')!;
  const amina   = accountsByEmail.get('client-1@maawa.test')!;
  const yacine  = accountsByEmail.get('client-2@maawa.test')!;

  /* Posts du feed — un par artisan vérifié pour avoir une page d'accueil
     vivante dès le premier affichage. */
  const posts = [
    {
      authorId: karim, artisan: 'Karim Plombier', trade: 'Plombier',
      wilaya: '16 - Alger', verified: true,
      type: 'post',
      title: 'Rénovation salle de bain complète',
      text: 'Rénovation complète d\'une salle de bain à Hydra. Plomberie, faïence et nouvelle robinetterie. Livrée en 4 jours.',
      category: 'Plomberie',
      likes: 12,
    },
    {
      authorId: mohamed, artisan: 'Mohamed Électricien', trade: 'Électricien',
      wilaya: '16 - Alger', verified: true,
      type: 'post',
      title: 'Mise aux normes tableau électrique',
      text: 'Remplacement complet d\'un tableau électrique pour un appartement F4 à Bab Ezzouar. Sécurité avant tout.',
      category: 'Électricité',
      likes: 8,
    },
    {
      authorId: rachid, artisan: 'Rachid Menuisier', trade: 'Menuisier',
      wilaya: '31 - Oran', verified: true,
      type: 'post',
      title: 'Cuisine sur mesure en chêne massif',
      text: 'Réalisation d\'une cuisine équipée sur mesure, finition chêne massif huilé. 3 semaines de travail.',
      category: 'Menuiserie',
      likes: 24,
    },
    {
      authorId: samira, artisan: 'Samira Peintre', trade: 'Peintre',
      wilaya: '25 - Constantine', verified: true,
      type: 'post',
      title: 'Façade rénovée d\'une villa',
      text: 'Ravalement complet de façade avec enduit décoratif. Avant/après spectaculaire.',
      category: 'Peinture',
      likes: 17,
    },
  ];

  for (const p of posts) {
    await db.collection('feed_posts').add({
      ...p,
      sponsored: false,
      createdAt: now,
    });
  }
  console.log(`   ✅ ${posts.length} posts créés.`);

  /* Une story texte côté Karim — 24h de durée. */
  const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);
  await db.collection('stories').add({
    userId:    karim,
    kind:      'text',
    mediaUrl:  null,
    text:      'Disponible aujourd\'hui pour interventions urgentes sur Alger 🛠️',
    gradient:  1,
    views:     0,
    createdAt: now,
    expiresAt,
  });
  console.log('   ✅ 1 story créée (Karim, expire dans 24h).');

  /* Une mission "pending" — Amina cherche un plombier à Alger.
     Aucun artisan assigné, statut pending → visible dans
     /artisan/bookings pour tout artisan plombier d'Alger. */
  await db.collection('missions').add({
    clientId:    amina,
    service:     'Réparation fuite cuisine',
    description: 'Fuite sous l\'évier de la cuisine depuis ce matin. Eau qui coule en continu, besoin d\'une intervention rapide.',
    wilaya:      '16 - Alger',
    address:     'Hydra, Alger',
    amount:      8000,
    urgency:     'Urgent',
    status:      'pending',
    artisanId:   null,
    createdAt:   now,
    updatedAt:   now,
  });

  /* Une mission "confirmée" entre Yacine et Rachid. */
  await db.collection('missions').add({
    clientId:    yacine,
    artisanId:   rachid,
    service:     'Pose parquet salon',
    description: 'Pose de parquet flottant dans un salon de 35m². Matériel fourni.',
    wilaya:      '31 - Oran',
    address:     'Bir El Djir, Oran',
    amount:      45000,
    status:      'confirmed',
    confirmedAt: now,
    assignedAt:  now,
    createdAt:   admin.firestore.Timestamp.fromMillis(now.toMillis() - 2 * 24 * 60 * 60 * 1000),
    updatedAt:   now,
  });
  console.log('   ✅ 2 missions créées (1 pending, 1 confirmée).');

  /* Un follow: Amina suit Karim → permet de tester la tab "Suivis". */
  await db.collection('follows').doc(`${amina}_${karim}`).set({
    followerId:  amina,
    followingId: karim,
    createdAt:   now,
  });
  console.log('   ✅ 1 follow créé (Amina → Karim).');
}

/* ── Main ─────────────────────────────────────────────────────── */

async function main() {
  initAdmin();
  console.log('\n🌱 Seed des comptes de test\n');

  const accountsByEmail = new Map<string, string>();

  for (const acc of ACCOUNTS) {
    const uid = await upsertAccount(acc);
    accountsByEmail.set(acc.email, uid);
    const tier = acc.role === 'admin' ? ` [${acc.adminTier}]`
      : acc.role === 'artisan' ? (acc.verified ? ' [vérifié]' : ' [non-vérifié]')
      : '';
    console.log(`   ✅ ${acc.role.padEnd(7)} ${acc.email.padEnd(28)} → ${uid}${tier}`);
  }

  console.log('\n📝 Contenu de démonstration…');
  await seedContent(accountsByEmail);

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ SEED TERMINÉ');
  console.log('═'.repeat(60));
  console.log(`  ${ACCOUNTS.length} comptes créés.`);
  console.log(`  Mot de passe (tous comptes): ${PASSWORD}`);
  console.log('\n  Connecte-toi avec:');
  console.log('    • admin@maawa.test       (super-admin)');
  console.log('    • client-1@maawa.test    (Amina, Alger)');
  console.log('    • artisan-1@maawa.test   (Karim Plombier, Alger, vérifié)');
  console.log('    • artisan-5@maawa.test   (Toufik Carreleur, Béjaïa, non-vérifié)');
  console.log('═'.repeat(60) + '\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Erreur fatale:', err);
  process.exit(1);
});
