import React from 'react';
import { motion } from 'motion/react';

// Custom shimmering animation for the high-end Perfect Fit theme
const shimmerStyle = "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/12 before:to-transparent";

export function PatternCardSkeleton() {
  return (
    <div className="bg-white rounded-[4px] border border-sand-200/85 shadow-xs overflow-hidden flex flex-col justify-between" id="skeleton-card">
      {/* Cover image skeleton */}
      <div className={`relative aspect-[3/4.2] w-full bg-sand-100/70 border-b border-sand-150 ${shimmerStyle}`} id="skeleton-card-img" />

      {/* Details Box skeleton */}
      <div className="p-4 flex-1 flex flex-col justify-between bg-[#fdfdfc]" id="skeleton-details-box">
        <div>
          {/* Price & Rating Row */}
          <div className="flex items-center justify-between mb-2.5">
            <div className={`h-5 w-14 bg-sand-200 rounded ${shimmerStyle}`} />
            <div className={`h-4 w-24 bg-sand-100/80 rounded ${shimmerStyle}`} />
          </div>

          {/* Title */}
          <div className={`h-5 w-3/4 bg-sand-200 rounded mb-2 ${shimmerStyle}`} id="skeleton-card-title" />

          {/* Difficulty badge row */}
          <div className="flex items-center gap-1.5 mt-2 mb-3">
            <div className={`h-4 w-20 bg-sand-150 rounded ${shimmerStyle}`} />
            <div className={`h-3 w-24 bg-sand-100/60 rounded ${shimmerStyle}`} />
          </div>

          {/* Tagline / Description lines */}
          <div className="space-y-1.5 mb-3.5">
            <div className={`h-3.5 w-full bg-sand-100/60 rounded ${shimmerStyle}`} />
            <div className={`h-3.5 w-11/12 bg-sand-100/60 rounded ${shimmerStyle}`} />
          </div>

          {/* Quick Specifications */}
          <div className="border-t border-b border-sand-200/50 py-2.5 mb-3.5 space-y-1.5">
            <div className="flex justify-between">
              <div className={`h-3 w-16 bg-sand-100 rounded ${shimmerStyle}`} />
              <div className={`h-3 w-24 bg-sand-150 rounded ${shimmerStyle}`} />
            </div>
            <div className="flex justify-between">
              <div className={`h-3 w-16 bg-sand-100 rounded ${shimmerStyle}`} />
              <div className={`h-3 w-10 bg-sand-150 rounded ${shimmerStyle}`} />
            </div>
          </div>
        </div>

        {/* Compact Actions Row */}
        <div className="mt-2" id="skeleton-card-actions">
          <div className="flex gap-1.5 items-center">
            {/* Add to Cart skeleton */}
            <div className={`flex-1 h-9 bg-sand-900/10 rounded-[4px] ${shimmerStyle}`} />
            {/* Quick summary button skeleton */}
            <div className={`h-9 w-9 bg-sand-100 rounded-[4px] ${shimmerStyle}`} />
          </div>
          {/* Caption text skeleton */}
          <div className={`h-2 w-2/3 bg-sand-100/50 mx-auto rounded mt-2 ${shimmerStyle}`} />
        </div>
      </div>
    </div>
  );
}

export function OrbitCarouselSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white border border-sand-200 p-6 lg:p-10 rounded-[4px] shadow-2xs items-start" id="skeleton-carousel">

      {/* LEFT COLUMN: Large Orbital Presentation / Carousel Area (6 Cols) */}
      <div className="lg:col-span-6 space-y-6 flex flex-col items-center">
        {/* SVG/Blueprint stage frame */}
        <div className="relative w-full aspect-[4/5] bg-sand-50 border border-sand-200/80 rounded-[4px] flex items-center justify-center overflow-hidden">
          {/* Soft pulsing placeholder illustration circle */}
          <div className="absolute w-[80%] aspect-square rounded-full border border-sand-150 flex items-center justify-center animate-pulse">
            <div className="w-[85%] aspect-square rounded-full border border-dashed border-sand-200" />
          </div>
          <div className={`w-32 h-44 bg-sand-200/40 rounded-md z-10 ${shimmerStyle}`} />
        </div>

        {/* Small thumbnail sliders */}
        <div className="flex gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`w-14 h-14 bg-sand-100 border border-sand-200/60 rounded-[2px] ${shimmerStyle}`} />
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: Product Configurator details (6 Cols) */}
      <div className="lg:col-span-6 space-y-6">
        <div className="space-y-3">
          {/* Metadata breadcrumbs */}
          <div className="flex items-center gap-2">
            <div className={`h-4 w-20 bg-sand-200 rounded ${shimmerStyle}`} />
            <div className="h-3 w-3 rounded-full bg-sand-150" />
            <div className={`h-4 w-24 bg-sand-150 rounded ${shimmerStyle}`} />
          </div>

          {/* Large Title */}
          <div className={`h-8 w-11/12 bg-sand-200 rounded ${shimmerStyle}`} id="skeleton-carousel-title" />

          {/* Subtitle / Tagline */}
          <div className={`h-4.5 w-3/4 bg-sand-150 rounded ${shimmerStyle}`} />

          {/* Micro summary */}
          <div className="flex items-center gap-3 pt-1">
            <div className={`h-4 w-12 bg-sand-200 rounded ${shimmerStyle}`} />
            <div className={`h-4 w-16 bg-sand-200 rounded ${shimmerStyle}`} />
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="flex gap-6 border-b border-sand-200 pb-2">
          <div className={`h-4 w-24 bg-sand-200 rounded ${shimmerStyle}`} />
          <div className={`h-4 w-28 bg-sand-150 rounded ${shimmerStyle}`} />
          <div className={`h-4 w-20 bg-sand-150 rounded ${shimmerStyle}`} />
        </div>

        {/* Tab Description Content Block */}
        <div className="space-y-2.5 py-2">
          <div className={`h-3 w-full bg-sand-100 rounded ${shimmerStyle}`} />
          <div className={`h-3 w-full bg-sand-100 rounded ${shimmerStyle}`} />
          <div className={`h-3 w-11/12 bg-sand-100 rounded ${shimmerStyle}`} />
          <div className={`h-3 w-4/5 bg-sand-100 rounded ${shimmerStyle}`} />
        </div>

        {/* Format Selectors Block */}
        <div className="space-y-3 pt-2">
          <div className={`h-4.5 w-32 bg-sand-150 rounded ${shimmerStyle}`} />
          <div className="grid grid-cols-2 gap-4">
            <div className={`h-14 bg-sand-50 rounded border border-sand-200/80 ${shimmerStyle}`} />
            <div className={`h-14 bg-sand-50 rounded border border-sand-200/80 ${shimmerStyle}`} />
          </div>
        </div>

        {/* Size Selection Grid */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <div className={`h-4.5 w-24 bg-sand-150 rounded ${shimmerStyle}`} />
            <div className={`h-4 w-32 bg-sand-100 rounded ${shimmerStyle}`} />
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className={`h-8 bg-sand-50 rounded border border-sand-200/60 ${shimmerStyle}`} />
            ))}
          </div>
        </div>

        {/* Pricing tag & Cart Button Row */}
        <div className="flex items-center justify-between pt-4 border-t border-sand-200/80">
          <div className="space-y-1">
            <div className={`h-3 w-12 bg-sand-150 rounded ${shimmerStyle}`} />
            <div className={`h-6 w-20 bg-sand-300 rounded ${shimmerStyle}`} />
          </div>
          <div className={`h-11 w-48 bg-clay-700/20 rounded-[4px] ${shimmerStyle}`} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="skeleton-grid-container">
      {Array.from({ length: count }).map((_, index) => (
        <PatternCardSkeleton key={index} />
      ))}
    </div>
  );
}
