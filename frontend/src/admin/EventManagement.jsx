import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ImagePlus, Calendar, MapPin, Loader2, Ticket } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../api/axiosConfig';

const EventManagement = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    type: 'Movie',
    price: '',
    venue: '',
    date: '',
    posterUrl: ''
  });

  useEffect(() => {
    fetchEvents();
  }, []);

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

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ==========================================
  // S3 POSTER UPLOAD HANDLER
  // ==========================================
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('posterImage', file);

    setIsUploading(true);
    try {
      // We will create this backend route in the next step!
      const response = await api.post('/events/upload-poster', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData({ ...formData, posterUrl: response.data.imageUrl });
      toast.success('Poster uploaded to S3!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload poster.');
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================
  // DEPLOY NEW EVENT
  // ==========================================
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20 animate-fade-in">
      <Toaster position="top-right" />
      
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-wide">Event Command Center</h1>
        <p className="text-zinc-400 font-medium">Deploy and manage live experiences across your clusters.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: EVENT DEPLOYMENT FORM */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-zinc-800 p-6 shadow-2xl sticky top-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="text-red-500" /> Deploy New Event
            </h2>

            {/* S3 IMAGE DROP ZONE */}
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

            {/* TEXT INPUTS */}
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

        {/* RIGHT COLUMN: ACTIVE EVENTS GRID */}
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
                    
                    <button 
                      onClick={() => handleDelete(event._id || event.id)}
                      className="w-full py-3 mt-2 rounded-xl border border-red-900/50 text-red-500 font-bold hover:bg-red-950 hover:text-red-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Terminate Event
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default EventManagement;