import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, LayoutDashboard, LogOut, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // ==========================================
  // THE UX FIX: Hide Navbar on specific pages
  // ==========================================
  // Hide on Login, Payment, and the Seat Selection screen 
  // because those pages have their own custom headers and sticky bottom bars!
  const isSeatSelection = location.pathname.includes('/event/') && location.pathname.includes('/seats');
  const hideNavbarPaths = ['/login', '/payment'];
  
  if (hideNavbarPaths.includes(location.pathname) || isSeatSelection) {
    return null; 
  }

  const isHome = location.pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* ==========================================
          DESKTOP TOP NAVBAR (Visible on laptop/PC)
         ========================================== */}
      <nav className="hidden md:flex bg-zinc-950/90 border-b border-zinc-800 px-8 py-4 sticky top-0 z-50 justify-between items-center backdrop-blur-xl">
        <div className="flex items-center gap-6">
          {!isHome && (
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center gap-2 text-zinc-400 hover:text-red-500 font-medium transition-colors group"
            >
              <ArrowLeft size={18} className="transform group-hover:-translate-x-1 transition-transform" /> Back
            </button>
          )}
          <h1 
            onClick={() => navigate('/')} 
            className="text-2xl font-black tracking-wider text-red-600 cursor-pointer select-none uppercase"
          >
            Concurrent<span className="text-zinc-100 font-light">Book</span>
          </h1>
        </div>
        
        {user && (
          <div className="flex items-center gap-2 font-semibold text-sm">
            {user.role === 'admin' && (
              <button 
                onClick={() => navigate('/admin')} 
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                  location.pathname.startsWith('/admin') 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30' 
                    : 'text-zinc-400 hover:text-purple-400 hover:bg-zinc-900'
                }`}
              >
                <LayoutDashboard size={18} /> Admin
              </button>
            )}
            
            <button 
              onClick={() => navigate('/profile')} 
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                location.pathname === '/profile' 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' 
                  : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <User size={18} /> Profile
            </button>
            
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-950/30 transition-colors ml-2"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </nav>

      {/* ==========================================
          MOBILE TOP LOGO & BACK HEADER
         ========================================== */}
      <div className="flex md:hidden bg-zinc-950/90 backdrop-blur-xl text-zinc-100 px-4 py-3 sticky top-0 z-50 justify-between items-center border-b border-zinc-800/50">
        {!isHome ? (
          <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-red-500 p-1 transition-colors">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <div className="w-6" /> // Spacer to balance layout
        )}
        <h1 
          onClick={() => navigate('/')} 
          className="text-xl font-black tracking-wider text-red-600 uppercase cursor-pointer"
        >
          Concurrent<span className="text-zinc-100 font-light">Book</span>
        </h1>
        <div className="w-6" /> {/* Spacer */}
      </div>

      {/* ==========================================
          MOBILE BOTTOM NAVIGATION TAB BAR
         ========================================== */}
      {user && (
        <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 pb-safe-bottom pt-2 px-4 z-50 justify-around items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <button 
            onClick={() => navigate('/')} 
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              isHome ? 'text-red-500 scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Home size={22} className={isHome ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
            <span className="text-[10px] tracking-wide font-bold">Home</span>
          </button>

          {user.role === 'admin' && (
            <button 
              onClick={() => navigate('/admin')} 
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                location.pathname.startsWith('/admin') ? 'text-purple-500 scale-105' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutDashboard size={22} className={location.pathname.startsWith('/admin') ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
              <span className="text-[10px] tracking-wide font-bold">Admin</span>
            </button>
          )}

          <button 
            onClick={() => navigate('/profile')} 
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
              location.pathname === '/profile' ? 'text-red-500 scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <User size={22} className={location.pathname === '/profile' ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
            <span className="text-[10px] tracking-wide font-bold">Profile</span>
          </button>

          <button 
            onClick={handleLogout} 
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-zinc-500 hover:text-red-500 transition-colors"
          >
            <LogOut size={22} strokeWidth={2} />
            <span className="text-[10px] tracking-wide font-bold">Logout</span>
          </button>
        </nav>
      )}
    </>
  );
};

export default Navbar;