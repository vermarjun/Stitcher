import { useState } from "react";
import {
  Check,
  Zap,
  Crown,
  Rocket,
  Star,
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-7 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-semibold text-white">
            Get 2× Free Credits
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
          I'm giving early users{" "}
          <span className="text-white font-medium">2× free credits</span>
          to test Stitcher.
          <br />
          Reach out to me on any of the platforms below and I’ll instantly send
          you an invite.
        </p>

        {/* Social Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {socialLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl 
                         transition-colors text-zinc-300 hover:text-white group"
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 mb-6">
      <div className="flex items-center justify-around">
        <div className="flex justify-center items-center gap-2">
          <p className="text-zinc-400 text-xs">Current Plan: </p>
          <p className="text-white text-sm font-medium capitalize">
            {userData.plan}
          </p>
        </div>
        <div className="flex">
          <p className="text-white text-xs">
            {userData.credits.generation} generations •{" "}
          </p>
          <p className="text-[#19E5A1] text-xs">
            {userData.credits.editing} edits left
          </p>
        </div>
        <div className="flex justify-center items-center gap-2">
          <p className="text-zinc-400 text-xs">Expires:</p>
          <p className="text-white text-sm font-medium">
            {formatDate(userData.credits.expiresAt)}
          </p>
        </div>
      </div>
    </div>
  );
};

// Free tier info component
const FreeTierInfo = () => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="bg-[#02684D] rounded-lg p-2 mt-0.5">
          <Star className="w-4 h-4 text-white" />
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm mb-1">
            Stitcher is Free
          </h4>
          <p className="text-zinc-400 text-xs leading-relaxed">
            You can use your own API keys (must support tool calling and
            structured output) but requests will be rendered slower compared to
            paid or testing users.
          </p>
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
  // const { width, height } = useWindowSize();

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
    <div className="min-h-screen bg-black py-8 px-4">
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
        <Confetti recycle={false} numberOfPieces={200} gravity={0.3} />
      )}

      <SocialModal
        isOpen={showSocialModal}
        onClose={() => setShowSocialModal(false)}
      />

      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-center">
          <ShimmerButton
            onClick={() => setShowSocialModal(true)}
            className="text-xs px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-[#19E5A1]/50 text-zinc-300 rounded-lg transition-all duration-200 font-medium"
          >
            Get 2x Free credits via invitation →
          </ShimmerButton>
        </div>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">
            Upgrade Your Experience
          </h1>
          <p className="text-zinc-400 text-sm max-w-2xl mx-auto">
            Get high quality animations Faster. Upgrade to unlock premium
            features.
          </p>
        </div>

        {/* User Info Sections */}
        <div className="max-w-2xl mx-auto mb-8">
          {/* Need More Credits Button */}
          <UserCurrentPlan userData={userData} />
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative ${
                  index == 1 ? "scale-105 hover:scale-110" : "hover:scale-105 "
                } bg-zinc-900 rounded-xl border overflow-hidden transition-all duration-200 ${
                  plan.popular
                    ? "border-[#19E5A1] ring-2 ring-[#19E5A1]/20"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-[#19E5A1] text-black px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    MOST POPULAR
                  </div>
                )}

                <div className="p-6">
                  {/* Icon and Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`p-2 rounded-lg ${
                        plan.popular ? "bg-[#19E5A1]" : "bg-zinc-800"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          plan.popular ? "text-black" : "text-[#19E5A1]"
                        }`}
                      />
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {plan.name}
                    </h3>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-white">
                      ₹{plan.price}
                    </span>
                    <span className="text-zinc-400 text-sm ml-2">one-time</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-4 h-4 text-[#19E5A1] mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-zinc-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    onClick={() => handlePayment(plan.id)}
                    disabled={loading && selectedPlan === plan.id}
                    className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-all ${
                      plan.popular
                        ? "bg-[#19E5A1] hover:bg-[#14c28b] text-black shadow-lg hover:shadow-xl"
                        : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                    } ${
                      loading && selectedPlan === plan.id
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {loading && selectedPlan === plan.id ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin h-4 w-4 mr-2"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Get Started"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8">
          <p className="text-zinc-500 text-xs">
            All plans include 30-day access. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="mt-8 w-full flex justify-center items-center">
          <div className="max-w-5xl ">
            <FreeTierInfo />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
