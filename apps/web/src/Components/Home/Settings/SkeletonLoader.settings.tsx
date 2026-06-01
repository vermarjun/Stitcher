import React from "react";
import { Skeleton } from "@/Components/ui/skeleton";

const SkeletonLoader: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-40 mb-6 h-14 w-full border-b border-zinc-800/80 bg-black/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 md:px-6">
          <Skeleton className="h-5 w-24 bg-zinc-900" />
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <Skeleton className="mb-1 h-3 w-20 bg-zinc-900" />
              <Skeleton className="h-2.5 w-28 bg-zinc-900" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full bg-zinc-900" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-20 md:px-6">
        {/* Profile card skeleton */}
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
          <Skeleton className="h-28 w-full rounded-none bg-zinc-800 md:h-36" />
          <div className="px-4 pb-5 md:px-5">
            <div className="flex items-end gap-3">
              <Skeleton className="-mt-9 h-[72px] w-[72px] rounded-full border-4 border-zinc-900 bg-zinc-800 md:h-20 md:w-20" />
              <div className="space-y-2 pb-1">
                <Skeleton className="h-5 w-40 bg-zinc-800" />
                <Skeleton className="h-3 w-56 bg-zinc-800" />
              </div>
            </div>
            <div className="my-5 h-px w-full bg-zinc-800" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-9 w-full bg-zinc-800" />
              <Skeleton className="h-9 w-full bg-zinc-800" />
            </div>
            <Skeleton className="mt-4 h-[88px] w-full bg-zinc-800" />
            <div className="mt-4 flex justify-end">
              <Skeleton className="h-9 w-32 bg-zinc-800" />
            </div>
          </div>
        </div>

        {/* Password card skeleton */}
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-4 md:px-5">
            <Skeleton className="h-9 w-9 rounded-lg bg-zinc-800" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-36 bg-zinc-800" />
              <Skeleton className="h-2.5 w-48 bg-zinc-800" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 px-4 py-5 sm:grid-cols-2 md:px-5">
            <Skeleton className="h-9 w-full bg-zinc-800 sm:col-span-2" />
            <Skeleton className="h-9 w-full bg-zinc-800" />
            <Skeleton className="h-9 w-full bg-zinc-800" />
          </div>
        </div>

        {/* Danger card skeleton */}
        <div className="overflow-hidden rounded-xl border border-red-500/20 bg-red-500/[0.03]">
          <div className="flex items-center gap-3 border-b border-red-500/15 px-4 py-4 md:px-5">
            <Skeleton className="h-9 w-9 rounded-lg bg-zinc-800" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28 bg-zinc-800" />
              <Skeleton className="h-2.5 w-44 bg-zinc-800" />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-4 md:px-5">
            <Skeleton className="h-3.5 w-32 bg-zinc-800" />
            <Skeleton className="h-9 w-32 bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
