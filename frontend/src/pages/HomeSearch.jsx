import React, { useState, useEffect } from 'react';
import { Search, Loader2, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import EventCard from '../components/EventCard';
import api from '../api/axiosConfig';

const HomeSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt:-1'); 
  const [filterType, setFilterType] = useState('all');
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // THE FIX: Strictly matching the MongoDB enum: ['Movie', 'Concert']
  const categories = [
    { id: 'all', label: 'All Events' },
    { id: 'Movie', label: 'Movies' },
    { id: 'Concert', label: 'Concerts' }
  ];

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/events', {
          params: { 
            search: searchTerm, 
            type: filterType !== 'all' ? filterType : undefined, 
            sort: sortBy 
          }
        });
        setEvents(response.data.events || response.data || []); 
      } catch (error) {
        console.error("Fetch error:", error);
        toast.error('Failed to connect to backend. Showing local dummy data fallback.');
        setEvents([
          { id: '1', title: 'Joker: Folie à Deux', type: 'Movie', venue: 'PVR ICON, Mumbai', date: '2026-10-24T20:00:00.000Z', price: 450 },
          { id: '2', title: 'Coldplay: Spheres', type: 'Concert', venue: 'DY Patil Stadium', date: '2026-11-12T18:00:00.000Z', price: 2500 }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => fetchEvents(), 500);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, filterType, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-20 md:pb-8">
      
      {/* HEADER SECTION */}
      <div className="mb-8 mt-2 animate-slide-up">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
          Find your next <span className="text-red-600">experience.</span>
        </h1>
        <p className="text-zinc-400 text-sm md:text-base font-medium">Discover movies, concerts, and exclusive live events.</p>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-zinc-900/50 backdrop-blur-md p-2 rounded-2xl border border-zinc-800 mb-8 flex flex-col md:flex-row gap-3 shadow-2xl animate-fade-in">
        
        {/* Search Input */}
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-500" size={20} />
          <input 
            type="text" 
            placeholder="Search movies, concerts..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-zinc-950/50 text-white border border-zinc-800 rounded-xl focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-zinc-500 font-medium"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative min-w-[200px]">
          <SlidersHorizontal className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-500 pointer-events-none" size={18} />
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)} 
            className="w-full h-full pl-12 pr-10 py-4 bg-zinc-950/50 text-zinc-200 border border-zinc-800 rounded-xl outline-none appearance-none cursor-pointer hover:border-zinc-700 transition-colors font-medium focus:border-red-600"
          >
            {/* THE FIX: Added bg-zinc-900 to force the OS dropdown to stay dark */}
            <option className="bg-zinc-900 text-white" value="createdAt:-1">Latest Added</option>
            <option className="bg-zinc-900 text-white" value="date:1">Happening Soonest</option>
            <option className="bg-zinc-900 text-white" value="price:1">Price: Low to High</option>
            <option className="bg-zinc-900 text-white" value="price:-1">Price: High to Low</option>
            <option className="bg-zinc-900 text-white" value="title:1">Name: A to Z</option>
            <option className="bg-zinc-900 text-white" value="title:-1">Name: Z to A</option>
          </select>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-zinc-500">▼</div>
        </div>
      </div>

      {/* CATEGORY PILLS */}
      <div className="mb-8 flex overflow-x-auto hide-scrollbar gap-3 pb-2 animate-slide-up delay-100">
        {categories.map((cat) => (
          <button 
            key={cat.id}
            onClick={() => setFilterType(cat.id)} 
            className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${
              filterType === cat.id 
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' 
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* RESULTS HEADER */}
      <div className="flex justify-between items-end mb-6 animate-fade-in delay-200">
        <h2 className="text-2xl font-bold text-white">
          {filterType === 'all' ? 'Featured Events' : `${categories.find(c => c.id === filterType)?.label}`}
        </h2>
        <span className="text-zinc-500 text-sm font-semibold">{events.length} Results</span>
      </div>

      {/* EVENT POSTER GRID */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-red-600">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p className="text-zinc-500 font-medium">Loading experiences...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {events.length > 0 ? (
            events.map((event, index) => (
              <div key={event.id || event._id} style={{ animationDelay: `${index * 50}ms` }} className="animate-slide-up">
                <EventCard event={event} />
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-32 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed">
              <Search size={48} className="text-zinc-600 mb-4" />
              <p className="text-xl font-bold text-zinc-400">No events found.</p>
              <p className="text-zinc-600 mt-2">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HomeSearch;