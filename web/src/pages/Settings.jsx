import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, XCircle } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await api.mySubscriptions();
      setSubscriptions(res.subscriptions || []);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const handleCancel = async (creatorId) => {
    if (!window.confirm('Are you sure you want to cancel this subscription?')) return;
    try {
      await api.cancelSubscription(creatorId);
      await loadSubscriptions();
    } catch (err) {
      alert(err.message || 'Failed to cancel subscription');
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Account & Subscriptions</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          Signed in as <strong>{user?.email}</strong> ({user?.role})
        </p>
      </div>

      <div className="glass-panel" style={{ borderRadius: 20, padding: 24 }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16 }}>
          Active Subscriptions
        </h3>

        {subscriptions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            You have no active creator subscriptions.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
                    {sub.creator?.displayName || sub.creator?.username}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <span className={`tier-badge ${sub.tier?.toLowerCase() || 'free'}`}>
                      {sub.tier}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Status: {sub.status}
                    </span>
                  </div>
                </div>

                {sub.status === 'active' && (
                  <button
                    onClick={() => handleCancel(sub.creatorId)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.75rem',
                      color: '#f87171',
                      borderColor: 'rgba(248, 113, 113, 0.3)'
                    }}
                  >
                    <XCircle size={14} /> Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
