'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from '@/lib/toast';

export default function AdminLoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'super' | 'manager' | 'ops'>('super');
  const [pwType, setPwType] = useState<'password' | 'text'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      toast('Veuillez entrer vos identifiants');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user is an admin
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        toast('Accès refusé. Vous n\'êtes pas administrateur.');
        await auth.signOut();
      }
    } catch (err: any) {
      toast('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="admin-login">
      <div className="al-orb al-orb1"></div>
      <div className="al-orb al-orb2"></div>
      <div className="al-card">
        <div className="al-logo">
          <div className="al-logo-box">
            <svg width="16" height="14" viewBox="0 0 60 55" fill="none">
              <path d="M30 5L55 27L50 27L50 50L35 50L35 36L25 36L25 50L10 50L10 27L5 27Z" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinejoin="round" />
              <path d="M18 42L18 22L30 34L42 22L42 42" stroke="#29B6F6" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: '1.05rem', color: '#fff', letterSpacing: '-.4px' }}>Maawa Admin</span>
          <span style={{ fontSize: '.54rem', fontWeight: 700, background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', color: '#fff', padding: '2px 6px', borderRadius: '50px' }}>BETA</span>
        </div>
        <div className="al-title">Panneau de contrôle</div>
        <div className="al-sub">Accès réservé aux administrateurs Maawa</div>
        <div className="al-roles">
          <button className={role === 'super' ? 'al-role on' : 'al-role'} id="alr-super" onClick={() => setRole('super')}>🔐 Super Admin</button>
          <button className={role === 'manager' ? 'al-role on' : 'al-role'} id="alr-mod" onClick={() => setRole('manager')}>🛡️ Manager</button>
          <button className={role === 'ops' ? 'al-role on' : 'al-role'} id="alr-ops" onClick={() => setRole('ops')}>⚙️ Ops</button>
        </div>
        <input className="al-fi" type="email" id="al-email" placeholder="admin@maawa.dz" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="al-fw">
          <input className="al-fi" type={pwType} id="al-pw" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button className="al-eye" onClick={() => setPwType(t => t === 'password' ? 'text' : 'password')}>👁</button>
        </div>
        <button className="al-btn" id="al-login-btn" onClick={submit} disabled={loading}>
          <span id="al-btn-txt">{loading ? 'Connexion...' : 'Accéder au panneau'}</span>
        </button>
        <div className="al-demo">
          Démo rapide :{' '}
          <a onClick={() => { setRole('super'); submit(); }}>Super Admin</a> ·{' '}
          <a onClick={() => { setRole('manager'); submit(); }}>Manager</a> ·{' '}
          <a onClick={() => { setRole('ops'); submit(); }}>Ops</a>
        </div>
        <div className="al-back"><a onClick={() => router.push('/')}>← Retour à la plateforme</a></div>
      </div>
    </div>
  );
}
