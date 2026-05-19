'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from '@/lib/toast';
import { useMaawa } from '@/lib/store';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { SkeletonList } from '@/components/Skeleton';
import { useRequireAuth } from '@/components/ConnectOrCallModal';
import type { ArtisanMapPin } from '@/components/ArtisanMap';
import { wilayaCentroid } from '@/lib/wilaya-coords';

// Dynamic import — prevents SSR crash (window.google doesn't exist on server)
const ArtisanMap = dynamic(() => import('@/components/ArtisanMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.2)', borderRadius: 'var(--rx)', color: 'var(--text3)', fontSize: '.8rem' }}>
      🗺️ Chargement de la carte…
    </div>
  ),
});


const ARTISAN_CATEGORIES = [
  { id: 'all', label: 'Tous', icon: '🔍' },
  { id: 'plomberie', label: 'Plomberie', icon: '🔧' },
  { id: 'electricite', label: 'Électricité', icon: '⚡' },
  { id: 'peinture', label: 'Peinture', icon: '🎨' },
  { id: 'maconnerie', label: 'Maçonnerie', icon: '🧱' },
  { id: 'climatisation', label: 'Clim', icon: '❄️' },
  { id: 'menuiserie', label: 'Menuiserie', icon: '🪚' },
];

export default function ExplorePage() {
  const router = useRouter();
  const { user } = useMaawa();
  const requireAuth = useRequireAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchWilaya, setSearchWilaya] = useState(user?.wilaya || '');
  const [activeCategory, setActiveCategory] = useState('all');
  const [artisans, setArtisans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  const callMaawa = () => { window.location.href = 'tel:+213233000000'; };

  // Load all artisans from Firestore on mount
  useEffect(() => {
    const fetchArtisans = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'artisan'),
          limit(50)
        );
        const snap = await getDocs(q);
        setArtisans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('explore fetch:', e);
      }
      setLoading(false);
    };
    fetchArtisans();
  }, []);

  const doSearch = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'artisan'),
        limit(50)
      );
      const snap = await getDocs(q);
      setArtisans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error('search:', e); }
    setLoading(false);
  };

  const filtered = artisans.filter(a => {
    const matchCategory = activeCategory === 'all' || a.category === activeCategory;
    const matchSearch = !searchTerm || a.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || a.trade.toLowerCase().includes(searchTerm.toLowerCase());
    const matchWilaya = !searchWilaya || a.wilaya?.toLowerCase().includes(searchWilaya.toLowerCase());
    return matchCategory && matchSearch && matchWilaya;
  });

  /* Map pins. Prefer per-artisan lat/lng when stored; fall back to the
     wilaya capital centroid so artisans who haven't dropped a pin still
     show on the map. We add a tiny pseudo-random jitter (≤ ±0.04°, ~4 km)
     keyed by artisan id so multiple pins on the same wilaya don't stack
     into one marker. */
  const mapPins: ArtisanMapPin[] = filtered
    .map((a): ArtisanMapPin | null => {
      let lat: number | undefined = a.lat;
      let lng: number | undefined = a.lng;
      if (lat === undefined || lng === undefined) {
        const c = wilayaCentroid(a.wilaya);
        if (!c) return null;
        const idStr: string = String(a.id || '');
        const seed = idStr.split('').reduce((h: number, ch: string) => (h * 31 + ch.charCodeAt(0)) & 0xffffff, 7);
        const jx = ((seed         & 0xff) / 255 - 0.5) * 0.08;
        const jy = (((seed >> 8)  & 0xff) / 255 - 0.5) * 0.08;
        lat = c.lat + jy;
        lng = c.lng + jx;
      }
      return {
        id: a.id,
        name: a.displayName,
        trade: a.trade,
        lat: lat!,
        lng: lng!,
        rating: a.rating,
        available: a.available,
      };
    })
    .filter((p): p is ArtisanMapPin => p !== null);

  return (
    <div className="screen on" id="s-explore">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div className="pg-title au" style={{ marginBottom: 0 }}>Explorer les Artisans</div>
        {/* List / Map toggle */}
        <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border)', gap: '2px', flexShrink: 0 }}>
          <button
            onClick={() => setViewMode('list')}
            style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '.74rem', fontWeight: 700, background: viewMode === 'list' ? 'var(--b500)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text3)', transition: 'all .2s' }}
          >☰ Liste</button>
          <button
            onClick={() => setViewMode('map')}
            style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '.74rem', fontWeight: 700, background: viewMode === 'map' ? 'var(--b500)' : 'transparent', color: viewMode === 'map' ? '#fff' : 'var(--text3)', transition: 'all .2s' }}
          >🗺️ Carte</button>
        </div>
      </div>
      <div className="pg-sub au" id="t-exp-sub">Trouvez le professionnel idéal pour votre projet</div>

      {/* Call Strip */}
      <div className="call-strip au1">
        <div className="cs-text">
          <div className="cs-title">📞 Besoin d'aide ?</div>
          <div className="cs-sub">Notre équipe dispatch le meilleur artisan dans votre wilaya</div>
        </div>
        <button className="cs-btn" onClick={callMaawa}>Appeler Maawa</button>
      </div>

      {/* Mode Selection */}
      <div className="au2">
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.88rem', color: 'var(--text)', marginBottom: '9px' }}>
          Comment souhaitez-vous procéder ?
        </div>
        <div className="choose-grid">
          <div className={`choose-card ${mode === 'manual' ? 'on' : ''}`} onClick={() => setMode('manual')}>
            <div className="choose-icon">🔍</div>
            <div className="choose-title">Choisir moi-même</div>
            <div className="choose-desc">Parcourez les profils et choisissez</div>
          </div>
          <div className={`choose-card ${mode === 'auto' ? 'on' : ''}`} onClick={() => { setMode('auto'); toast('🤖 Mode auto activé — Maawa vous proposera un artisan disponible'); }}>
            <div className="choose-icon">🤖</div>
            <div className="choose-title">Laisser Maawa choisir</div>
            <div className="choose-desc">Notre algorithme assigne le meilleur artisan disponible</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="search-hero au3">
        <div className="sh-title">Trouvez l'artisan parfait 🔍</div>
        <div className="sh-sub">{artisans.filter(a => a.available).length} artisans disponibles maintenant</div>
        <div className="sh-form">
          <input
            className="sh-inp"
            placeholder="Plombier, électricien, peintre…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
          />
          <input
            className="sh-inp"
            placeholder="📍 Votre wilaya…"
            style={{ maxWidth: '160px' }}
            value={searchWilaya}
            onChange={e => setSearchWilaya(e.target.value)}
          />
          <button className="sh-btn" onClick={doSearch}>Rechercher</button>
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', padding: '2px 0 12px 0', scrollbarWidth: 'none' }}>
        {ARTISAN_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              flexShrink: 0, padding: '5px 13px',
              background: activeCategory === cat.id ? 'var(--b500)' : 'var(--surface2)',
              color: activeCategory === cat.id ? '#fff' : 'var(--text2)',
              border: `1px solid ${activeCategory === cat.id ? 'var(--b500)' : 'var(--border)'}`,
              borderRadius: '50px', fontSize: '.74rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
            }}
          >{cat.icon} {cat.label}</button>
        ))}
      </div>

      {/* Results */}
      {loading ? <SkeletonList count={3} /> : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '.74rem', color: 'var(--text3)' }}>
              {filtered.length} artisan{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
              {activeCategory !== 'all' && ` · ${ARTISAN_CATEGORIES.find(c => c.id === activeCategory)?.label}`}
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--text3)' }}>
              🟢 {filtered.filter(a => a.available).length} disponibles
            </div>
          </div>

          {/* MAP VIEW */}
          {viewMode === 'map' && (
            <div style={{ height: 'calc(100vh - 340px)', minHeight: '380px', borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '14px' }}>
              <ArtisanMap
                artisans={mapPins}
                onSelectArtisan={id => router.push(`/profile/${id}`)}
              />
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
        <>

          <div style={{ fontSize: '.74rem', color: 'var(--text3)', marginBottom: '10px' }}>
            {filtered.length} artisan{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
            {activeCategory !== 'all' && ` · ${ARTISAN_CATEGORIES.find(c => c.id === activeCategory)?.label}`}
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
              <div>Aucun artisan trouvé</div>
              <button className="btn-outline sm" style={{ marginTop: '10px' }} onClick={() => { setSearchTerm(''); setSearchWilaya(''); setActiveCategory('all'); }}>Réinitialiser</button>
            </div>
          ) : (
            filtered.map((artisan, idx) => (
              <div key={artisan.id} className={`artisan-card au${(idx % 3) + 1}`} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className={`av${(idx % 4) + 1}`} style={{ width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem', fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: "'Sora',sans-serif", position: 'relative' }}>
                    {artisan.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    {artisan.available && <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--gn)', border: '2px solid var(--surface)' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.9rem', color: 'var(--text)' }}>{artisan.displayName}</span>
                      {artisan.verified && <span className="badge-v" style={{ fontSize: '.58rem' }}>✓ NIN</span>}
                      {artisan.premium && <span className="badge-p" style={{ fontSize: '.58rem' }}>💎</span>}
                    </div>
                    <div style={{ fontSize: '.74rem', color: 'var(--text2)', marginTop: '1px' }}>{artisan.trade} · 📍 {artisan.wilaya}</div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px', fontSize: '.7rem', color: 'var(--text3)' }}>
                      <span style={{ color: 'var(--go)' }}>⭐ {artisan.rating}</span>
                      <span>✅ {artisan.missions} missions</span>
                      <span style={{ color: artisan.available ? 'var(--gn)' : 'var(--text3)' }}>
                        {artisan.available ? '🟢 Dispo' : '🔴 Occupé'}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginBottom: '3px' }}>À partir de</div>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '.8rem', color: 'var(--b500)' }}>{artisan.price}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '7px', marginTop: '10px' }}>
                  <button className="btn-primary sm" onClick={() => requireAuth(() => router.push('/quote'), 'réserver')}>Réserver</button>
                  <button className="btn-outline sm" onClick={() => router.push(`/profile/${artisan.id}`)}>Voir profil</button>
                  <button className="btn-outline sm" onClick={() => requireAuth(() => toast('💬 Chat'), 'envoyer un message')}>Chat</button>
                </div>
              </div>
            ))
          )}
          </> // end list view
          )}
        </>
      )}
    </div>
  );
}
