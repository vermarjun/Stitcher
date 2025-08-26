import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
}

const ThreeDotLoader: React.FC<LoaderProps> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24', 
    lg: 'w-32 h-32'
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className={`${sizeClasses[size]} relative`}>
        {/* Three gravitational dots */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              animation: `orbitRotate 4s ease-in-out infinite`,
              animationDelay: `${i * 1.33}s` // 120 degree spacing (4s / 3)
            }}
          >
            <div
              className="absolute bg-white rounded-full"
              style={{
                width: `${0.5 + i * 0.125}rem`,
                height: `${0.5 + i * 0.125}rem`,
                top: '20%',
                left: '50%',
                transform: 'translateX(-50%)',
                boxShadow: `
                  0 0 8px rgba(255,255,255,0.8),
                  0 0 16px rgba(255,255,255,0.4),
                  0 0 24px rgba(255,255,255,0.2)
                `,
                animation: `gravitationalPulse ${3 + i * 0.5}s ease-in-out infinite alternate`
              }}
            />
          </div>
        ))}

        {/* Central gravitational field indicator */}
        <div 
          className="absolute top-1/2 left-1/2 w-1 h-1 bg-white/30 rounded-full transform -translate-x-1/2 -translate-y-1/2"
          style={{
            boxShadow: '0 0 4px rgba(255,255,255,0.3)',
            animation: 'centralPulse 6s ease-in-out infinite'
          }}
        />

        {/* Subtle orbital paths */}
        <div 
          className="absolute inset-0 rounded-full border border-white/5"
          style={{
            transform: 'scale(0.6)',
            animation: 'pathGlow 8s ease-in-out infinite alternate'
          }}
        />
      </div>

      <style>{`
        @keyframes orbitRotate {
          0% { 
            transform: rotate(0deg) scale(1);
          }
          25% { 
            transform: rotate(90deg) scale(0.9);
          }
          50% { 
            transform: rotate(180deg) scale(1);
          }
          75% { 
            transform: rotate(270deg) scale(1.1);
          }
          100% { 
            transform: rotate(360deg) scale(1);
          }
        }
        
        @keyframes gravitationalPulse {
          0% { 
            transform: translateX(-50%) scale(1);
            filter: brightness(1);
          }
          50% {
            transform: translateX(-50%) scale(1.1);
            filter: brightness(1.2);
          }
          100% { 
            transform: translateX(-50%) scale(0.9);
            filter: brightness(0.8);
          }
        }
        
        @keyframes centralPulse {
          0%, 100% { 
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.3;
          }
          50% { 
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0.1;
          }
        }
        
        @keyframes pathGlow {
          0%, 100% { 
            opacity: 0.05;
          }
          50% { 
            opacity: 0.15;
          }
        }
      `}</style>
    </div>
  );
};

export default ThreeDotLoader;