import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RichText from './RichText';
import {
  Heart,
  MessageSquare,
  Lock,
  Send,
  CheckCircle,
  ShieldAlert,
  Sparkles,
  UserCheck
} from 'lucide-react';

export default function PostView({ postId, onPostUpdated, onClose }) {
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Likes
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Comments / Live Chat
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const socketRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Subscribing
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  // Fetch post data
  const loadPost = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPost(postId);
      setPost(data);
      setLikeCount(data.likeCount || 0);
      setLikedByMe(Boolean(data.likedByMe));

      // Record view asynchronously
      api.recordView(postId).catch(() => {});

      // Load comments if accessible
      if (data.isAccessible) {
        const commentsData = await api.getComments(postId).catch(() => ({ comments: [] }));
        setComments(commentsData.comments || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      loadPost();
    }
  }, [postId]);

  // Real-time socket chat
  useEffect(() => {
    if (!postId || !post?.isAccessible) return;

    const token = localStorage.getItem('creatorhub_token');
    const socket = io({
      auth: token ? { token: `Bearer ${token}` } : {},
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { room: `content:${postId}` });
    });

    socket.on('comment:new', (comment) => {
      setComments((prev) => [...prev, comment]);
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    });

    return () => {
      socket.emit('leave', { room: `content:${postId}` });
      socket.disconnect();
    };
  }, [postId, post?.isAccessible]);

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      alert('Please sign in to like posts');
      return;
    }
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      if (likedByMe) {
        await api.unlikePost(postId);
        setLikedByMe(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        await api.likePost(postId);
        setLikedByMe(true);
        setLikeCount((c) => c + 1);
      }
    } catch (err) {
      alert(err.message || 'Could not update like');
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const added = await api.addComment(postId, newComment.trim());
      setComments((prev) => [...prev, added]);
      setNewComment('');
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    } catch (err) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      alert('Please sign in to subscribe');
      return;
    }
    setSubscribing(true);
    try {
      await api.subscribe(post.creatorId, post.minTier || 'free');
      setSubscribeSuccess(true);
      setTimeout(async () => {
        await loadPost();
        if (onPostUpdated) onPostUpdated();
        setSubscribeSuccess(false);
      }, 1200);
    } catch (err) {
      alert(err.message || 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="skeleton" style={{ height: 32, width: '60%', margin: '0 auto 16px' }}></div>
        <div className="skeleton" style={{ height: 200, width: '100%', borderRadius: 12 }}></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>
        <ShieldAlert size={36} style={{ marginBottom: 12 }} />
        <p>{error || 'Post not found'}</p>
        {onClose && (
          <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 16 }}>
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12
          }}
        >
          <span className={`tier-badge ${post.minTier?.toLowerCase() || 'free'}`}>
            {post.minTier || 'Free'} Tier
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
          </span>
        </div>

        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            marginBottom: 8
          }}
        >
          {post.title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.875rem'
            }}
          >
            {(post.creator?.displayName || post.creator?.username || 'C')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {post.creator?.displayName || post.creator?.username}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              @{post.creator?.username}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content or Paywall */}
      {post.isAccessible ? (
        <>
          {/* Media thumbnail / image if present */}
          {post.media && post.media.length > 0 && (
            <div
              style={{ borderRadius: 16, overflow: 'hidden', background: '#000', maxHeight: 420 }}
            >
              <img
                src={post.media[0].url}
                alt={post.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 420,
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          )}

          {/* Sanitized Rich Text */}
          <div style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-primary)' }}>
            <RichText html={post.body} />
          </div>

          {/* Engagement bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 16
            }}
          >
            <button
              onClick={handleToggleLike}
              disabled={likeLoading}
              className="btn btn-secondary"
              style={{
                background: likedByMe ? 'rgba(236, 72, 153, 0.15)' : 'var(--bg-surface-elevated)',
                borderColor: likedByMe ? 'rgba(236, 72, 153, 0.4)' : 'var(--border-subtle)',
                color: likedByMe ? 'var(--accent-pink)' : 'var(--text-primary)'
              }}
            >
              <Heart size={18} fill={likedByMe ? 'currentColor' : 'none'} />
              <span>
                {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
              </span>
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}
            >
              <MessageSquare size={18} />
              <span>{comments.length} Comments</span>
            </div>
          </div>

          {/* Live Chat / Comments */}
          <section
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              padding: 16
            }}
          >
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} /> Live Discussion
            </h3>

            <div
              ref={chatScrollRef}
              style={{
                maxHeight: 260,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingRight: 6,
                marginBottom: 16
              }}
            >
              {comments.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 20,
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem'
                  }}
                >
                  No comments yet. Be the first to start the conversation!
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id || Math.random()}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 8,
                      padding: '8px 12px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 2
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)'
                        }}
                      >
                        {c.author?.displayName || c.author?.username || 'User'}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'now'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{c.body}</p>
                  </div>
                ))
              )}
            </div>

            {isAuthenticated ? (
              <form onSubmit={handleSendComment} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Join the discussion..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px' }}
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="btn btn-primary"
                >
                  <Send size={16} />
                </button>
              </form>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: 8,
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)'
                }}
              >
                Sign in to join the live chat.
              </div>
            )}
          </section>
        </>
      ) : (
        /* Paywall Block */
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(30, 27, 46, 0.6) 0%, rgba(18, 20, 26, 0.95) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 20,
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-purple)'
            }}
          >
            <Lock size={28} />
          </div>

          <div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: 6 }}>
              {post.minTier || 'VIP'} Member Exclusive
            </h2>
            <p
              style={{
                fontSize: '0.9375rem',
                color: 'var(--text-secondary)',
                maxWidth: 460,
                margin: '0 auto'
              }}
            >
              This post is exclusive to {post.creator?.displayName || 'the creator'}'s{' '}
              {post.minTier} subscribers. Unlock full access and join the live member chat
              immediately.
            </p>
          </div>

          {subscribeSuccess ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--tier-free)',
                fontWeight: 700,
                fontSize: '1rem',
                marginTop: 8
              }}
            >
              <CheckCircle size={20} /> Subscribed! Unlocking post...
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="btn btn-primary"
              style={{
                padding: '12px 32px',
                fontSize: '1rem',
                borderRadius: 'var(--radius-pill)',
                marginTop: 8
              }}
            >
              <UserCheck size={18} />
              {subscribing ? 'Subscribing...' : `Subscribe as ${post.minTier}`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
