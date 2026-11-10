import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { api, gql } from '../services/api';
import GlassPill from '../components/GlassPill';
import PostView from '../components/PostView';
import { Lock, Sparkles, ArrowRight, X } from 'lucide-react';

const CARD_WIDTH = 320;
const CARD_HEIGHT = 440;
const GAP_X = 36;
const GAP_Y = 36;
const CELL_W = CARD_WIDTH + GAP_X;
const CELL_H = CARD_HEIGHT + GAP_Y;

// Deterministic gradients for cards without media
function getDeterministicArt(id) {
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const hues = [
    [260, 320], // purple to pink
    [210, 260], // blue to purple
    [160, 210], // emerald to cyan
    [340, 40], // rose to amber
    [280, 180] // violet to cyan
  ];
  const pair = hues[Math.abs(hash) % hues.length];
  return `linear-gradient(135deg, hsl(${pair[0]}, 75%, 35%) 0%, hsl(${pair[1]}, 80%, 20%) 100%)`;
}

export default function Discover() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [isListView, setIsListView] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);

  // Pan state: panX, panY
  const panRef = useRef({ x: 0, y: 0 });
  const [panDisplay, setPanDisplay] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Velocity & Drag state
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, time: 0 });
  const lastSamples = useRef([]); // [{ x, y, time }]
  const animFrame = useRef(null);
  const velocity = useRef({ x: 0, y: 0 });

  // Load feed via GraphQL or REST
  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const query = `
        query Feed($limit: Int) {
          feed(limit: $limit) {
            items {
              id
              title
              minTier
              isAccessible
              publishedAt
              createdAt
              media { url mediaType }
              creator { id username displayName }
            }
          }
        }
      `;
      const data = await gql(query, { limit: 40 }).catch(async () => {
        // Fallback to REST feed
        const rest = await api.getFeed(null, 40);
        return { feed: { items: rest.items } };
      });
      setPosts(data.feed?.items || []);
    } catch {
      // If error, try REST
      try {
        const rest = await api.getFeed(null, 40);
        setPosts(rest.items || []);
      } catch {
        setPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Filtering
  const filteredPosts = useMemo(() => {
    if (filter === 'all') return posts;
    return posts.filter((p) => p.minTier?.toLowerCase() === filter.toLowerCase());
  }, [posts, filter]);

  // Inertia Decay Loop
  const startDecay = useCallback(() => {
    const friction = 0.92;
    const step = () => {
      velocity.current.x *= friction;
      velocity.current.y *= friction;

      if (Math.abs(velocity.current.x) > 0.05 || Math.abs(velocity.current.y) > 0.05) {
        panRef.current.x += velocity.current.x;
        panRef.current.y += velocity.current.y;
        setPanDisplay({ x: panRef.current.x, y: panRef.current.y });
        animFrame.current = requestAnimationFrame(step);
      } else {
        velocity.current = { x: 0, y: 0 };
        cancelAnimationFrame(animFrame.current);
      }
    };
    cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(step);
  }, []);

  // Pointer drag handlers
  const handlePointerDown = (e) => {
    if (selectedPostId || isListView) return;
    isDragging.current = true;
    cancelAnimationFrame(animFrame.current);
    velocity.current = { x: 0, y: 0 };

    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      panX: panRef.current.x,
      panY: panRef.current.y
    };
    lastSamples.current = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    panRef.current.x = dragStart.current.panX + dx;
    panRef.current.y = dragStart.current.panY + dy;
    setPanDisplay({ x: panRef.current.x, y: panRef.current.y });

    const now = performance.now();
    lastSamples.current.push({ x: e.clientX, y: e.clientY, time: now });
    // Keep last 100ms
    lastSamples.current = lastSamples.current.filter((s) => now - s.time <= 100);
  };

  const handlePointerUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }

    // Velocity calculation from recent samples
    const samples = lastSamples.current;
    if (samples.length >= 2) {
      const oldest = samples[0];
      const newest = samples[samples.length - 1];
      const dt = newest.time - oldest.time;
      if (dt > 10) {
        velocity.current = {
          x: ((newest.x - oldest.x) / dt) * 16,
          y: ((newest.y - oldest.y) / dt) * 16
        };
        startDecay();
      }
    }
  };

  // Wheel and keyboard support
  useEffect(() => {
    const handleWheel = (e) => {
      if (selectedPostId || isListView) return;
      e.preventDefault();
      cancelAnimationFrame(animFrame.current);

      let deltaX = e.deltaX;
      let deltaY = e.deltaY;
      if (e.shiftKey && !deltaX) {
        deltaX = deltaY;
        deltaY = 0;
      }
      panRef.current.x -= deltaX * 1.2;
      panRef.current.y -= deltaY * 1.2;
      setPanDisplay({ x: panRef.current.x, y: panRef.current.y });
    };

    const handleKeyDown = (e) => {
      if (selectedPostId || isListView) return;
      cancelAnimationFrame(animFrame.current);
      const step = 60;
      if (e.key === 'ArrowLeft') {
        panRef.current.x += step;
      } else if (e.key === 'ArrowRight') {
        panRef.current.x -= step;
      } else if (e.key === 'ArrowUp') {
        panRef.current.y += step;
      } else if (e.key === 'ArrowDown') {
        panRef.current.y -= step;
      } else if (e.key === 'Home') {
        panRef.current = { x: 0, y: 0 };
      } else {
        return;
      }
      setPanDisplay({ x: panRef.current.x, y: panRef.current.y });
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPostId, isListView]);

  const handleCardClick = (post, e) => {
    // Click vs Drag: moved < 6px and < 250ms
    const dx = Math.abs(e.clientX - dragStart.current.x);
    const dy = Math.abs(e.clientY - dragStart.current.y);
    const duration = performance.now() - dragStart.current.time;
    if (dx < 6 && dy < 6 && duration < 250) {
      setSelectedPostId(post.id);
    }
  };

  // Modulo Math Brick Grid Tile Generator
  const visibleCards = useMemo(() => {
    if (filteredPosts.length === 0 || typeof window === 'undefined') return [];

    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    const margin = 200;

    const minCol = Math.floor((-panDisplay.x - margin) / CELL_W);
    const maxCol = Math.ceil((-panDisplay.x + vw + margin) / CELL_W);
    const minRow = Math.floor((-panDisplay.y - margin) / CELL_H);
    const maxRow = Math.ceil((-panDisplay.y + vh + margin) / CELL_H);

    const cards = [];
    const n = filteredPosts.length;
    const centerX = vw / 2;
    const centerY = vh / 2;

    for (let r = minRow; r <= maxRow; r++) {
      const rowOffset = Math.abs(r) % 2 === 1 ? CELL_W / 2 : 0;
      for (let c = minCol; c <= maxCol; c++) {
        const posX = c * CELL_W + rowOffset + panDisplay.x;
        const posY = r * CELL_H + panDisplay.y;

        // Viewport check
        if (posX + CARD_WIDTH < -margin || posX > vw + margin) continue;
        if (posY + CARD_HEIGHT < -margin || posY > vh + margin) continue;

        // Modulo wrapping index
        const index = (((r * 7 + c) % n) + n) % n;
        const post = filteredPosts[index];
        if (!post) continue;

        // 3D Perspective tilt calculation relative to viewport center
        const cardCenterX = posX + CARD_WIDTH / 2;
        const cardCenterY = posY + CARD_HEIGHT / 2;
        const normX = (cardCenterX - centerX) / (vw / 2);
        const normY = (cardCenterY - centerY) / (vh / 2);
        const dist = Math.min(1, Math.sqrt(normX * normX + normY * normY) / 1.4);

        const rotateY = normX * 12; // tilt inward horizontally
        const rotateX = -normY * 12; // tilt inward vertically
        const scale = 1 - dist * 0.14;
        const opacity = 1 - dist * 0.15;

        cards.push({
          key: `${r}-${c}-${post.id}`,
          post,
          posX,
          posY,
          transform: `translate3d(${posX}px, ${posY}px, 0) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          opacity
        });
      }
    }
    return cards;
  }, [filteredPosts, panDisplay]);

  // Recommendations for modal overlay
  const recommendedPosts = useMemo(() => {
    if (!selectedPostId) return [];
    return posts.filter((p) => p.id !== selectedPostId).slice(0, 3);
  }, [posts, selectedPostId]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: 'calc(100vh - 61px)',
        overflow: 'hidden',
        userSelect: 'none',
        background: '#07080b'
      }}
    >
      {/* Fallback Accessible List View */}
      {isListView ? (
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '32px 20px 100px',
            maxWidth: 840,
            margin: '0 auto'
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 20 }}>Discover Posts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredPosts.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPostId(p.id)}
                className="glass-panel"
                style={{
                  padding: 20,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span className={`tier-badge ${p.minTier?.toLowerCase() || 'free'}`}>
                      {p.minTier}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      by {p.creator?.displayName}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{p.title}</h3>
                </div>
                <ArrowRight size={20} style={{ color: 'var(--text-secondary)' }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* 2D Infinite Draggable Canvas */
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'grab',
            perspective: '1200px',
            transformStyle: 'preserve-3d',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          {visibleCards.map(({ key, post, transform, opacity }) => (
            <div
              key={key}
              onClick={(e) => handleCardClick(post, e)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                transform,
                opacity,
                borderRadius: 24,
                overflow: 'hidden',
                background: '#12141c',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'transform 0.1s ease-out, box-shadow 0.2s ease',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Card Art */}
              <div
                style={{
                  height: 250,
                  width: '100%',
                  background:
                    post.isAccessible && post.media?.[0]?.url
                      ? `url(${post.media[0].url}) center/cover no-repeat`
                      : getDeterministicArt(post.id),
                  position: 'relative'
                }}
              >
                {/* Lock Badge */}
                {!post.isAccessible && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      background: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(8px)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-pill)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    <Lock size={12} />
                    <span>Locked</span>
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 14
                  }}
                >
                  <span className={`tier-badge ${post.minTier?.toLowerCase() || 'free'}`}>
                    {post.minTier || 'Free'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div
                style={{
                  padding: 18,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      lineHeight: 1.35,
                      color: '#fff',
                      marginBottom: 8,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {post.title}
                  </h3>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    paddingTop: 12
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--accent-gradient)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}
                  >
                    {(post.creator?.displayName || post.creator?.username || 'C')[0].toUpperCase()}
                  </div>
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 600
                    }}
                  >
                    {post.creator?.displayName || post.creator?.username}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Glass Pill Navigation Bar */}
      <GlassPill
        currentFilter={filter}
        onFilterChange={setFilter}
        isListView={isListView}
        onToggleListView={() => setIsListView((v) => !v)}
        onRecenter={() => {
          panRef.current = { x: 0, y: 0 };
          setPanDisplay({ x: 0, y: 0 });
        }}
        postCount={filteredPosts.length}
      />

      {/* Post Modal Overlay */}
      {selectedPostId && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(5, 6, 9, 0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPostId(null);
          }}
        >
          <div
            className="glass-panel"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 1020,
              maxHeight: '90vh',
              borderRadius: 24,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'row',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedPostId(null)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 10,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            {/* Left: Main Post Details */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
              <PostView
                postId={selectedPostId}
                onPostUpdated={loadPosts}
                onClose={() => setSelectedPostId(null)}
              />
            </div>

            {/* Right: "You may also like" column */}
            <div
              style={{
                width: 280,
                borderLeft: '1px solid var(--border-subtle)',
                background: 'rgba(15, 17, 23, 0.6)',
                padding: '24px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              <h4
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                You May Also Like
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recommendedPosts.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedPostId(rec.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 12,
                      padding: 12,
                      cursor: 'pointer',
                      border: '1px solid var(--border-subtle)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span
                      className={`tier-badge ${rec.minTier?.toLowerCase() || 'free'}`}
                      style={{ fontSize: '0.6875rem', marginBottom: 6 }}
                    >
                      {rec.minTier}
                    </span>
                    <h5
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.3
                      }}
                    >
                      {rec.title}
                    </h5>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      by {rec.creator?.displayName || rec.creator?.username}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
