import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import { RequireAuth, RequireAdmin } from './components/ProtectedRoute';

import Navbar from './components/Navbar';
import LoginRegister from './pages/LoginRegister';
import HomeSearch from './pages/HomeSearch';
import SeatSelection from './pages/SeatSelection';
import Payment from './pages/Payment';

import Profile from './pages/Profile';

import AdminDashboard from './admin/Dashboard';
import UserManagement from './admin/UserManagement';
import EventManagement from './admin/EventManagement';

const GlobalSocketListener = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?._id && !user?.id) return;

    const userId = user._id || user.id;

    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', {
      transports: import.meta.env.PROD ? ['polling', 'websocket'] : ['websocket']
    });

    socket.on(`refundAlert_${userId}`, (data) => {
      toast.error(data.message, {
        duration: 12000,
        icon: '🚨',
        style: { border: '2px solid #ef4444', padding: '16px', color: '#1f2937', fontWeight: 'bold' },
      });
    });

    return () => socket.disconnect();
  }, [user]);

  return null;
};

const SessionAlert = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);

    if (queryParams.get('expired') === 'true') {
      toast.error("Your session expired for security reasons. Please log in again.", { duration: 5000 });
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <GlobalSocketListener />
        <SessionAlert />

        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
          <Navbar />
          <main className="flex-grow pt-4 pb-12">
            <Routes>
              <Route path="/login" element={<LoginRegister />} />

              <Route path="/" element={<RequireAuth><HomeSearch /></RequireAuth>} />
              <Route path="/event/:eventId/seats" element={<RequireAuth><SeatSelection /></RequireAuth>} />
              <Route path="/payment" element={<RequireAuth><Payment /></RequireAuth>} />

              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

              <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
              <Route path="/admin/users" element={<RequireAdmin><UserManagement /></RequireAdmin>} />
              <Route path="/admin/events" element={<RequireAdmin><EventManagement /></RequireAdmin>} />
            </Routes>
          </main>
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;