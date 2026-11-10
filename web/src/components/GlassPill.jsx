import React from 'react';
import { Compass, LayoutList, RotateCcw, Filter, Sparkles } from 'lucide-react';

export default function GlassPill({
  currentFilter,
  onFilterChange,
  isListView,
  onToggleListView,
  onRecenter,
  postCount = 0
}) {
  return (
    <nav
      className="glass-panel"
      role="navigation"
      aria-label="Discover controls"
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        borderRadius: 'var(--radius-pill)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingRight: 8,
          borderRight: '1px solid var(--border-subtle)'
        }}
      >
        <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Discover
        </span>
        <span
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.06)',
            padding: '2px 6px',
            borderRadius: 10
          }}
        >
          {postCount}
        </span>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {['all', 'free', 'pro', 'vip'].map((filter) => {
          const active = currentFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              style={{
                background: active ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: active ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                borderRadius: 'var(--radius-pill)',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                transition: 'all 0.15s ease'
              }}
            >
              {filter}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 8,
          borderLeft: '1px solid var(--border-subtle)'
        }}
      >
        {!isListView && (
          <button
            onClick={onRecenter}
            title="Recenter Canvas (Home key)"
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s'
            }}
          >
            <RotateCcw size={16} />
          </button>
        )}

        <button
          onClick={onToggleListView}
          title={isListView ? 'Switch to Canvas View' : 'Switch to Accessible List View'}
          style={{
            background: isListView ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
            color: isListView ? 'var(--accent-purple)' : 'var(--text-secondary)',
            border: isListView ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.75rem',
            fontWeight: 600
          }}
        >
          {isListView ? <Compass size={14} /> : <LayoutList size={14} />}
          <span>{isListView ? 'Canvas' : 'List'}</span>
        </button>
      </div>
    </nav>
  );
}
