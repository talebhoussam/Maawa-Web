'use client';

import { useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function SeedDatabasePage() {
  const [status, setStatus] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const log = (msg: string) => setStatus(prev => [...prev, msg]);

  const runSeeder = async () => {
    setRunning(true);
    setStatus([]);
    const uid = auth.currentUser?.uid;
    if (!uid) {
      log('❌ Vous devez être connecté pour seeder.');
      setRunning(false);
      return;
    }

    try {
      log('🌱 Démarrage du seeder...');

      // Missions
      const missions = [
        { id: 'MW-1247', title: 'Réparation fuite salle de bain', location: 'Bab Ezzouar', date: '24/03/2026', status: 'sur_place', artisan: 'Karim Plombier', artisanId: 'artisan-001', clientId: uid, estimated: 9500 },
        { id: 'MW-1248', title: 'Installation électrique salon', location: 'Hydra', date: '25/03/2026', status: 'en_attente', artisan: 'Ali Électricien', artisanId: 'artisan-002', clientId: uid, estimated: 12000 },
        { id: 'MW-1241', title: 'Peinture salon + couloir', location: 'Hydra', date: '18/03/2026', status: 'en_dispatch', artisan: null, artisanId: null, clientId: uid, estimated: 35000 },
        { id: 'MW-1188', title: 'Débouchage évier cuisine', location: 'Alger-Centre', date: '10/03/2026', status: 'terminee', artisan: 'Karim Plombier', artisanId: 'artisan-001', clientId: uid, estimated: 4500 },
      ];
      for (const m of missions) {
        await setDoc(doc(collection(db, 'missions'), m.id), { ...m, createdAt: serverTimestamp() });
      }
      log(`✅ ${missions.length} missions seedées`);

      // Transactions
      const transactions = [
        { id: 'tx-1', type: 'credit', amount: 200, date: 'Hier', desc: 'Achat Chargily Pay', userId: uid },
        { id: 'tx-2', type: 'debit', amount: 50, date: 'Il y a 3j', desc: 'Boost Profil (48h)', userId: uid },
        { id: 'tx-3', type: 'credit', amount: 90, date: '15/03/2026', desc: 'Mission #MW-1188 — SafePay libéré', userId: uid },
        { id: 'tx-4', type: 'credit', amount: 30, date: '01/03/2026', desc: 'Bonus fidélité Mars', userId: uid },
      ];
      for (const tx of transactions) {
        await setDoc(doc(collection(db, 'transactions'), tx.id), { ...tx, createdAt: serverTimestamp() });
      }
      log(`✅ ${transactions.length} transactions seedées`);

      // Notifications
      const notifs = [
        { id: 'n1', title: 'Mission Validée', desc: 'Karim a marqué la mission comme terminée. Validez pour libérer le SafePay.', time: 'Il y a 2h', type: 'success', unread: true, userId: uid },
        { id: 'n2', title: 'Nouveau Message', desc: 'Karim Plombier : Je suis en route, ETA 15 min 🚗', time: 'Il y a 35 min', type: 'info', unread: true, userId: uid },
        { id: 'n3', title: '+200 Maawa Coins crédités!', desc: 'Votre achat Chargily Pay a été validé. Solde: 350 MC', time: 'Hier 16:23', type: 'wallet', unread: false, userId: uid },
      ];
      for (const n of notifs) {
        await setDoc(doc(collection(db, 'notifications'), n.id), { ...n, createdAt: serverTimestamp() });
      }
      log(`✅ ${notifs.length} notifications seedées`);

      // Chats
      const chats = [
        { id: 'c-karim', name: 'Karim Plombier', lastMessage: "J'arrive dans 15 minutes 🚗", time: '14:32', unread: 2, participants: [uid, 'artisan-001'] },
        { id: 'c-ali', name: 'Ali Électricien', lastMessage: 'Le devis est prêt', time: 'Hier', unread: 0, participants: [uid, 'artisan-002'] },
      ];
      for (const c of chats) {
        await setDoc(doc(collection(db, 'chats'), c.id), { ...c, createdAt: serverTimestamp() });
      }
      log(`✅ ${chats.length} conversations seedées`);

      // Feed Posts
      const feedPosts = [
        { id: 'fp-1', title: 'Rénovation Cuisine Moderne', artisan: 'Youssef Omar', authorId: 'artisan-003', likes: 120, type: 'post', createdAt: serverTimestamp() },
        { id: 'fp-2', title: 'Installation Chaudière Murale', artisan: 'Karim Plombier', authorId: 'artisan-001', likes: 45, type: 'reel', createdAt: serverTimestamp() },
      ];
      for (const fp of feedPosts) {
        await setDoc(doc(collection(db, 'feed_posts'), fp.id), fp);
      }
      log(`✅ ${feedPosts.length} posts feed seedés`);

      // Update user's Maawa Coins balance
      await setDoc(doc(db, 'users', uid), { maawaCoinBalance: 370 }, { merge: true });
      log(`✅ Solde utilisateur mis à jour → 370 MC`);

      log('🎉 Migration terminée avec succès !');
    } catch (e: any) {
      log(`❌ Erreur: ${e.message}`);
      console.error(e);
    }
    setRunning(false);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '520px', margin: '0 auto', fontFamily: 'monospace' }}>
      <h2 style={{ color: '#29B6F6', marginBottom: '8px' }}>🌱 Maawa Database Seeder</h2>
      <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '.84rem', marginBottom: '20px' }}>
        Utilisateur connecté : <strong style={{ color: '#fff' }}>{auth.currentUser?.email || 'Non connecté'}</strong>
      </p>
      <button
        onClick={runSeeder}
        disabled={running}
        style={{
          padding: '12px 24px', background: running ? '#333' : '#29B6F6', color: '#fff',
          border: 'none', borderRadius: '10px', cursor: running ? 'not-allowed' : 'pointer',
          fontSize: '.9rem', fontWeight: 700, marginBottom: '20px'
        }}
      >
        {running ? '⏳ Migration en cours...' : '▶ Lancer la migration'}
      </button>
      {status.length > 0 && (
        <div style={{ background: '#0a0a12', border: '1px solid rgba(255,255,255,.1)', borderRadius: '10px', padding: '16px' }}>
          {status.map((s, i) => (
            <div key={i} style={{ color: s.startsWith('❌') ? '#f87171' : s.startsWith('🎉') ? '#4ade80' : 'rgba(255,255,255,.8)', fontSize: '.82rem', lineHeight: 2 }}>
              {s}
            </div>
          ))}
        </div>
      )}
      <p style={{ color: 'rgba(255,255,255,.35)', fontSize: '.72rem', marginTop: '20px' }}>
        ⚠️ À supprimer avant le déploiement public.
      </p>
    </div>
  );
}
