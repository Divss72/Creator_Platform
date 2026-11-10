import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getSession, setSession } from '../services/api';

const AuthContext = createContext(null);

export const DEMO_PERSONAS = [
  {
    role: 'Creator',
    name: 'Alice (VIP)',
    email: 'alice@demo.creatorhub.test',
    password: 'Password123!'
  },
  {
    role: 'Creator',
    name: 'Bob (Tech)',
    email: 'bob@demo.creatorhub.test',
    password: 'Password123!'
  },
  {
    role: 'Creator',
    name: 'Charlie (Art)',
    email: 'charlie@demo.creatorhub.test',
    password: 'Password123!'
  },
  {
    role: 'Fan',
    name: 'VIP Subscriber',
    email: 'sub_alice_vip_1@demo.creatorhub.test',
    password: 'Password123!'
  },
  {
    role: 'Fan',
    name: 'Free Fan',
    email: 'sub_alice_free_1@demo.creatorhub.test',
    password: 'Password123!'
  }
];

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession());
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setSession(res.token, res.user);
      setSessionState({ token: res.token, user: res.user });
      return res.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setSession(null, null);
    setSessionState({ token: null, user: null });
  };

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        token: session.token,
        isAuthenticated: !!session.token,
        isCreator: session.user?.role === 'creator',
        login,
        logout,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
