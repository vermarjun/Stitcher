import React from "react";

const SkeletonLoader: React.FC = () => (
  <div className="max-w-4xl mx-auto p-4 space-y-6">
    <div className="space-y-1.5">
      <div className="h-6 bg-zinc-800 rounded w-32 animate-pulse" />
      <div className="h-3 bg-zinc-800 rounded w-48 animate-pulse" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="space-y-1.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />
        ))}
      </div>

      <div className="md:col-span-3 space-y-4">
        <div className="h-48 bg-zinc-800 rounded animate-pulse" />
        <div className="flex gap-3">
          <div className="h-8 bg-zinc-800 rounded w-24 animate-pulse" />
          <div className="h-8 bg-zinc-800 rounded w-20 animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

export default SkeletonLoader;