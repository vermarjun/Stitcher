import {useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

import { ShineBorder } from '@/Components/magicui/shine-border';

import { useNavigate } from 'react-router-dom';

import { AuroraText } from '@/Components/magicui/aurora-text';

const GlassyNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Home', href: 'home' },
    { label: 'Features', href: 'features' },
    { label: 'Example', href: 'examples' },
    { label: 'Contact', href: 'endpagecta' },
  ];

  const scrollToSection = (id:string) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navigate = useNavigate();

  return (
    <div className={`w-screen fixed transform z-50 transition-all duration-500 ${
      isScrolled ? 'scale-85' : 'scale-90'
    }`}>
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center justify-center">
        <div className="w-[95%] bg-white/10 backdrop-blur-xl border-b border-white/20 rounded-b-4xl px-8 py-2 shadow-2xl">
          <div className="flex items-center justify-between">
            {/* Logo on extreme left */}
            {/* <div className="flex items-center">
              <img src={logo} alt="Logo" className="h-10 w-auto" />
            </div> */}
            <div className="flex items-center gap-2">
                          <AuroraText
                            className="text-2xl"
                            padding=""
                            colors={["#19E5A1", "#02684D", "#10B981"]}
                          >
                            <span className="font-pacifico text-white tracking-tight">
                              Stitcher
                            </span>
                          </AuroraText>
                        </div>

            {/* Navigation buttons */}
            <div className="flex items-center space-x-8">
              {navItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => scrollToSection(item.href)}
                  className="hover:cursor-pointer group flex flex-col items-center space-y-1 px-4 py-2 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-lg"
                >
                  <span className="text-sm text-white/70 group-hover:text-white transition-colors duration-300 font-medium">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Get Started button on extreme right */}
              <div className='relative'>
                <button onClick={()=>navigate("/home")} className="bg-[rgba(255,255,255,0.05)] hover:cursor-pointer rounded-full px-6 py-2 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 font-medium">
                  <ShineBorder borderWidth={2} duration={8} shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
                  Get Started
                </button>
              </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center justify-between w-screen bg-black/50 backdrop-blur-xl border-b border-white/10 rounded-b-3xl px-6 py-4 fixed top-0 left-0 z-50">
        <div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-white/80 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
        
        <div className=''>
            <button 
              onClick={() => navigate("/home")}
              className="bg-white/10 backdrop-blur-md rounded-full px-5 py-2 text-sm text-white font-medium hover:bg-white/20 transition-all border border-white/10 relative overflow-hidden"
            >
              <ShineBorder borderWidth={1.5} duration={8} shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
              <span className="relative z-10">Get Started</span>
            </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 w-full bg-black/95 backdrop-blur-xl border-b border-white/10 p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
            {navItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  scrollToSection(item.href);
                  setIsMobileMenuOpen(false);
                }}
                className="text-left py-3 px-4 rounded-xl text-lg text-white/80 hover:text-white hover:bg-white/10 transition-all font-medium"
              >
                {item.label}
              </button>
            ))}
            <button 
              onClick={() => {
                navigate("/home");
                setIsMobileMenuOpen(false);
              }}
              className="mt-4 w-full bg-white text-black rounded-xl py-3 text-lg font-bold hover:bg-gray-200 transition-colors"
            >
              Get Started
            </button>
          </div>
        )}
      </div>
      <style>{`
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default GlassyNavbar;