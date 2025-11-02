import React, {useState} from "react";
import { Scissors, Film, Video} from "lucide-react";
import { Check, Zap, Crown, Rocket } from 'lucide-react';
import api from "@/api";

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

const PaymentPage = () => {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 600,
      icon: Zap,
      features: [
        '50 Generation Credits',
        '100 Editing Credits',
        'Valid for 30 days',
        'Email Support',
        'Basic Templates'
      ],
      popular: false
    },
    {
      id: 'plus',
      name: 'Plus',
      price: 3000,
      icon: Crown,
      features: [
        '200 Generation Credits',
        '400 Editing Credits',
        'Valid for 30 days',
        'Priority Support',
        'Premium Templates',
        'Advanced Features'
      ],
      popular: true
    },
    {
      id: 'max',
      name: 'Max',
      price: 8000,
      icon: Rocket,
      features: [
        '500 Generation Credits',
        '1000 Editing Credits',
        'Valid for 30 days',
        '24/7 Support',
        'All Templates',
        'All Features',
        'API Access'
      ],
      popular: false
    }
  ];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (planId: string) => {
    setLoading(true);
    setSelectedPlan(planId);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        alert('Failed to load Razorpay SDK. Please check your internet connection.');
        setLoading(false);
        return;
      }

      // Create order
      const orderResponse = await api.post('/payments/create-order', {
          pack: planId,
          currency: 'INR'
      });

      console.log("orderResponse: ",orderResponse);
      
      const orderData = orderResponse.data;
      console.log("orderData: ",orderData);
      
      if (!orderData.success) {
        throw new Error(orderData.message || 'Failed to create order');
      }

      // Razorpay options
      const options = {
        key: import.meta.env.VITE_RZP_KEY_ID, 
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'STITCHER',
        description: `${planId.toUpperCase()} Plan Subscription`,
        order_id: orderData.order.id,
        handler: async function (response: any) {
          try {
            // Verify payment
            const verifyResponse = await api.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
            });

            const verifyData = await verifyResponse.data;

            if (verifyData.success) {
              alert(`Payment successful! Welcome to ${planId.toUpperCase()} plan!`);
              // Redirect to dashboard or update user state
              window.location.href = '/dashboard';
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch (error) {
            console.error('Verification error:', error);
            alert('Error verifying payment. Please contact support.');
          }
        },
        prefill: {
          name: 'User Name',
          email: 'user@example.com',
          contact: '9999999999'
        },
        notes: {
          plan: planId
        },
        theme: {
          color: '#6366f1'
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            setSelectedPlan('');
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
      setLoading(false);

    } catch (error) {
      console.error('Payment error:', error);
      alert('Something went wrong. Please try again.');
      setLoading(false);
      setSelectedPlan('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Select the perfect plan for your needs. Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transition-transform hover:scale-105 ${
                  plan.popular ? 'ring-4 ring-indigo-500' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-indigo-500 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                    POPULAR
                  </div>
                )}

                <div className="p-8">
                  {/* Icon */}
                  <div className="inline-flex p-3 bg-indigo-100 rounded-xl mb-4">
                    <Icon className="w-8 h-8 text-indigo-600" />
                  </div>

                  {/* Plan Name */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">₹{plan.price}</span>
                    <span className="text-gray-600 ml-2">/month</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    onClick={() => handlePayment(plan.id)}
                    disabled={loading && selectedPlan === plan.id}
                    className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                      plan.popular
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    } ${loading && selectedPlan === plan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loading && selectedPlan === plan.id ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Get Started'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 text-center">
          <p className="text-gray-600">
            Need help choosing? <a href="/contact" className="text-indigo-600 hover:text-indigo-700 font-semibold">Contact our sales team</a>
          </p>
        </div>
      </div>
    </div>
  );
};

const PricingSection: React.FC = () => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto mb-16 px-4">
      {/* Video Editing Card */}
      <div className="bg-neutral-900/80 backdrop-blur-sm rounded-3xl border border-neutral-800/60 p-8 transition-all duration-500 hover:border-neutral-700 hover:shadow-2xl hover:shadow-neutral-900/50 hover:-translate-y-1 group">
        <div className="flex items-center mb-8">
          <div className="w-16 h-16 bg-red-500/8 rounded-2xl flex items-center justify-center mr-5 group-hover:bg-red-500/12 transition-colors duration-300">
            <Scissors className="h-8 w-8 text-red-400 group-hover:text-red-300 transition-colors duration-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Video Editing</h3>
            <div className="w-8 h-1 bg-red-400/60 rounded-full mt-2"></div>
          </div>
        </div>
        
        <p className="text-neutral-400 mb-8 text-base leading-relaxed">
          Perfect for refining or making tweaks to existing videos.
        </p>
        
        <div className="mb-3">
          <span className="text-5xl font-black text-white tracking-tight">~20k</span>
          <span className="text-lg text-neutral-500 ml-3 font-medium">tokens</span>
        </div>
        
        <p className="text-sm text-neutral-600 font-medium">
          per 1 minute video
        </p>
        <p className="text-xs text-neutral-700 mt-1">
          *varies by complexity
        </p>
      </div>

      {/* Video Generation Card - Featured */}
      <div className="bg-neutral-800/90 backdrop-blur-sm rounded-3xl border-2 border-blue-500/30 p-8 transition-all duration-500 hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-900/20 hover:-translate-y-1 group relative overflow-hidden">
        {/* Featured badge */}
        <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-2xl rounded-tr-3xl">
          Mostly used
        </div>
        
        <div className="flex items-center mb-8">
          <div className="w-16 h-16 bg-blue-500/12 rounded-2xl flex items-center justify-center mr-5 group-hover:bg-blue-500/16 transition-colors duration-300">
            <Video className="h-8 w-8 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Video Generation</h3>
            <div className="w-8 h-1 bg-blue-400/60 rounded-full mt-2"></div>
          </div>
        </div>
        
        <p className="text-neutral-400 mb-8 text-base leading-relaxed">
          To generate new videos from scratch from prompts.
        </p>
        
        <div className="mb-3">
          <span className="text-5xl font-black text-white tracking-tight">40k–50k</span>
          <span className="text-lg text-neutral-500 ml-3 font-medium">tokens</span>
        </div>
        
        <p className="text-sm text-neutral-600 font-medium">
          per 1 minute video
        </p>
        <p className="text-xs text-neutral-700 mt-1">
          *varies by complexity
        </p>
      </div>

      {/* Timeline Editing Card */}
      <div className="bg-neutral-900/80 backdrop-blur-sm rounded-3xl border border-neutral-800/60 p-8 transition-all duration-500 hover:border-neutral-700 hover:shadow-2xl hover:shadow-neutral-900/50 hover:-translate-y-1 group">
        <div className="flex items-center mb-8">
          <div className="w-16 h-16 bg-purple-500/8 rounded-2xl flex items-center justify-center mr-5 group-hover:bg-purple-500/12 transition-colors duration-300">
            <Film className="h-8 w-8 text-purple-400 group-hover:text-purple-300 transition-colors duration-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Timeline Editing</h3>
            <div className="w-8 h-1 bg-purple-400/60 rounded-full mt-2"></div>
          </div>
        </div>
        
        <p className="text-neutral-400 mb-8 text-base leading-relaxed">
          Make edits to your video without messing with timeline, just describe!
        </p>
        
        <div className="mb-3">
          <span className="text-5xl font-black text-white tracking-tight">2k–5k</span>
          <span className="text-lg text-neutral-500 ml-3 font-medium">tokens</span>
        </div>
        
        <p className="text-sm text-neutral-600 font-medium">
          per editing session
        </p>
        <p className="text-xs text-neutral-700 mt-1">
          *highly variable by project
        </p>
      </div>
    </section>
  );
};

const PricingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-neutral-800/50 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-sm border-b border-neutral-800 h-16">
        <div className="container mx-auto px-4 h-full flex items-center">
          <h1 className="text-3xl font-bold text-white">Pricing</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-green-400/20 text-white text-sm font-medium mb-6">
            🎉 Stitcher is Free to Use!
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Transparent, Simple Pricing
          </h2>
          <p className="text-lg text-neutral-400 leading-relaxed">
            Right now, the whole service runs on free tiers—no extra costs on my end. The only thing you’ll need is access to an LLM, and for now it’s a simple bring-your-own-API-key model.
          </p>
        </section>

        <PricingSection/>
      </main>

    <PaymentPage/>

    </div>
  );
};

export default PricingPage;