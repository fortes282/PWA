"use client";

import { motion, useReducedMotion } from "framer-motion";

interface AnimatedLogoProps {
  size?: number;
}

const DRAW_DURATION = 1.5;
const DRAW_DELAY_STEP = 0.15;

export function AnimatedLogo({ size = 48 }: AnimatedLogoProps) {
  const shouldReduceMotion = useReducedMotion();

  const drawTransition = (delay: number) =>
    shouldReduceMotion
      ? { duration: 0 }
      : { duration: DRAW_DURATION, delay, ease: "easeOut" as const };

  const totalDrawDuration = shouldReduceMotion
    ? 0
    : DRAW_DURATION + DRAW_DELAY_STEP * 4;

  const pulseAnimation = shouldReduceMotion
    ? {}
    : {
        scale: [1, 1.05, 1],
        transition: {
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut" as const,
          delay: totalDrawDuration + 0.3,
        },
      };

  return (
    <motion.div
      style={{ width: size, height: size }}
      animate={pulseAnimation}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
      >
        {/* Anchor ring */}
        <motion.circle
          cx="32"
          cy="14"
          r="5"
          stroke="white"
          strokeWidth="3"
          fill="none"
          initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={drawTransition(0)}
        />
        {/* Anchor vertical shaft */}
        <motion.line
          x1="32"
          y1="19"
          x2="32"
          y2="52"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={drawTransition(DRAW_DELAY_STEP)}
        />
        {/* Anchor horizontal crossbar */}
        <motion.line
          x1="20"
          y1="27"
          x2="44"
          y2="27"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={drawTransition(DRAW_DELAY_STEP * 2)}
        />
        {/* Left arm */}
        <motion.path
          d="M32 52 Q20 52 18 44"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={drawTransition(DRAW_DELAY_STEP * 3)}
        />
        {/* Right arm */}
        <motion.path
          d="M32 52 Q44 52 46 44"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={drawTransition(DRAW_DELAY_STEP * 4)}
        />
        {/* Crossbar tips */}
        <motion.circle
          cx="20"
          cy="27"
          r="2"
          fill="white"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, delay: DRAW_DELAY_STEP * 2 + 0.3 }}
        />
        <motion.circle
          cx="44"
          cy="27"
          r="2"
          fill="white"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, delay: DRAW_DELAY_STEP * 2 + 0.3 }}
        />
      </svg>
    </motion.div>
  );
}

export default AnimatedLogo;
