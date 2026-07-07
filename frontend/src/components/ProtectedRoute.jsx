import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

// Guard for ANY logged in user
export const RequireAuth = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

// Guard strictly for Admins
export const RequireAdmin = ({ children }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  if (!user || user.role !== 'admin') {
    // If they aren't an admin, kick them back to the home page
    return <Navigate to="/" replace />;
  }
  return children;
};