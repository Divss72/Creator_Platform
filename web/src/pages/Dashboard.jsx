import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { Users, DollarSign, Eye, Heart, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [topContent, setTopContent] = useState([]);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [ov, ts, tc] = await Promise.all([
          api.getAnalyticsOverview(),
          api.getAnalyticsTimeseries(range),
          api.getAnalyticsTopContent(5)
        ]);
        setOverview(ov);
        setTimeseries(ts.series || []);
        setTopContent(tc.items || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [range]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Creator Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          Real-time metrics, audience growth, and post performance for{' '}
          {user?.displayName || user?.username}.
        </p>
      </div>

      {/* Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 32
        }}
      >
        <div className="glass-panel" style={{ borderRadius: 16, padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-secondary)',
              marginBottom: 8
            }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Active Subscribers</span>
            <Users size={18} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            {overview?.subscribers?.total ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Free: {overview?.subscribers?.free ?? 0} | Pro: {overview?.subscribers?.pro ?? 0} | VIP:{' '}
            {overview?.subscribers?.vip ?? 0}
          </div>
        </div>

        <div className="glass-panel" style={{ borderRadius: 16, padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-secondary)',
              marginBottom: 8
            }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Monthly Recurring Rev.</span>
            <DollarSign size={18} style={{ color: 'var(--tier-free)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            ${((overview?.estimatedMonthlyRevenueCents ?? 0) / 100).toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Estimated based on active tiers
          </div>
        </div>

        <div className="glass-panel" style={{ borderRadius: 16, padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-secondary)',
              marginBottom: 8
            }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Total Views</span>
            <Eye size={18} style={{ color: 'var(--tier-pro)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{overview?.views?.total ?? 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Unique daily views logged
          </div>
        </div>

        <div className="glass-panel" style={{ borderRadius: 16, padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-secondary)',
              marginBottom: 8
            }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Total Likes</span>
            <Heart size={18} style={{ color: 'var(--accent-pink)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{overview?.likes?.total ?? 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Member engagement reactions
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-panel" style={{ borderRadius: 20, padding: 24, marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Performance Over Time</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {['7d', '30d', '90d'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  background: range === r ? 'var(--accent-purple)' : 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 300, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: '#12141c',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8
                }}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#8b5cf6"
                fillOpacity={1}
                fill="url(#viewGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Content */}
      <div className="glass-panel" style={{ borderRadius: 20, padding: 24 }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16 }}>
          Top Performing Posts
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {topContent.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--accent-purple)' }}
                >
                  #{idx + 1}
                </span>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#fff' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Tier: {item.minTier} •{' '}
                    {new Date(item.publishedAt || item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={14} /> {item.views || 0}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Heart size={14} /> {item.likes || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
