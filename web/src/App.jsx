import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Discover from './pages/Discover';
import Home from './pages/Home';
import PostPage from './pages/PostPage';
import Dashboard from './pages/Dashboard';
import Studio from './pages/Studio';
import Settings from './pages/Settings';
import Login from './pages/Login';

function ProtectedRoute({ children, creatorOnly = false }) {
  const { isAuthenticated, isCreator } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (creatorOnly && !isCreator) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              {/* Route "/" is Discover Canvas */}
              <Route path="/" element={<Discover />} />
              {/* Route "/feed" is Traditional List Feed */}
              <Route path="/feed" element={<Home />} />
              {/* Post detail */}
              <Route path="/posts/:id" element={<PostPage />} />
              {/* Creator only */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute creatorOnly>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/studio"
                element={
                  <ProtectedRoute creatorOnly>
                    <Studio />
                  </ProtectedRoute>
                }
              />
              {/* User settings */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              {/* Auth */}
              <Route path="/login" element={<Login />} />
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
