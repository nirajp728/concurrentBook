import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import toast, { Toaster } from 'react-hot-toast';
import { ShieldCheck, Ticket, CreditCard, Lock, ChevronLeft } from 'lucide-react';
import api from '../api/axiosConfig';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext'; 

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// ==========================================
// 1. STRIPE CHECKOUT FORM (Injected UI)
// ==========================================
const CheckoutForm = ({ totalAmount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required' 
    });

    if (error) {
      toast.error(error.message);
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'requires_capture') {
      // Manual capture flow: the card is only AUTHORIZED at this point, not charged yet.
      // Actual capture (or void, if a race is detected) happens server-side once the
      // webhook confirms the seats are still ours — see bookingController.js.
      toast.success("Payment authorized! Confirming your seats...");

      setTimeout(() => {
        window.location.href = '/profile';
      }, 2000);
    } else if (paymentIntent && paymentIntent.status === 'processing') {
      // Some payment methods (e.g. certain bank redirects) settle asynchronously.
      toast('Payment is processing — you\'ll be notified once it\'s confirmed.', { icon: '⏳' });
      setIsProcessing(false);
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-6 animate-fade-in">
      {/* Stripe Element Container */}
      <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-inner">
        <PaymentElement /> 
      </div>
      
      <button 
        disabled={isProcessing || !stripe || !elements} 
        className={`w-full py-4 rounded-2xl font-black text-lg text-white transition-all flex items-center justify-center gap-2 shadow-xl ${
          isProcessing ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-red-900/40 active:scale-95'
        }`}
      >
        {isProcessing ? (
          "Processing Securely..."
        ) : (
          <>
            <Lock size={20} /> Pay ₹{totalAmount}
          </>
        )}
      </button>
      <p className="text-center text-zinc-500 text-xs font-medium flex items-center justify-center gap-1">
        <ShieldCheck size={14} /> Payments are 256-bit encrypted and processed by Stripe.
      </p>
    </form>
  );
};

// ==========================================
// 2. MAIN PAYMENT PAGE
// ==========================================
const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth(); 
  
  const [clientSecret, setClientSecret] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [holdExpiry, setHoldExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  const stateData = location.state || {};
  const localString = sessionStorage.getItem('booking_data');
  const localData = localString ? JSON.parse(localString) : {};

  const eventId = stateData.eventId || localData.eventId;
  const seats = stateData.seats || localData.seats;
  const eventDetails = stateData.event || localData.event;

  const pricePerSeat = eventDetails?.price || 500;
  const totalAmount = (seats?.length || 0) * pricePerSeat;

  useEffect(() => {
    if (!eventId || !seats || seats.length === 0) {
      toast.error("Session expired. Please select your seats again.");
      navigate('/');
    }
  }, [eventId, seats, navigate, eventDetails]);

  // Live countdown, driven by the server's real holdExpiry — not a guessed local timer
  useEffect(() => {
    if (!holdExpiry) return;

    const tick = () => {
      const remainingMs = new Date(holdExpiry).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft(0);
        toast.error("Your seat hold expired. Please select seats again.");
        navigate(`/event/${eventId}/seats`);
        return;
      }
      setTimeLeft(Math.floor(remainingMs / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [holdExpiry, eventId, navigate]);

  const formatTime = (seconds) => {
    if (seconds === null) return '10:00';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleInitiatePayment = async () => {
    if (user?.wallet !== undefined && user.wallet < totalAmount) {
      toast.error(`Insufficient Balance! You need ₹${totalAmount}, but only have ₹${user.wallet}.`);
      return; 
    }

    setIsInitializing(true);
    const idempotencyKey = uuidv4(); 

    try {
      const response = await api.post('/bookings/create-payment-intent', { 
        eventId, seats, idempotencyKey 
      });
      
      setClientSecret(response.data.clientSecret);
      setHoldExpiry(response.data.holdExpiry);
      toast.success("Seats locked for 10 minutes!");
      sessionStorage.removeItem('booking_data'); 
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to secure seats.");
      if (error.response?.status === 409) {
        setTimeout(() => navigate(`/event/${eventId}/seats`), 2000);
      }
      setIsInitializing(false);
    }
  };

  if (!eventId || !seats) return null; 

  // --- THE MAGIC STRIPE DARK MODE THEME ---
  const stripeAppearance = {
    theme: 'night',
    variables: {
      fontFamily: 'system-ui, sans-serif',
      colorBackground: '#18181b', // Tailwind zinc-900
      colorText: '#f4f4f5',       // Tailwind zinc-100
      colorDanger: '#ef4444',     // Tailwind red-500
      colorPrimary: '#dc2626',    // Tailwind red-600
      borderRadius: '12px',
      colorTextPlaceholder: '#71717a' // Tailwind zinc-500
    },
    rules: {
      '.Input': { border: '1px solid #27272a', boxShadow: 'none' }, // zinc-800
      '.Input:focus': { border: '1px solid #dc2626' }, // red-600
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-20 md:pb-12 animate-fade-in">
      <Toaster position="top-right" />
      
      {/* HEADER SECTION */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-3xl font-black text-white tracking-wide">Secure Checkout</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        
        {/* LEFT/TOP: THE TICKET SUMMARY (Looks like a physical ticket stub) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-zinc-900/80 backdrop-blur-md rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl relative">
            {/* The aesthetic "ticket cutouts" */}
            <div className="absolute top-1/2 -left-4 w-8 h-8 bg-zinc-950 rounded-full"></div>
            <div className="absolute top-1/2 -right-4 w-8 h-8 bg-zinc-950 rounded-full"></div>
            
            <div className="p-6 border-b border-zinc-800 border-dashed">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 block">Order Summary</span>
              <h3 className="text-2xl font-black text-white leading-tight mb-2">
                {eventDetails?.title || 'Live Event'}
              </h3>
              <p className="text-zinc-400 text-sm font-medium">{eventDetails?.venue || 'Main Theatre'}</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Seats</span>
                <span className="font-black text-white bg-zinc-800 px-3 py-1 rounded-lg">
                  {seats.join(', ')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Wallet Bal</span>
                <span className={`font-black ${user?.wallet < totalAmount ? 'text-red-500' : 'text-zinc-300'}`}>
                  ₹{user?.wallet || 0}
                </span>
              </div>
            </div>

            <div className="bg-zinc-950 p-6 flex justify-between items-end border-t border-zinc-800">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Pay</span>
              <span className={`text-3xl font-black tracking-tighter ${user?.wallet < totalAmount ? 'text-red-500' : 'text-emerald-500'}`}>
                ₹{totalAmount}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT/BOTTOM: THE PAYMENT ACTION ZONE */}
        <div className="md:col-span-3">
          <div className="bg-zinc-900/40 backdrop-blur-md rounded-3xl border border-zinc-800 p-6 md:p-8 shadow-2xl h-full">
            
            {!clientSecret ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700 shadow-inner">
                  <CreditCard size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Ready to secure your seats?</h3>
                  <p className="text-zinc-400 text-sm">Locking your seats will reserve them for 10 minutes while you complete the payment.</p>
                </div>
                
                <button 
                  onClick={handleInitiatePayment}
                  disabled={isInitializing}
                  className={`w-full py-4 rounded-2xl font-black text-lg text-white transition-all shadow-xl flex justify-center items-center gap-2 ${
                    isInitializing ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 hover:scale-[1.02] shadow-red-900/40'
                  }`}
                >
                  {isInitializing ? "Securing Seats..." : <><Ticket size={20}/> Lock Seats & Pay</>}
                </button>
              </div>
            ) : (
              <div className="animate-slide-up">
                <h3 className="text-lg font-bold text-white mb-1">Enter Payment Details</h3>
                <p className={`text-sm mb-6 font-bold ${timeLeft !== null && timeLeft <= 60 ? 'text-red-500' : 'text-zinc-400'}`}>
                  Your seats are locked for {formatTime(timeLeft)}
                </p>
                
                {/* STRIPE INJECTION WITH CUSTOM THEME */}
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                  <CheckoutForm totalAmount={totalAmount} />
                </Elements>
              </div>
            )}
            
          </div>
        </div>

      </div>
    </div>
  );
};

export default Payment;