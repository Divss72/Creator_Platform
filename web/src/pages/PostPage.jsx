import React from 'react';
import { useParams, Link } from 'react-router-dom';
import PostView from '../components/PostView';
import { ArrowLeft } from 'lucide-react';

export default function PostPage() {
  const { id } = useParams();

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.875rem',
            color: 'var(--text-secondary)'
          }}
        >
          <ArrowLeft size={16} /> Back to Discover
        </Link>
      </div>

      <div className="glass-panel" style={{ borderRadius: 24, padding: 32 }}>
        <PostView postId={id} />
      </div>
    </div>
  );
}
