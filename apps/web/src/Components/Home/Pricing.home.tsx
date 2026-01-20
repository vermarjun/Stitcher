import { useState } from "react";
import {
  Check,
  Zap,
  Crown,
  Rocket,
  ExternalLink,
  Mail,
  Twitter,
  Github,
  Linkedin,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import Confetti from "react-confetti";
import { ShimmerButton } from "../magicui/shimmer-button";
import api from "@/api";

// Dialog component for social media modal
const SocialModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  const socialLinks = [
    {
      icon: Twitter,
      label: "Twitter",
      url: "https://twitter.com/yourusername",
    },
    { icon: Github, label: "GitHub", url: "https://github.com/yourusername" },
    {
      icon: Linkedin,
      label: "LinkedIn",
      url: "https://linkedin.com/in/yourusername",
    },
    { icon: Mail, label: "Email", url: "mailto:you@example.com" },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900/90 border border-zinc-800/50 rounded-2xl p-7 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#19E5A1]/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex justify-between items-center mb-5 relative z-10">
          <h3 className="text-xl font-semibold text-white tracking-tight">
            Get 2× Free Credits
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-zinc-400 text-sm leading-relaxed mb-6 relative z-10">
          I'm giving early users{" "}
          <span className="text-white font-medium">2× free credits</span> to
          test Stitcher.
          <br />
          Reach out to me on any of the platforms below and I’ll instantly send
          you an invite.
        </p>

        {/* Social Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
          {socialLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 rounded-xl 
                         transition-all duration-200 text-zinc-300 hover:text-white group"
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500" />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// User info component
const UserCurrentPlan = ({
  userData,
}: {
  userData: {
    plan: "free" | "basic" | "plus" | "max";
    credits: {
      generation: number;
      editing: number;
      expiresAt: Date;
    };
  };
}) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-10">
      <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-full px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Current Plan</span>
          <span className="bg-zinc-800 text-white text-xs px-2 py-0.5 rounded border border-zinc-700 font-medium capitalize">
            {userData.plan}
          </span>
        </div>
        
        <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

        <div className="flex items-center gap-4 text-xs">
          <span className="text-zinc-300">
            <span className="text-white font-medium">{userData.credits.generation}</span> generations
          </span>
          <span className="text-[#19E5A1]">
            <span className="font-medium">{userData.credits.editing}</span> edits left
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">Expires</span>
          <span className="text-zinc-300 text-xs font-medium">
            {formatDate(userData.credits.expiresAt)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

const PaymentPage = () => {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);

  // Mock user data - replace with actual data from your app
  const userData = {
    plan: "free" as const,
    credits: {
      generation: 5,
      editing: 10,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  };

  const plans = [
    {
      id: "basic",
      name: "Basic",
      price: 600,
      icon: Zap,
      features: [
        "50 Generation Credits",
        "100 Editing Credits",
        "Valid for 30 days",
        "Email Support",
        "Basic Templates",
      ],
      popular: false,
    },
    {
      id: "plus",
      name: "Plus",
      price: 3000,
      icon: Crown,
      features: [
        "200 Generation Credits",
        "400 Editing Credits",
        "Valid for 30 days",
        "Priority Support",
        "Premium Templates",
        "Advanced Features",
      ],
      popular: true,
    },
    {
      id: "max",
      name: "Max",
      price: 8000,
      icon: Rocket,
      features: [
        "500 Generation Credits",
        "1000 Editing Credits",
        "Valid for 30 days",
        "24/7 Support",
        "All Templates",
        "All Features",
        "API Access",
      ],
      popular: false,
    },
  ];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (planId: string) => {
    setLoading(true);
    setSelectedPlan(planId);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error(
          "Failed to load payment system. Please check your internet connection."
        );
        setLoading(false);
        return;
      }

      const orderResponse = await api.post<any>("/payments/create-order", {
        pack: planId,
        currency: "INR",
      });

      const orderData = orderResponse.data;

      if (!orderData.success) {
        throw new Error(orderData.message || "Failed to create order");
      }

      const options = {
        key: import.meta.env.VITE_RZP_KEY_ID,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "STITCHER",
        description: `${planId.toUpperCase()} Plan Subscription`,
        order_id: orderData.order.id,
        handler: async function (response: any) {
          try {
            const verifyResponse = await api.post<any>("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            const verifyData = await verifyResponse.data;

            if (verifyData.success) {
              setShowConfetti(true);
              toast.success(
                `Payment successful! Welcome to ${planId.toUpperCase()} plan!`
              );
              setTimeout(() => setShowConfetti(false), 5000);
            } else {
              toast.error(
                "Payment verification failed. Please contact support."
              );
            }
          } catch (error) {
            console.error("Verification error:", error);
            toast.error("Error verifying payment. Please contact support.");
          }
        },
        prefill: {
          name: "User Name",
          email: "user@example.com",
          contact: "9999999999",
        },
        notes: {
          plan: planId,
        },
        theme: {
          color: "#19E5A1",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setSelectedPlan("");
          },
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
      setLoading(false);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
      setSelectedPlan("");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#19E5A1]/30 overflow-x-hidden relative">
      {/* Background Ambient Effects */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-[#19E5A1]/5 rounded-full blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none translate-x-1/3 translate-y-1/3" />

      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "#18181b",
            border: "1px solid #27272a",
            color: "#fff",
            fontSize: "14px",
          },
        }}
      />

      {showConfetti && (
        <Confetti 
          recycle={false} 
          numberOfPieces={500} 
          gravity={0.15} 
          colors={['#19E5A1', '#ffffff', '#27272a']}
        />
      )}

      <SocialModal
        isOpen={showSocialModal}
        onClose={() => setShowSocialModal(false)}
      />

      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-20 relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        
        {/* Top Banner Button */}
        <div className="mb-12">
          <ShimmerButton
            onClick={() => setShowSocialModal(true)}
            className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-[#19E5A1]/30 text-zinc-300 hover:text-white rounded-full transition-all duration-300 shadow-xl shadow-black/20 overflow-hidden"
          >
            <span className="text-xs font-medium tracking-wide">Get 2x Free credits via invitation</span>
            <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/5 group-hover:ring-white/10" />
          </ShimmerButton>
        </div>

        {/* Header */}
        <div className="text-center mb-16 max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight leading-tight">
            Upgrade Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">Experience</span>
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed max-w-xl mx-auto">
            Unlock premium features and create high-quality animations faster.
          </p>
        </div>

        {/* User Info */}
        <UserCurrentPlan userData={userData} />

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto perspective-1000">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`group relative flex flex-col p-8 rounded-3xl border transition-all duration-500 ${
                  plan.popular
                    ? "bg-zinc-900/60 border-[#19E5A1]/30 shadow-2xl shadow-[#19E5A1]/10 scale-105 z-10 ring-1 ring-[#19E5A1]/20"
                    : "bg-zinc-900/20 border-zinc-800 hover:border-zinc-700/80 hover:bg-zinc-900/40"
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#19E5A1] text-black px-4 py-1.5 text-xs font-bold rounded-full shadow-[0_0_20px_rgba(25,229,161,0.3)] tracking-wide">
                    MOST POPULAR
                  </div>
                )}
                
                {/* Plan Header */}
                <div className="mb-6 space-y-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    plan.popular ? "bg-[#19E5A1]/10 text-[#19E5A1]" : "bg-zinc-800 text-zinc-400 group-hover:text-zinc-200"
                  } transition-colors`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white tracking-tight">₹{plan.price}</span>
                      <span className="text-zinc-500 text-sm font-medium">/ lifetime</span>
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-zinc-800/50 mb-6" />

                {/* Features */}
                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className={`mt-1 p-0.5 rounded-full ${
                        plan.popular ? "bg-[#19E5A1]/20 text-[#19E5A1]" : "bg-zinc-800 text-zinc-400"
                      }`}>
                         <Check className="w-3 h-3" strokeWidth={3} />
                      </div>
                      <span className="text-zinc-300 text-sm leading-tight pt-0.5">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handlePayment(plan.id)}
                  disabled={loading && selectedPlan === plan.id}
                  className={`w-full py-4 px-6 rounded-2xl font-semibold text-sm transition-all duration-300 relative overflow-hidden ${
                    plan.popular
                      ? "bg-[#19E5A1] hover:bg-[#15cea0] text-black shadow-[0_4px_20px_rgba(25,229,161,0.2)] hover:shadow-[0_4px_25px_rgba(25,229,161,0.4)] transform hover:-translate-y-1"
                      : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 hover:border-zinc-600"
                  } ${
                    loading && selectedPlan === plan.id
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading && selectedPlan === plan.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Get Started"
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;