import { useNavigate } from "react-router-dom";
import {
  Check,
  Zap,
  Crown,
  Rocket,
  ExternalLink,
} from "lucide-react";
import { Toaster } from "sonner";
import { ShineBorder } from "../../Components/magicui/shine-border";

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

const PaymentPage = () => {
  const navigate = useNavigate();
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

  const handleGetStarted = () => {
      // Redirect to home/signup instead of direct payment
      navigate("/home");
  };

  return (
    <div className="h-screen bg-black text-white selection:bg-[#19E5A1]/30 overflow-hidden relative flex flex-col justify-center">
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

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        
        {/* Header - Compact */}
        <div className="text-center mb-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
            Upgrade Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">Experience</span>
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed max-w-xl mx-auto">
            Unlock premium features and create high-quality animations faster.
          </p>
        </div>

        {/* Pricing Cards Grid with 3D Effect */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-6 w-full max-w-6xl mx-auto perspective-[1200px]">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            // Determine rotation based on position
            // 0 (Left): Rotate Y positive
            // 1 (Center): No rotation, scale up
            // 2 (Right): Rotate Y negative
            const isLeft = index === 0;
            const isRight = index === 2;
            const isCenter = index === 1;

            return (
              <div 
                key={plan.id} 
                className={`relative group transition-all duration-500 ease-out flex-1 w-full max-w-sm ${plan.popular ? 'z-20' : 'z-10'}`}
                style={{
                   transform: `
                     ${isLeft ? 'rotateY(10deg) translateX(10px) scale(0.95)' : ''}
                     ${isRight ? 'rotateY(-10deg) translateX(-10px) scale(0.95)' : ''}
                     ${isCenter ? 'translateZ(20px) scale(1.0)' : ''}
                   `,
                   transformStyle: 'preserve-3d'
                }}
              >
                {plan.popular && (
                  <ShineBorder 
                    className="absolute inset-0 w-full h-full rounded-3xl pointer-events-none opacity-100 mix-blend-screen" 
                    shineColor={["#FFD700", "#FFA500", "#FF4500"]} 
                    borderWidth={1.5}
                  />
                )}
                
                <div
                  className={`relative flex flex-col p-6 rounded-3xl border h-full transition-all duration-300 backdrop-blur-sm ${
                    plan.popular
                      ? "bg-zinc-900/90 border-[#19E5A1]/20 shadow-2xl shadow-black/50"
                      : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700/80 hover:bg-zinc-900/60"
                  }`}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#19E5A1] to-[#15cea0] text-black px-4 py-1 text-[10px] font-bold rounded-full shadow-lg shadow-[#19E5A1]/20 tracking-wide uppercase whitespace-nowrap z-30">
                      Most Popular
                    </div>
                  )}
                  
                  {/* Plan Header */}
                  <div className="mb-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                      plan.popular ? "bg-[#19E5A1]/10 text-[#19E5A1]" : "bg-zinc-800/50 text-zinc-400 group-hover:text-zinc-200"
                    } transition-colors`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <h3 className="text-lg font-semibold text-white tracking-wide mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white tracking-tight">₹{plan.price}</span>
                      <span className="text-zinc-500 text-xs font-medium">/ lifetime</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-zinc-800/50 mb-6" />

                  {/* Features */}
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
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
                    className={`w-full py-3 px-6 rounded-xl font-bold text-xs transition-all duration-300 relative overflow-hidden group/btn ${
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