import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext';
import {
  Sparkles,
  Compass,
  LayoutGrid,
  BarChart2,
  PlusCircle,
  Settings,
  LogOut,
  LogIn
} from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, isCreator, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handlePersonaSwitch = async (e) => {
    const val = e.target.value;
    if (!val) return;
    const persona = DEMO_PERSONAS.find((p) => p.email === val);
    if (persona) {
      await login(persona.email, persona.password);
      navigate(0); // refresh view
    }
  };

  return (
    <header
      className="glass-panel"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 24px'
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 800,
              fontSize: '1.25rem'
            }}
          >
            <span
              style={{
                background: 'var(--accent-gradient)',
                padding: '6px 10px',
                borderRadius: 8,
                color: '#fff',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Sparkles size={18} />
            </span>
            <span style={{ letterSpacing: '-0.02em' }}>CreatorHub</span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link
              to="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: location.pathname === '/' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              <Compass size={16} /> Discover
            </Link>
            <Link
              to="/feed"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.875rem',
                fontWeight: 600,
                color:
                  location.pathname === '/feed' ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
            >
              <LayoutGrid size={16} /> Feed
            </Link>
            {isCreator && (
              <>
                <Link
                  to="/dashboard"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color:
                      location.pathname === '/dashboard'
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)'
                  }}
                >
                  <BarChart2 size={16} /> Analytics
                </Link>
                <Link
                  to="/studio"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color:
                      location.pathname === '/studio'
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)'
                  }}
                >
                  <PlusCircle size={16} /> Studio
                </Link>
              </>
            )}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Persona quick switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Persona:</span>
            <select
              onChange={handlePersonaSwitch}
              value={user?.email || ''}
              style={{
                fontSize: '0.8125rem',
                padding: '4px 8px',
                borderRadius: 6,
                background: '#1c1f2b'
              }}
            >
              <option value="" disabled>
                Switch User...
              </option>
              {DEMO_PERSONAS.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.role}: {p.name}
                </option>
              ))}
            </select>
          </div>

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link to="/settings" title="Settings" style={{ color: 'var(--text-secondary)' }}>
                <Settings size={18} />
              </Link>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {user.displayName || user.username}
              </span>
              <button
                onClick={logout}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                title="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
            >
              <LogIn size={14} /> Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
