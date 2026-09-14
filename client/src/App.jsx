import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import History from './pages/History';
import Results from './pages/Results';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in on app load
    fetch('/api/auth/check')
      .then((res) => {
        if (res.ok) setIsAuthenticated(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login setAuth={setIsAuthenticated} />
        } />
        
        <Route path="/" element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <DashboardLayout setAuth={setIsAuthenticated} />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="upload" element={<Upload />} />
          <Route path="history" element={<History />} />
          <Route path="results/:jobId" element={<Results />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
