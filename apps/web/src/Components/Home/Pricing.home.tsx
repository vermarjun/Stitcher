import React from "react";
import { Scissors, Film, Video} from "lucide-react";

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
    </div>
  );
};

export default PricingPage;