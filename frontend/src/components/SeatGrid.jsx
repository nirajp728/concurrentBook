import React from 'react';
import toast from 'react-hot-toast'; 

const SeatGrid = ({ totalSeats = 60, bookedSeats = [], lockedSeats = [], selectedSeats = [], onSeatClick }) => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
  const seatsPerRow = totalSeats / rows.length;

  const handleSeatSelection = (seatId, isBooked, isLocked) => {
    if (isBooked || isLocked) return;
    if (selectedSeats.includes(seatId)) {
      onSeatClick(seatId); 
      return; 
    }
    if (selectedSeats.length >= 5) {
      toast.error("You can only select a maximum of 5 seats per booking.");
      return; 
    }
    onSeatClick(seatId);
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center select-none animate-fade-in">
      
      {/* THE CURVED GLOWING SCREEN */}
      <div className="relative w-full max-w-xl mx-auto mb-16 mt-4">
        <div className="h-10 border-t-4 border-red-600 rounded-[100%] shadow-[0_-20px_40px_rgba(220,38,38,0.25)] opacity-90"></div>
        <p className="text-center text-zinc-500 tracking-[0.4em] text-xs font-bold uppercase absolute top-4 w-full">
          Screen This Way
        </p>
      </div>

      {/* THE SEAT GRID */}
      {/* Using overflow-x-auto allows the grid to scroll nicely on small phones */}
      <div className="w-full overflow-x-auto hide-scrollbar pb-8">
        <div className="min-w-max mx-auto">
          {rows.map((row, rowIndex) => (
            <div key={row} className="flex items-center justify-center gap-2 sm:gap-3 mb-3 md:mb-4">
              
              {/* Row Label (Left) */}
              <div className="w-6 text-center text-zinc-600 font-bold text-xs">{row}</div>

              {Array.from({ length: seatsPerRow }).map((_, i) => {
                const seatId = `${row}${i + 1}`;
                const isBooked = bookedSeats.includes(seatId);
                const isLocked = lockedSeats.includes(seatId);
                const isSelected = selectedSeats.includes(seatId);

                // CINEMATIC SEAT STYLING
                let bgColor = "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-red-500 hover:text-red-400"; 
                if (isBooked) bgColor = "bg-zinc-950 border-zinc-900 text-zinc-800 opacity-50 cursor-not-allowed"; 
                if (isLocked) bgColor = "bg-orange-900/40 border-orange-800 text-orange-600 cursor-not-allowed"; 
                if (isSelected) bgColor = "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/60 transform scale-110 z-10"; 

                return (
                  <button
                    key={seatId}
                    onClick={() => handleSeatSelection(seatId, isBooked, isLocked)}
                    disabled={isBooked || isLocked}
                    // PILL SHAPE UI
                    className={`relative w-8 h-10 sm:w-9 sm:h-11 rounded-t-xl rounded-b-md border-2 text-[10px] sm:text-xs font-bold flex justify-center items-center transition-all duration-200 ${bgColor}`}
                  >
                    <span className={isSelected ? 'opacity-100' : 'opacity-0'}>{i + 1}</span>
                    {/* Tiny visual detail to make it look like a folded seat */}
                    <div className={`absolute bottom-1 w-2/3 h-1 rounded-full ${isSelected ? 'bg-red-400' : 'bg-zinc-700'}`}></div>
                  </button>
                );
              })}

              {/* Row Label (Right) */}
              <div className="w-6 text-center text-zinc-600 font-bold text-xs">{row}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* THE LEGEND */}
      <div className="flex flex-wrap justify-center gap-6 text-xs sm:text-sm font-medium text-zinc-400 mt-4 bg-zinc-900/50 px-6 py-3 rounded-full border border-zinc-800">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-zinc-600 bg-zinc-800"></div> Available</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-600 shadow-md shadow-red-900/50"></div> Selected</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-orange-800"></div> Processing</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-zinc-950 border border-zinc-900"></div> Booked</div>
      </div>
    </div>
  );
};

export default SeatGrid;