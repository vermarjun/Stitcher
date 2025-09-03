// components/Features.tsx
import React from 'react';
import type { Feature } from './types';

interface FeaturesProps {
  features: Feature[];
}
const Features: React.FC<FeaturesProps> = ({ features = [] }) => {
  return (
    <section id="features" className="py-20 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          {/* Header content goes here */}
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="text-center p-6 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900 hover:bg-gray-800 transition-all">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-800 rounded-lg mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;