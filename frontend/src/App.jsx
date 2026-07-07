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

// ==========================================
// 1. INVISIBLE GLOBAL SOCKET LISTENER
// ==========================================
const GlobalSocketListener = () => {
  const { user } = useAuth(); 

  useEffect(() => {
    if (!user?._id && !user?.id) return;
    
    const userId = user._id || user.id; 

    // THE FIX: Forcing 'websocket' transport kills the annoying console errors!
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', {
      transports: ['websocket']
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

// ==========================================
// 2. INVISIBLE SESSION EXPIRATION CATCHER
// ==========================================
const SessionAlert = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    
    // If axiosConfig.js threw us here with the expired flag...
    if (queryParams.get('expired') === 'true') {
      toast.error("Your session expired for security reasons. Please log in again.", { duration: 5000 });
      
      // Clean the URL instantly so the toast doesn't fire again if they refresh the page
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  return null;
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Invisible Background Workers */}
        <GlobalSocketListener /> 
        <SessionAlert />

        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
          <Navbar />
          <main className="flex-grow pt-4 pb-12">
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<LoginRegister />} />

              {/* Protected User Routes */}
              <Route path="/" element={<RequireAuth><HomeSearch /></RequireAuth>} />
              <Route path="/event/:eventId/seats" element={<RequireAuth><SeatSelection /></RequireAuth>} />
              <Route path="/payment" element={<RequireAuth><Payment /></RequireAuth>} />
             
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              
              {/* Note: I removed the duplicate /payment-success route since /success handles it! */}

              {/* Protected Admin Routes */}
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