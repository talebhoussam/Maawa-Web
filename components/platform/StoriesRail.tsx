'use client';

import { useState } from 'react';
import { useMaawa } from '@/lib/store';
import { useStories, type StoryGroup, type StoryDoc } from '@/lib/stories';
import StoryViewer from '@/components/platform/StoryViewer';

/**
 * Stories rail rendered at the top of the feed.
 *
 * Layout:
 *   - First slot: "+ Add story" tile for the signed-in user. If they
 *     already have an active story, this becomes "Voir ma story" and
 *     opens the viewer focused on their group. Hidden for guests.
 *   - Following slots: one circle per user with active stories, freshest
 *     first.
 *
 * Tapping any slot opens the StoryViewer overlay, starting on that user's
 * oldest story.
 */
export default function StoriesRail() {
  const { user } = useMaawa();
  const { groups } = useStories();
  const [viewing, setViewing] = useState<{ stories: StoryDoc[]; startIdx: number } | null>(null);

  const myGroup: StoryGroup | undefined = user ? groups.find(g => g.userId === user.uid) : undefined;
  const otherGroups = user ? groups.filter(g => g.userId !== user.uid) : groups;

  const openGroup = (g: StoryGroup, startIdx = 0) => {
    setViewing({ stories: g.stories, startIdx });
  };

  const openCreate = () => {
    if (typeof document === 'undefined') return;
    document.getElementById('story-create-modal')?.classList.add('on');
  };

  return (
    <>
      <div className="stories-row" style={{
        display: 'flex', gap: 10, overflowX: 'auto',
        padding: '10px 13px', margin: '0 -13px',
        scrollbarWidth: 'none',
      }}>
        {/* + Add story tile (signed-in only) */}
        {user && (
          <div
            className="story-item"
            onClick={() => {
              /* If the user has stories, open them; the floating + button
                 inside the viewer slot lets them publish again. The
                 brief says: "First slot is the current user's + Add
                 story (or Voir ma story if they have one)". */
              if (myGroup) openGroup(myGroup);
              else openCreate();
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}
          >
            <div style={{ position: 'relative' }}>
              {myGroup ? (
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  padding: 2,
                  background: 'linear-gradient(135deg, #29B6F6, #5C6BC0)',
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: 'var(--b500)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: '.95rem', fontFamily: "'Sora',sans-serif",
                  }}>
                    {(user.displayName?.[0] || 'M').toUpperCase()}
                  </div>
                </div>
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--surface2)', border: '2px dashed var(--border2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text2)',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              )}
              {/* Floating + on top of my-story so users can publish again */}
              {myGroup && (
                <button
                  type="button"
                  aria-label="Publier"
                  onClick={(e) => { e.stopPropagation(); openCreate(); }}
                  style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--b500)', color: '#fff',
                    border: '2px solid var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              )}
            </div>
            <span style={{ fontSize: '.7rem', color: 'var(--text2)', fontWeight: 600, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {myGroup ? 'Ma story' : 'Ma story'}
            </span>
          </div>
        )}

        {otherGroups.map(g => (
          <div
            key={g.userId}
            className="story-item"
            onClick={() => openGroup(g)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              padding: 2,
              /* Gradient ring per Instagram-style; subtle dim when seen.
                 (Per-viewer-seen tracking ships later — for now everyone
                 looks unseen.) */
              background: 'linear-gradient(135deg, #ff6b6b, #ffa15c, #29B6F6)',
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: 'var(--b500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: '.95rem', fontFamily: "'Sora',sans-serif",
                /* If avatarUrl exists, show as background-image. Inline-style this so we
                   don't depend on Next/Image (the avatar may be a Firebase URL the next
                   config doesn't whitelist). */
                backgroundImage: g.authorAvatar ? `url("${g.authorAvatar}")` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}>
                {!g.authorAvatar && (g.authorName?.[0] || '?').toUpperCase()}
              </div>
            </div>
            <span style={{ fontSize: '.7rem', color: 'var(--text2)', fontWeight: 600, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.authorName.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      {viewing && (
        <StoryViewer
          stories={viewing.stories}
          startIdx={viewing.startIdx}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
