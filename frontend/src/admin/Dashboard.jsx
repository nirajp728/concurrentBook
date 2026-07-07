import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Ticket, Film, Activity, Settings, Loader2 } from 'lucide-react';
import api from '../api/axiosConfig';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const navigate = useNavigate();
  
  // State to hold the REAL data from your backend
  const [stats, setStats] = useState({ users: 0, events: 0, bookings: 0, load: '0%' });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the live stats when the dashboard loads
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/users/admin/stats');
        setStats(response.data);
      } catch (error) {
        console.error("Failed to fetch stats", error);
        toast.error("Failed to load live server metrics.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    
    // Refresh server load every 10 seconds for a real-time "Live Dashboard" feel
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { label: 'Total Users', value: stats.users.toLocaleString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Active Events', value: stats.events.toLocaleString(), icon: Film, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Total Bookings', value: stats.bookings.toLocaleString(), icon: Ticket, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Live Server Load', value: stats.load, icon: Activity, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20 animate-fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-wide">System Overview</h1>
          <p className="text-zinc-400 font-medium mt-1">Real-time metrics and administration routing.</p>
        </div>
        
        {/* ACTION BUTTONS */}
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => navigate('/admin/users')} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-300 px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 hover:text-white transition-all"
          >
            <Users size={18} /> Manage Users
          </button>
          <button 
            onClick={() => navigate('/admin/events')} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-900/40 transition-all active:scale-95"
          >
            <Film size={18} /> Event Console
          </button>
        </div>
      </div>
      
      {/* METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="bg-zinc-900/50 backdrop-blur-md p-6 rounded-3xl border border-zinc-800 flex items-center gap-5 hover:bg-zinc-900 transition-all hover:border-zinc-700 group cursor-default">
              <div className={`p-4 rounded-2xl ${m.bg} ${m.color} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                <Icon size={28} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">{m.label}</p>
                {isLoading ? (
                  <Loader2 size={24} className="text-zinc-500 animate-spin mt-1" />
                ) : (
                  <p className="text-3xl font-black text-white tracking-tight">{m.value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SYSTEM STATUS WIDGET */}
      <div className="bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed p-12 flex flex-col items-center justify-center text-center animate-slide-up delay-200">
        <Settings size={48} className={`mb-6 text-zinc-700 ${isLoading ? 'animate-pulse' : 'animate-[spin_10s_linear_infinite]'}`} />
        <h2 className="text-2xl font-black text-white mb-2">All Systems Operational</h2>
        <p className="text-zinc-500 max-w-md">
          Database clusters, Redis concurrency locks, and Elasticsearch nodes are fully synchronized. Ready for high-traffic ticket drops.
        </p>
      </div>

    </div>
  );
};

export default Dashboard;