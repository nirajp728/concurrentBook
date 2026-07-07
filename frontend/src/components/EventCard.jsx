import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Ticket, Star } from 'lucide-react';

const EventCard = ({ event }) => {
  const navigate = useNavigate();

  const fallbackImage = event.type === 'Concert' 
    ? "https://images.unsplash.com/photo-1540039155732-d68a1d13dbfd?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
    : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80";

  const imageUrl = event.posterUrl || event.imageUrl || fallbackImage;

  // THE FIX: Safely format the MongoDB ISO date into a beautiful, readable string
  const formattedDate = !isNaN(Date.parse(event.date))
    ? new Date(event.date).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      })
    : event.date; 

  return (
    <div 
      onClick={() => navigate(`/event/${event._id || event.id}/seats`, { state: { event } })}
      className="relative w-full aspect-[2/3] rounded-3xl overflow-hidden group cursor-pointer shadow-lg hover:shadow-red-900/20 transition-all duration-300 transform hover:-translate-y-1 animate-fade-in"
    >
      <img 
        src={imageUrl} 
        alt={event.title} 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />

      <div className="absolute top-4 right-4 z-20">
        <span className="bg-zinc-950/60 backdrop-blur-md border border-zinc-700/50 text-zinc-200 px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest shadow-xl">
          {event.type}
        </span>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent opacity-90 z-10" />

      <div className="absolute bottom-0 left-0 right-0 p-5 z-20 flex flex-col justify-end">
        
        <div className="flex items-center gap-1 mb-2 text-red-500">
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
          <span className="text-zinc-400 text-[10px] ml-1 uppercase tracking-wider font-semibold">4.8 Rating</span>
        </div>

        {/* Added 'capitalize' so "dune" becomes "Dune" */}
        <h3 className="text-2xl font-black text-white mb-1 leading-tight tracking-wide drop-shadow-md capitalize">
          {event.title}
        </h3>
        
        <p className="text-xs text-zinc-400 mb-4 uppercase tracking-widest font-semibold flex gap-2 items-center">
          {event.type} <span className="w-1 h-1 rounded-full bg-red-600"></span> ₹{event.price}
        </p>

        <div className="space-y-2 text-xs text-zinc-300 font-medium mb-5">
          {/* Swapped event.date for formattedDate */}
          <p className="flex items-center gap-2"><Calendar size={14} className="text-red-500" /> {formattedDate}</p>
          <p className="flex items-center gap-2 truncate capitalize"><MapPin size={14} className="text-red-500" /> {event.venue}</p>
        </div>

        <button 
          className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-900/50"
        >
          <Ticket size={18} /> Buy Ticket
        </button>
      </div>
    </div>
  );
};

export default EventCard;