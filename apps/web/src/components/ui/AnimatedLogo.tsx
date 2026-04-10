"use client";

import { motion, useReducedMotion } from "framer-motion";

interface AnimatedLogoProps {
  size?: number;
}

export function AnimatedLogo({ size = 48 }: AnimatedLogoProps) {
  const shouldReduceMotion = useReducedMotion();

  const draw = (delay: number, duration = 0.8) =>
    shouldReduceMotion
      ? { duration: 0 }
      : { duration, delay, ease: "easeOut" as const };

  const fadeIn = (delay: number, duration = 0.4) =>
    shouldReduceMotion
      ? { duration: 0 }
      : { duration, delay, ease: "easeOut" as const };

  const staticInitial = { pathLength: 1, opacity: 1 };
  const drawInitial = shouldReduceMotion
    ? staticInitial
    : { pathLength: 0, opacity: 0 };
  const fadeInitial = shouldReduceMotion
    ? { opacity: 1 }
    : { opacity: 0 };

  const totalDrawDuration = shouldReduceMotion ? 0 : 1.4;

  const pulseAnimation = shouldReduceMotion
    ? {}
    : {
        scale: [1, 1.03, 1],
        transition: {
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut" as const,
          delay: totalDrawDuration + 0.3,
        },
      };

  const lampPulse = shouldReduceMotion
    ? {}
    : {
        opacity: [1, 0.7, 1],
        scale: [1, 1.15, 1],
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut" as const,
          delay: totalDrawDuration + 0.5,
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
        {/* Lighthouse body — tapered trapezoid, draw from bottom up */}
        <motion.path
          d="M20,52 L24,20 L40,20 L44,52 Z"
          fill="white"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={draw(0, 0.8)}
        />

        {/* Cap / roof — triangle on top */}
        <motion.path
          d="M22,22 L32,10 L42,22 Z"
          fill="white"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={draw(0.15, 0.6)}
        />

        {/* Crossbar on lighthouse body */}
        <motion.line
          x1="22"
          y1="28"
          x2="42"
          y2="28"
          stroke="#242B61"
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={draw(0.3, 0.5)}
        />

        {/* Orange stripe across middle of body */}
        <motion.rect
          x="21"
          y="34"
          width="22"
          height="5"
          rx="0.5"
          fill="#E86A24"
          initial={fadeInitial}
          animate={{ opacity: 1 }}
          transition={fadeIn(0.4)}
        />

        {/* Lamp — outer group handles fade-in */}
        <motion.g
          initial={fadeInitial}
          animate={{ opacity: 1 }}
          transition={fadeIn(0.5)}
        >
          {/* Subtle glow behind the lamp */}
          <motion.circle
            cx="32"
            cy="12"
            r="7"
            fill="#FBBF24"
            opacity={0.25}
          />
          {/* Lamp — inner circle handles pulse loop */}
          <motion.circle
            cx="32"
            cy="12"
            r="4"
            fill="#FBBF24"
            animate={lampPulse}
            style={{ transformOrigin: "32px 12px" }}
          />
        </motion.g>

        {/* Small anchor below — ring */}
        <motion.circle
          cx="32"
          cy="55"
          r="2"
          stroke="white"
          strokeWidth="1"
          fill="none"
          opacity={0.5}
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={draw(0.6, 0.5)}
        />

        {/* Small anchor — vertical line */}
        <motion.line
          x1="32"
          y1="57"
          x2="32"
          y2="62"
          stroke="white"
          strokeWidth="1"
          strokeLinecap="round"
          opacity={0.5}
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={draw(0.65, 0.4)}
        />

        {/* Small anchor — left curved arm */}
        <motion.path
          d="M32,62 Q28,62 27,59"
          stroke="white"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={draw(0.7, 0.4)}
        />

        {/* Small anchor — right curved arm */}
        <motion.path
          d="M32,62 Q36,62 37,59"
          stroke="white"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
          initial={drawInitial}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={draw(0.75, 0.4)}
        />
      </svg>
    </motion.div>
  );
}

export default AnimatedLogo;
