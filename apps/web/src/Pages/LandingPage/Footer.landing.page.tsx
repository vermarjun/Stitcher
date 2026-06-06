import React from 'react';
import { useNavigate } from 'react-router-dom';

const Footer: React.FC = () => {
  const currentYear = 2025;
  const navigate = useNavigate();

  return (
    <footer className="bg-black text-gray-300 py-8 px-4 md:px-8">
      <div className="mx-auto">
        {/* Main footer content */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <p className="text-sm md:text-base">
              This was built with ❤️ by Arjun Verma
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2">
            <button
              onClick={()=>window.location.href = "https://linkedin.com/in/vermarjun"}
              className= "hover:cursor-pointer text-gray-400 hover:text-white transition-colors duration-200 text-sm"
            >
              Get in Touch
            </button>
            <button
              onClick={()=>navigate("/privacypolicy")}
              className= "hover:cursor-pointer text-gray-400 hover:text-white transition-colors duration-200 text-sm"
            >
              Privacy Policy
            </button>
            <button
              onClick={()=>navigate("/termsconditions")}
              className= "hover:cursor-pointer text-gray-400 hover:text-white transition-colors duration-200 text-sm"
            >
              Terms & Conditions
            </button>
          </div>
        </div>

        {/* Copyright section */}
        <div className="border-t border-gray-800 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-xs text-gray-500 mb-2 md:mb-0">
              © {currentYear} Arjun Verma. All rights reserved.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://linkedin.com/in/vermarjun"
                className="text-gray-500 hover:text-gray-300 transition-colors duration-200 text-xs"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/vermarjun"
                className="text-gray-500 hover:text-gray-300 transition-colors duration-200 text-xs"
              >
                GitHub
              </a>
              <a
                href="https://x.com/Arjunv3rm4"
                className="text-gray-500 hover:text-gray-300 transition-colors duration-200 text-xs"
              >
                Twitter
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;