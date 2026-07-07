import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';
import { Loader2, Ticket, Mail, Lock, User as UserIcon } from 'lucide-react';
import api from '../api/axiosConfig'; // CRITICAL: Using your custom configured API

const LoginRegister = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState(''); // Added Name state for registration
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    // Minor validation before hitting the server
    if (!isLogin && !name.trim()) {
      toast.error('Please enter your name.');
      setIsProcessing(false);
      return;
    }

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      
      const payload = { email, password };

      if (!isLogin) payload.name = name; // Only send name if registering

      // Making the REAL network request using your custom api instance
      const response = await api.post(endpoint, payload);

      const { token, user: userData } = response.data;

      login(token, userData);
      toast.success(isLogin ? `Welcome back!` : `Account created successfully!`);
      
      if (userData.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        const origin = location.state?.from?.pathname || '/';
        navigate(origin, { replace: true });
      }

    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Authentication failed. Try again.';
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex justify-center items-center px-4 py-12 animate-fade-in relative overflow-hidden">
      <Toaster position="top-right" />

      {/* AESTHETIC BACKGROUND GLOW */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      <div className="max-w-md w-full bg-zinc-900/60 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl border border-zinc-800 shadow-2xl relative z-10">
        
        {/* LOGO & HEADER */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-inner mb-4">
            <Ticket className="text-red-600" size={32} />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-wider text-red-600 select-none">
            Concurrent<span className="text-white font-light">Book</span>
          </h2>
          <p className="text-zinc-400 mt-2 font-medium">
            {isLogin ? 'Sign in to access your tickets.' : 'Join to secure your seats.'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* NAME FIELD (Only for Registration) */}
          {!isLogin && (
            <div className="space-y-1 animate-slide-up">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 block">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  required={!isLogin} 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full pl-11 pr-4 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 text-white placeholder-zinc-600 transition-all font-medium" 
                  placeholder="John Doe" 
                />
              </div>
            </div>
          )}

          {/* EMAIL FIELD */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                required 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full pl-11 pr-4 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 text-white placeholder-zinc-600 transition-all font-medium" 
                placeholder="you@example.com" 
              />
            </div>
          </div>
          
          {/* PASSWORD FIELD */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                required 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full pl-11 pr-4 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 text-white transition-all font-medium" 
                placeholder="••••••••"
              />
            </div>
          </div>
          
          {/* SUBMIT BUTTON */}
          <button 
            disabled={isProcessing} 
            type="submit" 
            className={`w-full py-4 rounded-xl font-black text-lg text-white transition-all shadow-xl flex justify-center items-center gap-2 mt-8 ${
              isProcessing ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-red-900/40 active:scale-95'
            }`}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={24} /> : (isLogin ? 'Secure Sign In' : 'Create Account')}
          </button>
        </form>

        {/* TOGGLE LOGIN/REGISTER */}
        <p className="text-center mt-8 text-sm text-zinc-500 font-medium">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setName('');
              setEmail('');
              setPassword('');
            }} 
            className="text-red-500 font-bold hover:text-red-400 transition-colors focus:outline-none"
          >
            {isLogin ? 'Register here' : 'Login here'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginRegister;