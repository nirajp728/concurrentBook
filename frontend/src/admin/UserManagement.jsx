import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Trash2, Search, Loader2, Shield, User as UserIcon, Wallet, X } from 'lucide-react';
import api from '../api/axiosConfig';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [walletUser, setWalletUser] = useState(null);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletDescription, setWalletDescription] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/users', { params: { search: searchQuery } });
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users from database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchUsers(); }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleDelete = async (id, email) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${email}?`)) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success(`Deleted user ${email} successfully`);
      setUsers(users.filter(u => u.id !== id));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const openWalletModal = (user) => {
    setWalletUser(user);
    setWalletAmount('');
    setWalletDescription('');
  };

  const closeWalletModal = () => setWalletUser(null);

  const handleWalletSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(walletAmount);
    if (!amount || amount === 0) return toast.error('Enter a non-zero amount');

    setIsAdjusting(true);
    try {
      const response = await api.patch(`/users/${walletUser.id}/wallet`, {
        amount,
        description: walletDescription || undefined
      });
      toast.success(`${amount > 0 ? 'Credited' : 'Debited'} ₹${Math.abs(amount)} ${amount > 0 ? 'to' : 'from'} ${walletUser.email}`);
      setUsers(users.map(u => u.id === walletUser.id ? { ...u, wallet: response.data.wallet } : u));
      closeWalletModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to adjust wallet');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-20 animate-fade-in">
      <Toaster position="top-right" />

      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-wide">User Management</h1>
        <p className="text-zinc-400 font-medium mt-1">Search, monitor, and manage registered accounts.</p>
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden">

        <div className="p-6 border-b border-zinc-800">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-500" size={20} />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-zinc-600 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-zinc-950/80 border-b border-zinc-800">
              <tr>
                <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest whitespace-nowrap">User</th>
                <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest">Role</th>
                <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest text-center">Bookings</th>
                <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest text-right">Wallet</th>
                <th className="p-5 text-[10px] text-zinc-500 font-black uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {isLoading ? (
                <tr><td colSpan="5" className="text-center py-20">
                  <Loader2 className="animate-spin mx-auto text-red-600 mb-2" size={32} />
                  <span className="text-zinc-500 font-medium text-sm">Loading users...</span>
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-20">
                  <UserIcon className="mx-auto text-zinc-700 mb-3" size={40} />
                  <span className="text-zinc-400 font-bold text-lg block">No users found.</span>
                  <span className="text-zinc-600 text-sm">Try adjusting your search criteria.</span>
                </td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-800/40 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                          {u.role === 'admin' ? <Shield size={16} className="text-emerald-500" /> : <UserIcon size={16} className="text-zinc-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white tracking-wide">{u.name || 'Unknown User'}</p>
                          <p className="text-xs text-zinc-500 font-medium">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded border uppercase tracking-wider ${
                        u.role === 'admin' ? 'bg-emerald-950/50 text-emerald-500 border-emerald-900/50' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-5 text-center">
                      <span className="text-sm font-bold text-zinc-300 bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800">{u.bookings}</span>
                    </td>
                    <td className="p-5 text-right font-black text-emerald-500">₹{u.wallet}</td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => openWalletModal(u)}
                          className="text-zinc-500 hover:text-emerald-500 hover:bg-emerald-950/50 p-2 rounded-xl transition-all border border-transparent hover:border-emerald-900/50"
                          title="Adjust Wallet"
                        >
                          <Wallet size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          className="text-zinc-500 hover:text-red-500 hover:bg-red-950/50 p-2 rounded-xl transition-all border border-transparent hover:border-red-900/50"
                          title="Delete User"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {walletUser && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeWalletModal}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Wallet className="text-emerald-500" size={20} /> Adjust Wallet
              </h3>
              <button onClick={closeWalletModal} className="text-zinc-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-zinc-400 text-sm mb-4">
              {walletUser.name} <span className="text-zinc-600">({walletUser.email})</span><br />
              Current balance: <span className="text-emerald-500 font-bold">₹{walletUser.wallet}</span>
            </p>

            <form onSubmit={handleWalletSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">
                  Amount (use negative to deduct, e.g. -100)
                </label>
                <input
                  required
                  type="number"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-600"
                  placeholder="e.g. 500 or -200"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Reason (optional)</label>
                <input
                  type="text"
                  value={walletDescription}
                  onChange={(e) => setWalletDescription(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-600"
                  placeholder="e.g. Compensation for outage"
                />
              </div>
              <button
                disabled={isAdjusting}
                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                {isAdjusting ? <Loader2 className="animate-spin" size={20} /> : 'Confirm Adjustment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;