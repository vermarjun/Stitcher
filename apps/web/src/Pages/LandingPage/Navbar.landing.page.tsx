import {useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

import { ShineBorder } from '@/Components/magicui/shine-border';

import { useNavigate } from 'react-router-dom';

import logo from "/logo.png"

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
            <div className="flex items-center">
              <img src={logo} alt="Logo" className="h-10 w-auto" />
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
      <div className="md:hidden flex items-center justify-between w-screen bg-white/10 backdrop-blur-xl border-b border-white/20 rounded-b-4xl px-8 shadow-2xl">
        <div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-full py-4 shadow-2xl"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <div className='flex justify-center items-center gap-2'>
                <Menu className="w-6 h-6 text-white" />
                <span className='text-white'>Menu</span>
              </div>
            )}
          </button>
        </div>
        <div className=''>
            <button className="bg-white/2 backdrop-blur-xl rounded-full px-6 py-2 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 font-medium">
              <ShineBorder borderWidth={2} duration={8} shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
              Get Started
            </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="absolute w-full top-20 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col space-y-4">
            {navItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  scrollToSection(item.href);
                  setIsMobileMenuOpen(false);
                }}
                className="group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 hover:bg-white/20"
              >
                <span className="text-white/80 group-hover:text-white transition-colors duration-300 font-medium">
                  {item.label}
                </span>
              </button>
            ))}
            <button className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-full px-6 py-2 text-white/80 hover:text-white hover:bg-white/30 transition-all duration-300 font-medium mt-4">
              Get Started
            </button>
          </div>
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