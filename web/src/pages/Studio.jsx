import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { PlusCircle, CheckCircle } from 'lucide-react';

export default function Studio() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [minTier, setMinTier] = useState('free');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Please provide both title and content body.');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const created = await api.createContent({
        title,
        body,
        minTier,
        status: 'published'
      });
      navigate(`/posts/${created.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create post');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Creator Studio</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          Publish new stories, articles, and exclusive perks to your subscribers.
        </p>
      </div>

      <form
        onSubmit={handlePublish}
        className="glass-panel"
        style={{ borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: '0.875rem'
            }}
          >
            {error}
          </div>
        )}

        <div>
          <label
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}
          >
            Post Title
          </label>
          <input
            type="text"
            placeholder="e.g. Behind the Scenes: Building CreatorHub v1.0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', fontSize: '1rem', padding: '12px 14px' }}
            required
          />
        </div>

        <div>
          <label
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}
          >
            Minimum Subscription Tier
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            {['free', 'pro', 'vip'].map((tier) => (
              <label
                key={tier}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: minTier === tier ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-surface)',
                  border:
                    minTier === tier
                      ? '2px solid var(--accent-purple)'
                      : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontWeight: 700,
                  fontSize: '0.875rem'
                }}
              >
                <input
                  type="radio"
                  name="minTier"
                  value={tier}
                  checked={minTier === tier}
                  onChange={() => setMinTier(tier)}
                  style={{ display: 'none' }}
                />
                <span className={`tier-badge ${tier}`}>{tier}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}
          >
            Content (Supports basic HTML formatting: &lt;p&gt;, &lt;b&gt;, &lt;h2&gt;, etc.)
          </label>
          <textarea
            rows={10}
            placeholder="Write your story here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ width: '100%', fontSize: '0.9375rem', padding: '14px', lineHeight: 1.6 }}
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            type="submit"
            disabled={publishing}
            className="btn btn-primary"
            style={{ padding: '12px 28px', fontSize: '1rem' }}
          >
            <PlusCircle size={18} />
            {publishing ? 'Publishing...' : 'Publish Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
