'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { SkeletonCard } from '@/components/Skeleton';
import VerifiedBadge from '@/components/VerifiedBadge';
import { useIsFollowing, useFollowCounts } from '@/lib/follow';
import { useRequireAuth } from '@/components/ConnectOrCallModal';

interface ArtisanProfile {
  uid: string;
  displayName: string;
  trade?: string;
  wilaya?: string;
  bio?: string;
  rating?: number;
  missionsCount?: number;
  experience?: number;
  satisfaction?: number;
  available?: boolean;
  verified?: boolean;
  premium?: boolean;
  /* Counts that drive tab labels — populated by aggregations the
     server keeps fresh. Absent → 0 / hidden, never faked. */
  reviewCount?: number;
}

/**
 * Public artisan profile page.
 *
 * Phase 2 cleanup:
 *   - Removed fake portfolio gradient tiles (6 hardcoded images).
 *   - Removed fake reviews ("Mohamed B.", "Samira A.", etc.).
 *   - Removed fake price list ("Débouchage 3K-7K DZD", etc.).
 *   - Removed fake certifications ("Academy — Relation Client", etc.).
 *   - "⭐ Expert" badge now only shows when the user-doc has it
 *     (drives by `expert: true` on the user — admin-set).
 *   - "Avis (89)" → label uses real `reviewCount`, omitted if 0.
 *
 * The corresponding Firestore collections (reviews, portfolio_items,
 * pricing) don't exist yet. Each tab shows an honest empty state
 * until those collections ship in a later phase.
 */
export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<ArtisanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'avis' | 'tarifs' | 'certifs'>('portfolio');

  useEffect(() => {
    async function fetchProfile() {
      if (!id) return;
      setLoading(true);
      try {
        /* Public endpoint — works for guests too. Returns only the
           safe subset of the user doc (never phone/email). */
        const res = await fetch(`/api/public/profile?id=${encodeURIComponent(id as string)}`);
        if (res.ok) {
          const data = await res.json() as Partial<ArtisanProfile>;
          setProfile({ uid: data.uid ?? (id as string), displayName: data.displayName || 'Artisan', ...data });
        }
      } catch (e) {
        console.error('profile fetch:', e);
      }
      setLoading(false);
    }
    fetchProfile();
  }, [id]);

  /* Follow state + counts. */
  const { following, follow, unfollow, myUid } = useIsFollowing(id as string | undefined);
  const { followers, following: followingCount } = useFollowCounts(id as string | undefined);
  const requireAuth = useRequireAuth();

  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+213233000000';
  const callMaawa = () => { window.location.href = `tel:${supportPhone}`; };

  if (loading) return (
    <div className="screen on" id="s-profile" style={{ padding: '14px' }}>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
    </div>
  );

  if (!profile) return (
    <div className="screen on" id="s-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '12px', color: 'var(--text3)' }}>
      <div style={{ fontSize: '3rem' }}>🔍</div>
      <div>Artisan introuvable</div>
      <button className="btn-outline sm" onClick={() => router.push('/explore')}>Explorer les artisans</button>
    </div>
  );

  const initials = profile.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AA';
  const reviewLabel = profile.reviewCount && profile.reviewCount > 0 ? `Avis (${profile.reviewCount})` : 'Avis';

  /* Empty state shared by all tabs — keeps the surface honest until
     the matching Firestore collections are seeded. */
  const EmptyTab = ({ icon, text }: { icon: string; text: string }) => (
    <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text3)' }}>
      <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '.85rem', color: 'var(--text2)', fontWeight: 600 }}>{text}</div>
    </div>
  );

  return (
    <div className="screen on" id="s-profile">
      <div className="card au" style={{ marginBottom: '13px' }}>
        <div className="prof-cover"></div>
        <div className="prof-body">
          <div className="prof-av-row">
            <div className="prof-av av1">{initials}</div>
            <div style={{ flex: 1, paddingTop: '30px', minWidth: '150px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)' }}>{profile.displayName}</span>
                <VerifiedBadge verified={profile.verified} />
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginTop: '2px' }}>
                {profile.trade || '🔧 Artisan'} · {profile.wilaya || 'Algérie'}
              </div>
              {/* Follower / following counts — only when we know the user's id. */}
              {profile.uid && (
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '.78rem', color: 'var(--text2)' }}>
                  <span><strong style={{ color: 'var(--text)' }}>{followers}</strong> abonnés</span>
                  <span><strong style={{ color: 'var(--text)' }}>{followingCount}</strong> abonnements</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                {profile.premium && <span className="badge-x" style={{ background: 'var(--gol)' }}>💎 Premium</span>}
                {profile.available === false && <span className="badge-x" style={{ background: 'var(--rl)', color: 'var(--rd)' }}>Indisponible</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '5px', paddingTop: '30px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Follow button — hidden when viewing own profile.
                  Wrapped in requireAuth so guests get the connect modal. */}
              {profile.uid && profile.uid !== myUid && (
                following ? (
                  <button className="btn-outline" onClick={() => unfollow()}>Abonné ✓</button>
                ) : (
                  <button className="btn-primary" onClick={() => requireAuth(() => follow(), 'suivre cet artisan')}>
                    Suivre
                  </button>
                )
              )}
              <button className="btn-primary" onClick={() => requireAuth(() => router.push('/quote'), 'réserver')} id="t-prof-book">Réserver</button>
              <button className="btn-outline" onClick={() => requireAuth(() => toast('💬 Chat bientôt disponible'), 'envoyer un message')}>Chat</button>
              <button className="ib" onClick={() => requireAuth(() => toast('🔖 Sauvegardé !'), 'enregistrer')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
              </button>
              <button className="ib" onClick={callMaawa}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38C1.62 2.18 2.53 1 3.72 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              </button>
            </div>
          </div>

          {profile.bio && (
            <div style={{ padding: '0 16px 12px', fontSize: '.83rem', color: 'var(--text2)', lineHeight: 1.65 }}>{profile.bio}</div>
          )}

          {/* Stats row — only renders tiles for which we have real data.
              Past version showed 0/0/0% for empty profiles which looked
              dishonest; now each tile is suppressed when undefined. */}
          <div className="prof-stats-row">
            {profile.missionsCount !== undefined && (
              <div className="pstat"><div className="pstat-v">{profile.missionsCount}</div><div className="pstat-l">Missions</div></div>
            )}
            {profile.rating !== undefined && (
              <div className="pstat"><div className="pstat-v" style={{ color: 'var(--go)' }}>{profile.rating.toFixed(1)}★</div><div className="pstat-l">Note</div></div>
            )}
            {profile.experience !== undefined && (
              <div className="pstat"><div className="pstat-v">{profile.experience}</div><div className="pstat-l">Ans exp.</div></div>
            )}
            {profile.satisfaction !== undefined && (
              <div className="pstat"><div className="pstat-v">{profile.satisfaction}%</div><div className="pstat-l">Satisfaction</div></div>
            )}
            <div className="pstat">
              <div className="pstat-v" style={{ color: profile.available !== false ? 'var(--gn)' : 'var(--text3)', fontSize: '.8rem' }}>
                {profile.available !== false ? '🟢' : '⚪'}
              </div>
              <div className="pstat-l">{profile.available !== false ? 'Dispo' : 'Indispo'}</div>
            </div>
          </div>

          <div className="prof-tabs">
            <button className={`ptab${activeTab === 'portfolio' ? ' on' : ''}`} onClick={() => setActiveTab('portfolio')}>Portfolio</button>
            <button className={`ptab${activeTab === 'avis' ? ' on' : ''}`} onClick={() => setActiveTab('avis')}>{reviewLabel}</button>
            <button className={`ptab${activeTab === 'tarifs' ? ' on' : ''}`} onClick={() => setActiveTab('tarifs')}>Tarifs</button>
            <button className={`ptab${activeTab === 'certifs' ? ' on' : ''}`} onClick={() => setActiveTab('certifs')}>Certifications</button>
          </div>

          {/* All four tabs: real-data-only empty states until the
              corresponding collections ship in a later phase. */}
          {activeTab === 'portfolio' && (
            <EmptyTab icon="📷" text="Aucune réalisation publiée pour le moment." />
          )}
          {activeTab === 'avis' && (
            <EmptyTab icon="⭐" text="Aucun avis pour le moment." />
          )}
          {activeTab === 'tarifs' && (
            <div style={{ padding: '24px 16px 18px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>💰</div>
              <div style={{ fontSize: '.85rem', color: 'var(--text2)', fontWeight: 600, marginBottom: '10px' }}>
                Aucune grille tarifaire publiée.
              </div>
              <button className="btn-primary sm" onClick={() => router.push('/quote')}>
                🤖 Estimation IA gratuite
              </button>
            </div>
          )}
          {activeTab === 'certifs' && (
            <div style={{ padding: '24px 16px 18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {profile.verified ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'var(--gl)', borderRadius: 'var(--rx)' }}>
                  <span style={{ fontSize: '1.3rem' }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.83rem', color: 'var(--gn)' }}>Identité Vérifiée NIN</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text2)' }}>Vérification Maawa</div>
                  </div>
                </div>
              ) : (
                <EmptyTab icon="🪪" text="Vérification d'identité non encore complétée." />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
