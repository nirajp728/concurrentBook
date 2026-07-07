import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axiosConfig';
import QRCode from 'react-qr-code';
import { Camera, Ticket, Wallet, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { logout } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [activeTab, setActiveTab] = useState('bookings'); 
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/users/profile'); 
        setProfileData(response.data);
      } catch (error) {
        console.error("Failed to fetch profile", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profileImage', file);

    setIsUploading(true);
    try {
      const response = await api.post('/users/upload-profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProfileData(prev => ({ ...prev, profilePicture: response.data.imageUrl }));
    } catch (error) {
      console.error("Failed to upload image:", error);
      alert("Image upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) return <div className="text-center mt-32 text-zinc-500 font-medium animate-pulse">Loading secure profile...</div>;
  if (!profileData) return <div className="text-center mt-32 text-red-500 font-bold">Failed to load profile data.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24 md:pb-12 animate-fade-in">
      
      {/* HEADER & WALLET SECTION */}
      <div className="bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-zinc-800 p-8 mb-8 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl">
        
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          {/* S3 PROFILE PICTURE UPLOAD UI */}
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
            <div className={`relative w-28 h-28 rounded-full border-4 border-zinc-800 shadow-2xl overflow-hidden transition-all duration-300 group-hover:border-red-600 ${isUploading ? 'opacity-50 scale-95' : 'opacity-100'}`}>
              <img 
                src={profileData.profilePicture || "https://ui-avatars.com/api/?name=" + (profileData.name || 'User') + "&background=18181b&color=ef4444&bold=true"} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white" size={24} />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          {/* USER INFO */}
          <div>
            <h1 className="text-3xl font-black text-white tracking-wide mb-1">{profileData.name || 'User'}</h1>
            <p className="text-zinc-400 font-medium">{profileData.email}</p>
          </div>
        </div>

        {/* DIGITAL WALLET CARD */}
        <div className="w-full md:w-auto bg-gradient-to-br from-zinc-950 to-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-inner flex flex-col items-center md:items-end min-w-[250px]">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-2">
            <Wallet size={14} className="text-red-500" /> Digital Balance
          </p>
          <p className="text-4xl font-black text-white tracking-tighter">
            <span className="text-red-600 mr-1">₹</span>{profileData.wallet}
          </p>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex gap-2 border-b border-zinc-800 mb-8 pb-2 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('bookings')}
          className={`font-bold text-sm md:text-base px-6 py-3 rounded-t-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'bookings' ? 'bg-zinc-900 text-red-500 border-b-2 border-red-600' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
        >
          <Ticket size={18} /> Ticket Ledger
        </button>
        <button 
          onClick={() => setActiveTab('wallet')}
          className={`font-bold text-sm md:text-base px-6 py-3 rounded-t-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'wallet' ? 'bg-zinc-900 text-red-500 border-b-2 border-red-600' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
        >
          <Wallet size={18} /> Financial History
        </button>
      </div>

      {/* BOOKING HISTORY TAB */}
      {activeTab === 'bookings' && (
        <div className="space-y-4 animate-slide-up">
          {profileData.bookingHistory?.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed">
              <Ticket className="mx-auto text-zinc-700 mb-4" size={48} />
              <p className="text-zinc-400 font-medium">No bookings found. Time to catch a movie!</p>
            </div>
          ) : (
            profileData.bookingHistory?.slice().reverse().map((booking, index) => (
              <div key={index} className={`bg-zinc-900/50 backdrop-blur-sm rounded-2xl border p-5 md:p-6 flex flex-col md:flex-row gap-6 items-center transition-all hover:bg-zinc-900 ${booking.status === 'REFUNDED' ? 'border-amber-900/50' : booking.status === 'FAILED' ? 'border-red-900/50' : 'border-zinc-800 hover:border-zinc-700'}`}>
                
                <div className="flex-shrink-0 flex flex-col items-center justify-center w-32">
                  {booking.status === 'SUCCESS' && (
                    <div className="bg-white p-2 rounded-xl shadow-lg">
                      <QRCode value={booking.transactionId || "success"} size={80} level="L" />
                    </div>
                  )}
                  <span className={`mt-4 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${
                    booking.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-500 border border-emerald-900' : 
                    booking.status === 'REFUNDED' ? 'bg-amber-950 text-amber-500 border border-amber-900' : 
                    'bg-red-950 text-red-500 border border-red-900'
                  }`}>
                    {booking.status}
                  </span>
                </div>

                <div className="flex-grow w-full text-center md:text-left">
                  <h3 className="text-2xl font-black text-white mb-1">
                    {booking.eventId?.title || 'Unknown Experience'}
                  </h3>
                  <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-4">
                    {new Date(booking.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800 w-full">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Seats</p>
                      <p className="font-bold text-zinc-200">{booking.seats.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Amount</p>
                      <p className="font-bold text-zinc-200">₹{booking.amountPaid}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* WALLET HISTORY TAB */}
      {activeTab === 'wallet' && (
        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-800 overflow-hidden animate-slide-up">
          {profileData.walletHistory?.length === 0 ? (
            <p className="text-zinc-500 text-center py-20 font-medium">No financial transactions yet.</p>
          ) : (
            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-950/80 border-b border-zinc-800">
                  <tr>
                    <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest whitespace-nowrap">Date & Time</th>
                    <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest">Type</th>
                    <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest">Description</th>
                    <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {profileData.walletHistory?.slice().reverse().map((txn, index) => (
                    <tr key={index} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="p-5 text-xs font-semibold text-zinc-400 whitespace-nowrap">
                        {new Date(txn.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}
                      </td>
                      <td className="p-5">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded border uppercase tracking-wider ${
                          txn.transactionType === 'CREDIT' ? 'bg-emerald-950/50 text-emerald-500 border-emerald-900/50' : 
                          txn.transactionType === 'REFUND' ? 'bg-blue-950/50 text-blue-400 border-blue-900/50' : 
                          'bg-red-950/50 text-red-500 border-red-900/50'
                        }`}>
                          {txn.transactionType}
                        </span>
                      </td>
                      <td className="p-5 text-sm text-zinc-300 font-medium min-w-[200px]">{txn.description}</td>
                      <td className={`p-5 text-right font-black whitespace-nowrap text-lg tracking-tight ${
                        txn.transactionType === 'DEBIT' ? 'text-red-500' : 'text-emerald-500'
                      }`}>
                        {txn.transactionType === 'DEBIT' ? '-' : '+'}₹{txn.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {/* MOBILE LOGOUT BUTTON (Only visible on small screens to match bottom nav behavior) */}
      <div className="md:hidden mt-12 flex justify-center">
        <button onClick={logout} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-red-500 font-bold hover:bg-red-950 transition-colors">
          <LogOut size={18} /> Sign Out
        </button>
      </div>

    </div>
  );
};

export default Profile;