"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

interface LottiePlayerProps {
  /** Path to the Lottie JSON file (e.g. "/lottie/success-checkmark.json") */
  src: string;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  /** Static content rendered when reduced motion is preferred or lottie-react is unavailable */
  fallback?: ReactNode;
}

/**
 * Lightweight Lottie wrapper that conditionally imports `lottie-react`.
 *
 * - Respects `prefers-reduced-motion` — renders static fallback instead.
 * - Safe to use even when the `lottie-react` package is not installed;
 *   the component will gracefully degrade to the fallback.
 *
 * To enable Lottie playback, install the package:
 *   pnpm add lottie-react
 */
export default function LottiePlayer({
  src,
  className,
  loop = false,
  autoplay = true,
  fallback,
}: LottiePlayerProps) {
  const shouldReduce = useReducedMotion();
  const [animationData, setAnimationData] = useState<unknown>(null);
  const [LottieComponent, setLottieComponent] = useState<React.ComponentType<any> | null>(null);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip loading when reduced motion is active
    if (shouldReduce) return;

    let cancelled = false;

    async function load() {
      try {
        // Dynamically import lottie-react — will fail gracefully if not installed
        // @ts-expect-error — lottie-react is an optional dependency
        const lottieModule = await import("lottie-react");
        const Lottie = lottieModule.default ?? lottieModule;

        // Fetch the animation JSON
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Failed to fetch ${src}`);
        const data = await res.json();

        if (!cancelled) {
          setLottieComponent(() => Lottie);
          setAnimationData(data);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [src, shouldReduce]);

  // If reduced motion is preferred, always show fallback
  if (shouldReduce && fallback) {
    return <div className={className}>{fallback}</div>;
  }

  // Loading or failed — show fallback
  if (failed || !LottieComponent || !animationData) {
    return fallback ? <div className={className}>{fallback}</div> : null;
  }

  return (
    <div ref={containerRef} className={className}>
      <LottieComponent
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
