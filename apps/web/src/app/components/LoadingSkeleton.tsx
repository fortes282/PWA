"use client";

interface SkeletonProps {
  lines?: number;
  className?: string;
}

/**
 * Reusable loading skeleton — shows animated placeholder bars.
 */
export default function LoadingSkeleton({ lines = 3, className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} role="status" aria-label="Načítání...">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded"
          style={{ width: `${Math.max(40, 100 - i * 15)}%` }}
        />
      ))}
      <span className="sr-only">Načítání...</span>
    </div>
  );
}

/**
 * Card-shaped loading skeleton for dashboard widgets.
 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow p-6 animate-pulse ${className}`} role="status">
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
      </div>
      <span className="sr-only">Načítání...</span>
    </div>
  );
}

/**
 * Table loading skeleton.
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse" role="status">
      {/* Header */}
      <div className="flex gap-4 mb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-300 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 mb-2">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 bg-gray-100 rounded flex-1" />
          ))}
        </div>
      ))}
      <span className="sr-only">Načítání...</span>
    </div>
  );
}
