"use client";

import { motion, useReducedMotion } from "framer-motion";

interface AnimatedLogoProps {
  size?: number;
}

const DRAW_DURATION = 0.55;
const DRAW_DELAY_STEP = 0.1;

export function AnimatedLogo({ size = 48 }: AnimatedLogoProps) {
  const shouldReduceMotion = useReducedMotion();

  const draw = (delay: number, duration = DRAW_DURATION) =>
    shouldReduceMotion
      ? { duration: 0 }
      : { duration, delay, ease: "easeOut" as const };

  const fadeIn = (delay: number, duration = 0.3) =>
    shouldReduceMotion
      ? { duration: 0 }
      : { duration, delay, ease: "easeOut" as const };

  const drawInitial = shouldReduceMotion
    ? { pathLength: 1, opacity: 1 }
    : { pathLength: 0, opacity: 0 };

  const fadeInitial = shouldReduceMotion
    ? { opacity: 1 }
    : { opacity: 0 };

  const totalDrawDuration = shouldReduceMotion ? 0 : DRAW_DURATION + DRAW_DELAY_STEP * 4 + 0.3;

  const pulseAnimation = shouldReduceMotion
    ? {}
    : {
        scale: [1, 1.02, 1],
        transition: {
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut" as const,
          delay: totalDrawDuration + 0.2,
        },
      };

  const lampPulse = shouldReduceMotion
    ? {}
    : {
        scale: [1, 1.12, 1],
        transition: {
          duration: 2.2,
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
        {/* 1. Tělo majáku — draw animace */}
        <motion.path
          d="M26,52 L28,20 L36,20 L38,52 Z"
          fill="white"
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={draw(0)}
        />

        {/* 2. Cap / střecha — draw */}
        <motion.path
          d="M24,22 L32,10 L40,22 Z"
          fill="white"
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={draw(DRAW_DELAY_STEP, 0.45)}
        />

        {/* 3. Základna — fade */}
        <motion.rect
          x="21"
          y="52"
          width="22"
          height="3.5"
          rx="1"
          fill="white"
          initial={fadeInitial}
          animate={{ opacity: 0.8 }}
          transition={fadeIn(DRAW_DELAY_STEP * 2)}
        />

        {/* 4. Oranžový stripe — fade */}
        <motion.path
          d="M26.8,42 L27.6,36 L36.4,36 L37.2,42 Z"
          fill="#E86A24"
          initial={fadeInitial}
          animate={{ opacity: 1 }}
          transition={fadeIn(DRAW_DELAY_STEP * 3)}
        />

        {/* 5. Lampa — outer group fade-in, inner circle pulse */}
        <motion.g
          initial={fadeInitial}
          animate={{ opacity: 1 }}
          transition={fadeIn(DRAW_DELAY_STEP * 4)}
        >
          {/* Glow za lampou */}
          <circle cx="32" cy="11" r="7" fill="#FBBF24" opacity={0.2} />
          {/* Lampa s pulse smyčkou */}
          <motion.circle
            cx="32"
            cy="11"
            r="4.5"
            fill="#FBBF24"
            animate={lampPulse}
            style={{ transformOrigin: "32px 11px" }}
          />
        </motion.g>
      </svg>
    </motion.div>
  );
}

export default AnimatedLogo;
