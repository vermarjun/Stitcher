import { useState } from "react";
import {
  Check,
  Zap,
  Crown,
  Rocket,
  ExternalLink,
  X,
  Clock,
} from "lucide-react";
import { ShineBorder } from "../../Components/magicui/shine-border";
import { BackgroundGrid } from "@/components/ui/background-snippets";

const TestModeModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900/95 border border-zinc-800/50 rounded-2xl p-7 max-w-sm w-full shadow-2xl relative overflow-hidden">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center text-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <Clock className="w-6 h-6 text-zinc-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Payments coming soon</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              We're currently in <span className="text-white font-medium">test mode</span> while Razorpay reviews our account. You'll be able to buy credit packs in about a week.
            </p>
          </div>
          <p className="text-zinc-500 text-xs">
            In the meantime, your 10 free videos are ready to use.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-100 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

const PaymentPage = () => {
  const [showTestModeModal, setShowTestModeModal] = useState(false);
  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 299,
      icon: Zap,
      features: [
        "25 videos",
        "Credits never expire",
        "All 7 animation domains",
        "Email support",
        "BYOK — bring your own API key",
      ],
      popular: false,
    },
    {
      id: "creator",
      name: "Creator",
      price: 799,
      icon: Crown,
      features: [
        "75 videos",
        "Credits never expire",
        "All 7 animation domains",
        "Priority support",
        "BYOK — bring your own API key",
        "Collaboration & sharing",
      ],
      popular: true,
    },
    {
      id: "pro",
      name: "Pro",
      price: 1999,
      icon: Rocket,
      features: [
        "250 videos",
        "Credits never expire",
        "All 7 animation domains",
        "Priority support",
        "BYOK — bring your own API key",
        "Collaboration & sharing",
        "Early access to new features",
      ],
      popular: false,
    },
  ];

  const handleGetStarted = () => {
    setShowTestModeModal(true);
  };

  return (
    <div className="min-h-screen md:h-screen bg-black text-white selection:bg-[#19E5A1]/30 overflow-x-hidden overflow-y-auto md:overflow-hidden relative flex flex-col justify-center py-12 md:py-0">
      <TestModeModal isOpen={showTestModeModal} onClose={() => setShowTestModeModal(false)} />
      <BackgroundGrid />
      {/* Background Ambient Effects */}
      <div className="fixed top-0 left-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#19E5A1]/5 rounded-full blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none translate-x-1/3 translate-y-1/3" />

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10 w-full">
        
        {/* Header - Compact */}
        <div className="text-center mb-8 md:mb-10 max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 md:mb-4 tracking-tight leading-tight px-4">
            Upgrade Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">Experience</span>
          </h1>
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-xl mx-auto px-4">
            Unlock premium features and create high-quality animations faster.
          </p>
        </div>

        {/* Pricing Cards Grid with 3D Effect (desktop only) */}
        <div className="flex flex-col md:flex-row justify-center items-stretch md:items-center gap-4 md:gap-6 w-full max-w-6xl mx-auto md:perspective-[1200px]">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            // Determine rotation based on position (desktop only)
            const isLeft = index === 0;
            const isRight = index === 2;
            const isCenter = index === 1;

            return (
              <div 
                key={plan.id} 
                className={`relative group transition-all duration-500 ease-out flex-1 w-full max-w-sm mx-auto ${plan.popular ? 'md:z-20' : 'md:z-10'}`}
                style={{
                   // Only apply 3D transforms on medium screens and up
                   transform: window.innerWidth >= 768 ? `
                     ${isLeft ? 'rotateY(10deg) translateX(10px) scale(0.95)' : ''}
                     ${isRight ? 'rotateY(-10deg) translateX(-10px) scale(0.95)' : ''}
                     ${isCenter ? 'translateZ(20px) scale(1.0)' : ''}
                   ` : 'none',
                   transformStyle: window.innerWidth >= 768 ? 'preserve-3d' : 'flat'
                }}
              >
                {plan.popular && (
                  <ShineBorder 
                    className="absolute inset-0 w-full h-full rounded-2xl md:rounded-3xl pointer-events-none opacity-100 mix-blend-screen" 
                    shineColor={["#FFD700", "#FFA500", "#FF4500"]} 
                    borderWidth={1.5}
                  />
                )}
                
                <div
                  className={`relative flex flex-col p-5 md:p-6 rounded-2xl md:rounded-3xl border h-full transition-all duration-300 backdrop-blur-sm ${
                    plan.popular
                      ? "bg-zinc-900/90 border-[#19E5A1]/20 shadow-2xl shadow-black/50"
                      : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700/80 hover:bg-zinc-900/60"
                  }`}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-2.5 md:-top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#19E5A1] to-[#15cea0] text-black px-3 md:px-4 py-0.5 md:py-1 text-[9px] md:text-[10px] font-bold rounded-full shadow-lg shadow-[#19E5A1]/20 tracking-wide uppercase whitespace-nowrap z-30">
                      Most Popular
                    </div>
                  )}
                  
                  {/* Plan Header */}
                  <div className="mb-5 md:mb-6">
                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center mb-3 md:mb-4 ${
                      plan.popular ? "bg-[#19E5A1]/10 text-[#19E5A1]" : "bg-zinc-800/50 text-zinc-400 group-hover:text-zinc-200"
                    } transition-colors`}>
                      <Icon className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    
                    <h3 className="text-base md:text-lg font-semibold text-white tracking-wide mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl md:text-3xl font-bold text-white tracking-tight">₹{plan.price}</span>
                      <span className="text-zinc-500 text-xs font-medium">/ lifetime</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-zinc-800/50 mb-5 md:mb-6" />

                  {/* Features */}
                  <ul className="space-y-2.5 md:space-y-3 mb-5 md:mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5 md:gap-3">
                        <div className={`mt-0.5 p-0.5 rounded-full shrink-0 ${
                          plan.popular ? "bg-[#19E5A1] text-black" : "bg-zinc-800 text-zinc-400"
                        }`}>
                           <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </div>
                        <span className="text-zinc-300 text-xs leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    onClick={handleGetStarted}
                    className={`w-full py-2.5 md:py-3 px-6 rounded-xl font-bold text-xs transition-all duration-300 relative overflow-hidden group/btn ${
                      plan.popular
                        ? "bg-[#19E5A1] hover:bg-[#15cea0] text-black shadow-lg shadow-[#19E5A1]/20 hover:shadow-[#19E5A1]/40 transform hover:-translate-y-0.5"
                        : "bg-white text-black hover:bg-zinc-200"
                    }`}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                       Get Started
                       <ExternalLink className="w-3 h-3 opacity-50 group-hover/btn:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
