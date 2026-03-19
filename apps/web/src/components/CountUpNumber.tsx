"use client";

import { useCountUp } from "@/hooks/useCountUp";

interface CountUpNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}

export default function CountUpNumber({ value, decimals = 0, duration = 1200, className }: CountUpNumberProps) {
  const animated = useCountUp({ target: value, duration, decimals });
  return <span className={className}>{animated.toFixed(decimals)}</span>;
}
