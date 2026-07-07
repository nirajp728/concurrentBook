import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { ChevronLeft, Calendar, MapPin } from 'lucide-react';
import api from '../api/axiosConfig';
import SeatGrid from '../components/SeatGrid';

const SeatSelection = () => {
  const { eventId } = useParams(); 
  const navigate = useNavigate();

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState([]); 
  const [lockedSeats, setLockedSeats] = useState([]); 
  const [eventDetails, setEventDetails] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', { transports: ['websocket'] });

    const fetchInitialSeats = async () => {
      try {
        const response = await api.get(`/events/${eventId}`);
        setEventDetails(response.data); 
        if(response.data.bookedSeats) setBookedSeats(response.data.bookedSeats);
        if(response.data.lockedSeats) setLockedSeats(response.data.lockedSeats);
      } catch (error) {
        console.error("Failed to load seat data", error);
      }
    };
    fetchInitialSeats();

    socket.on('seatsLocked', (data) => {
      if (data.eventId === eventId) setLockedSeats(prev => [...new Set([...prev, ...data.seats])]);
    });
    socket.on('seatsBooked', (data) => {
      if (data.eventId === eventId) {
        setBookedSeats(prev => [...new Set([...prev, ...data.seats])]);
        setLockedSeats(prev => prev.filter(seat => !data.seats.includes(seat)));
      }
    });
    socket.on('seatsUnlocked', (data) => {
      if (data.eventId === eventId) setLockedSeats(prev => prev.filter(seat => !data.seats.includes(seat)));
    });

    return () => socket.disconnect();
  }, [eventId]);

  const handleProceedToPayment = () => {
    if (selectedSeats.length === 0) return toast.error("Select seats first.");
    
    const bookingData = { eventId, seats: selectedSeats, event: eventDetails };
    sessionStorage.setItem('booking_data', JSON.stringify(bookingData));
    navigate('/payment', { state: bookingData });
  };

  const currentPrice = eventDetails?.price || 500;
  const totalPrice = selectedSeats.length * currentPrice;

  return (
    // pb-32 ensures the content doesn't get hidden behind the sticky bottom bar
    <div className="min-h-[90vh] bg-zinc-950 pb-32 px-4 sm:px-6 pt-4">
      <Toaster position="top-right" />
      
      {/* CUSTOM HEADER (Replaces standard Navbar feel) */}
      {eventDetails && (
        <div className="max-w-4xl mx-auto mb-8 animate-slide-up">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => navigate(-1)} 
              className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-wide">{eventDetails.title}</h2>
          </div>

          {/* EVENT DETAILS PILL BOX */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex flex-wrap md:flex-nowrap gap-4 justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-6 text-sm font-medium text-zinc-400">
              <span className="flex items-center gap-2"><Calendar size={16} className="text-red-500"/> {eventDetails.date || 'Today'}</span>
              <span className="flex items-center gap-2"><MapPin size={16} className="text-red-500"/> {eventDetails.venue || 'Main Theatre'}</span>
            </div>
            <div className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl">
              <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold block mb-1">Ticket Price</span>
              <span className="text-lg text-white font-black">₹{currentPrice}</span>
            </div>
          </div>
        </div>
      )}

      {/* SEAT GRID COMPONENT */}
      <SeatGrid 
        bookedSeats={bookedSeats} 
        lockedSeats={lockedSeats} 
        selectedSeats={selectedSeats} 
        onSeatClick={(id) => setSelectedSeats(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])} 
      />
      
      {/* STICKY BOTTOM ACTION BAR (Native App Feel) */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 pb-safe-bottom z-50 animate-slide-up">
        <div className="max-w-4xl mx-auto p-4 flex justify-between items-center gap-4">
          
          <div className="flex flex-col">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">
              {selectedSeats.length > 0 ? `${selectedSeats.length} Seat${selectedSeats.length > 1 ? 's' : ''} Selected` : 'No Seats Selected'}
            </span>
            <span className="text-2xl font-black text-white">
              ₹{totalPrice.toFixed(2)}
            </span>
          </div>

          <button 
            onClick={handleProceedToPayment} 
            disabled={isLoading || selectedSeats.length === 0} 
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-2 ${
              selectedSeats.length === 0 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : 'bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-red-900/40'
            }`}
          >
            Proceed <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

    </div>
  );
};

// Quick helper to keep the icon import clean without adding it to the top
const ChevronRight = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
)

export default SeatSelection;