"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-slate-200/75",
        className
      )}
      {...props}
    />
  );
}

export function Canvas3DSkeleton({
  heightClass = "h-[460px]",
}: {
  heightClass?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading 3D Smart Parking Garage Scene"
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-blue-50/60 p-6 shadow-apple flex flex-col justify-between",
        heightClass
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48 rounded-full" />
        <Skeleton className="h-7 w-36 rounded-full" />
      </div>

      <div className="my-auto flex flex-col items-center justify-center space-y-4">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-brand-200 bg-brand-50/70 shadow-sm">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Initializing 3D Spatial Garage
          </p>
          <p className="text-xs text-slate-500">
            Loading instanced columns, miniature vehicles &amp; electric-blue lighting...
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-apple space-y-4">
      <Skeleton className="h-10 w-10 rounded-2xl" />
      <Skeleton className="h-4 w-24 rounded-full" />
      <Skeleton className="h-6 w-3/4 rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
