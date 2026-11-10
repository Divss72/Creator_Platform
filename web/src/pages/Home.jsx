import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { TrendingUp, Flame, Lock, Heart, MessageSquare, ChevronRight } from 'lucide-react';

export default function Home() {
  const [feedItems, setFeedItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trending, setTrending] = useState([]);

  const loadFeed = async (cursor = null) => {
    try {
      setLoading(true);
      const res = await api.getFeed(cursor, 12);
      if (cursor) {
        setFeedItems((prev) => [...prev, ...res.items]);
      } else {
        setFeedItems(res.items);
      }
      setNextCursor(res.nextCursor);
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  const loadTrending = async () => {
    try {
      const res = await api.getTrending(6);
      setTrending(res.items || []);
    } catch {}
  };

  useEffect(() => {
    loadFeed();
    loadTrending();
  }, []);

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '32px 20px',
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 32
      }}
    >
      {/* Main Feed */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 20 }}>Home Feed</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {feedItems.map((item) => (
            <Link
              to={`/posts/${item.id}`}
              key={item.id}
              className="glass-panel"
              style={{
                borderRadius: 16,
                padding: 24,
                display: 'block',
                transition: 'transform 0.15s ease, border-color 0.15s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`tier-badge ${item.minTier?.toLowerCase() || 'free'}`}>
                    {item.minTier || 'Free'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    by {item.creator?.displayName || item.creator?.username}
                  </span>
                </div>
                {!item.isAccessible && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 700
                    }}
                  >
                    <Lock size={12} /> Locked
                  </span>
                )}
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, color: '#fff' }}>
                {item.title}
              </h3>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 16,
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Heart size={14} /> {item.likeCount || 0}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageSquare size={14} /> {item.commentCount || 0}
                </span>
                <span>{new Date(item.publishedAt || item.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>

        {nextCursor && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              onClick={() => loadFeed(nextCursor)}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '10px 24px' }}
            >
              {loading ? 'Loading...' : 'Load More Posts'}
            </button>
          </div>
        )}
      </div>

      {/* Trending Rail */}
      <aside>
        <div className="glass-panel" style={{ borderRadius: 16, padding: 20 }}>
          <h3
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16
            }}
          >
            <Flame size={18} style={{ color: '#f59e0b' }} /> Trending Now
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trending.map((t, idx) => (
              <Link
                key={t.id}
                to={`/posts/${t.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 10,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.03)',
                  transition: 'background 0.15s'
                }}
              >
                <span
                  style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: 'var(--accent-purple)',
                    width: 20
                  }}
                >
                  #{idx + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#fff',
                      marginBottom: 2
                    }}
                  >
                    {t.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Score: {Math.round(t.trendingScore || 0)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
