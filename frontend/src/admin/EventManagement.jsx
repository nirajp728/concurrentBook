import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ImagePlus, Calendar, MapPin, Loader2, Ticket, Settings2, X, Lock, CheckCircle2, RefreshCw, Unlock } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../api/axiosConfig';

const EventManagement = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '', type: 'Movie', price: '', venue: '', date: '', posterUrl: ''
  });

  const [manageEvent, setManageEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [locks, setLocks] = useState([]);
  const [isOpsLoading, setIsOpsLoading] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const response = await api.get('/events?sort=createdAt:-1');
      setEvents(response.data.events || response.data || []);
    } catch (error) {
      toast.error('Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.append('posterImage', file);
    setIsUploading(true);
    try {
      const response = await api.post('/events/upload-poster', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData({ ...formData, posterUrl: response.data.imageUrl });
      toast.success('Poster uploaded to S3!');
    } catch (error) {
      toast.error('Failed to upload poster.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.posterUrl) return toast.error("Please upload a poster first!");
    setIsSubmitting(true);
    try {
      await api.post('/events', formData);
      toast.success('Event deployed successfully!');
      setFormData({ title: '', type: 'Movie', price: '', venue: '', date: '', posterUrl: '' });
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event? This will not refund existing tickets automatically.")) return;
    try {
      await api.delete(`/events/${id}`);
      toast.success('Event deleted');
      fetchEvents();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const openManageModal = (event) => {
    setManageEvent(event);
    setActiveTab('bookings');
    fetchOpsData(event._id || event.id, 'bookings');
  };

  const closeManageModal = () => {
    setManageEvent(null);
    setBookings([]);
    setLocks([]);
  };

  const fetchOpsData = async (eventId, tab) => {
    setIsOpsLoading(true);
    try {
      if (tab === 'bookings') {
        const res = await api.get(`/admin/events/${eventId}/bookings`);
        setBookings(res.data.bookings);
      } else {
        const res = await api.get(`/admin/events/${eventId}/locks`);
        setLocks(res.data.locks);
      }
    } catch (error) {
      toast.error(`Failed to load ${tab}`);
    } finally {
      setIsOpsLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    fetchOpsData(manageEvent._id || manageEvent.id, tab);
  };

  const handleForceRelease = async (seatNumber) => {
    const eventId = manageEvent._id || manageEvent.id;
    if (!window.confirm(`Force-release the lock on seat ${seatNumber}?`)) return;
    try {
      await api.delete(`/admin/events/${eventId}/locks/${seatNumber}`);
      toast.success(`Seat ${seatNumber} released`);
      fetchOpsData(eventId, 'locks');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to release lock');
    }
  };

  const handleCancelBooking = async (seatNumber) => {
    const eventId = manageEvent._id || manageEvent.id;
    if (!window.confirm(`Cancel seat ${seatNumber} and refund the customer? This issues a real Stripe refund.`)) return;
    try {
      await api.post(`/admin/events/${eventId}/bookings/${seatNumber}/cancel`);
      toast.success(`Seat ${seatNumber} cancelled and refunded`);
      fetchOpsData(eventId, 'bookings');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel booking');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20 animate-fade-in">
      <Toaster position="top-right" />

      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-wide">Event Command Center</h1>
        <p className="text-zinc-400 font-medium">Deploy and manage live experiences across your clusters.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-zinc-800 p-6 shadow-2xl sticky top-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="text-red-500" /> Deploy New Event
            </h2>

            <div
              onClick={() => fileInputRef.current.click()}
              className={`relative w-full aspect-[2/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all mb-6 group ${
                formData.posterUrl ? 'border-zinc-700' : 'border-zinc-800 hover:border-red-500 hover:bg-zinc-900'
              }`}
            >
              {formData.posterUrl ? (
                <>
                  <img src={formData.posterUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-50 transition-opacity" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/60">
                    <ImagePlus className="text-white mb-2" size={32} />
                    <span className="text-white font-bold text-sm">Change Poster</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-zinc-500 group-hover:text-red-500 transition-colors">
                  {isUploading ? <Loader2 className="animate-spin mb-2" size={32} /> : <ImagePlus className="mb-2" size={32} />}
                  <span className="font-bold text-sm">{isUploading ? 'Uploading to S3...' : 'Upload Poster'}</span>
                  <span className="text-xs mt-1">High-Res JPEG or PNG</span>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Title</label>
                <input required name="title" value={formData.title} onChange={handleInputChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600" placeholder="e.g. Interstellar IMAX" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Type</label>
                  <select name="type" value={formData.type} onChange={handleInputChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-600">
                    <option className="bg-zinc-900" value="Movie">Movie</option>
                    <option className="bg-zinc-900" value="Concert">Concert</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Price (₹)</label>
                  <input required type="number" min="0" name="price" value={formData.price} onChange={handleInputChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600" placeholder="500" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Date & Time</label>
                <input required type="datetime-local" name="date" value={formData.date} onChange={handleInputChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600 appearance-none" style={{ colorScheme: 'dark' }} />
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Venue</label>
                <input required name="venue" value={formData.venue} onChange={handleInputChange} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600" placeholder="e.g. PVR ICON" />
              </div>
            </div>

            <button disabled={isSubmitting || isUploading} className="w-full mt-6 bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-900/40 flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Deploy to Production'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-zinc-500">
              <Loader2 className="animate-spin mb-4" size={40} />
              <p>Syncing catalog...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed text-zinc-500">
              <Ticket size={48} className="mb-4 text-zinc-700" />
              <p className="text-xl font-bold text-zinc-400">No active events.</p>
              <p>Deploy your first event using the console.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.map((event) => (
                <div key={event._id || event.id} className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-3xl overflow-hidden flex flex-col group hover:border-zinc-700 transition-all">
                  <div className="h-48 relative overflow-hidden bg-zinc-950">
                    <img src={event.posterUrl} alt={event.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-3 right-3">
                      <span className="bg-zinc-950/80 backdrop-blur-sm border border-zinc-700 text-zinc-200 px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest shadow-xl">
                        {event.type}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex-grow flex flex-col justify-between bg-gradient-to-b from-transparent to-zinc-950">
                    <div>
                      <h3 className="text-xl font-black text-white mb-3 capitalize leading-tight">{event.title}</h3>
                      <div className="space-y-1.5 text-xs text-zinc-400 font-medium mb-4">
                        <p className="flex items-center gap-2"><Calendar size={14} className="text-red-500" /> {new Date(event.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}</p>
                        <p className="flex items-center gap-2"><MapPin size={14} className="text-red-500" /> {event.venue}</p>
                        <p className="flex items-center gap-2 font-bold text-zinc-300">₹{event.price} / Ticket</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => openManageModal(event)}
                        className="py-3 rounded-xl border border-zinc-700 text-zinc-300 font-bold hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-center gap-2"
                      >
                        <Settings2 size={16} /> Manage
                      </button>
                      <button
                        onClick={() => handleDelete(event._id || event.id)}
                        className="py-3 rounded-xl border border-red-900/50 text-red-500 font-bold hover:bg-red-950 hover:text-red-400 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} /> Terminate
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {manageEvent && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeManageModal}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
              <div>
                <h3 className="text-lg font-black text-white">{manageEvent.title}</h3>
                <p className="text-zinc-500 text-xs font-medium">Seat-level booking & lock management</p>
              </div>
              <button onClick={closeManageModal} className="text-zinc-500 hover:text-white"><X size={22} /></button>
            </div>

            <div className="flex gap-2 px-6 pt-4">
              <button
                onClick={() => switchTab('bookings')}
                className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'bookings' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                <CheckCircle2 size={16} /> Booked Seats
              </button>
              <button
                onClick={() => switchTab('locks')}
                className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === 'locks' ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                <Lock size={16} /> Locked Seats
              </button>
              <button
                onClick={() => switchTab(activeTab)}
                className="ml-auto px-3 py-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={16} className={isOpsLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow">
              {isOpsLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-zinc-500" size={32} /></div>
              ) : activeTab === 'bookings' ? (
                bookings.length === 0 ? (
                  <p className="text-zinc-500 text-center py-16">No confirmed bookings for this event yet.</p>
                ) : (
                  <div className="space-y-2">
                    {bookings.map((b) => (
                      <div key={b.seatNumber} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                        <div>
                          <span className="font-black text-white bg-zinc-800 px-2.5 py-1 rounded-lg mr-3">{b.seatNumber}</span>
                          <span className="text-sm text-zinc-300 font-medium">{b.user?.name || 'Unknown'}</span>
                          <span className="text-xs text-zinc-500 ml-2">{b.user?.email}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-emerald-500 font-bold text-sm">₹{b.amount}</span>
                          <button
                            onClick={() => handleCancelBooking(b.seatNumber)}
                            className="text-xs font-bold text-red-500 hover:text-red-400 border border-red-900/50 hover:bg-red-950 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Cancel & Refund
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                locks.length === 0 ? (
                  <p className="text-zinc-500 text-center py-16">No active seat holds for this event.</p>
                ) : (
                  <div className="space-y-2">
                    {locks.map((l) => (
                      <div key={l.seatNumber} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                        <div>
                          <span className="font-black text-white bg-zinc-800 px-2.5 py-1 rounded-lg mr-3">{l.seatNumber}</span>
                          <span className="text-sm text-zinc-300 font-medium">{l.user?.name || 'Unknown'}</span>
                          {l.isExpired && <span className="ml-2 text-[10px] font-black text-orange-500 uppercase">Expired hold</span>}
                          {!l.inRedis && <span className="ml-2 text-[10px] font-black text-red-500 uppercase">Not in Redis (drift)</span>}
                        </div>
                        <button
                          onClick={() => handleForceRelease(l.seatNumber)}
                          className="text-xs font-bold text-orange-500 hover:text-orange-400 border border-orange-900/50 hover:bg-orange-950 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Unlock size={14} /> Force Release
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagement;