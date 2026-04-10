"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Lighthouse icon — SVG path from Phosphor Icons (ph:lighthouse-fill)
 * Authors: Tobias Fried & Helena Zhang · MIT License · phosphoricons.com
 *
 * Viewbox 0 0 256 256. Anatomy:
 *   - cap/lamp area:  y ≈ 0–50   → gold lamp circle overlaid at cy=22
 *   - gallery band:   y ≈ 50–120 → white (includes horizontal arms)
 *   - tower body:     y ≈ 120–215
 *   - base:           y ≈ 215–232 → M72,216 sub-path
 *
 * Orange stripe clipped to icon silhouette via <clipPath>.
 */
const PATH =
  "M208 80a8 8 0 0 0-8 8v16h-11.15L184 55.2a8 8 0 0 0-2.69-5.2" +
  "l-42.87-38.12-.2-.17a16 16 0 0 0-20.48 0l-.2.17L74.68 50" +
  "A7.93 7.93 0 0 0 72 55.2L67.15 104H56V88a8 8 0 0 0-16 0v24" +
  "a8 8 0 0 0 8 8h17.54l-9.47 94.48A16 16 0 0 0 72 232h112" +
  "a16 16 0 0 0 15.92-17.56L190.46 120H208a8 8 0 0 0 8-8V88" +
  "a8 8 0 0 0-8-8M87.24 64h81.52l4 40H136V88a8 8 0 0 0-16 0" +
  "v16H83.23ZM72 216l4.81-48h102.38l4.81 48Z";

interface AnimatedLogoProps {
  size?: number;
}

export function AnimatedLogo({ size = 48 }: AnimatedLogoProps) {
  const shouldReduceMotion = useReducedMotion();

  const glowAnim = shouldReduceMotion
    ? {}
    : {
        scale: [1, 1.5, 1],
        opacity: [0.18, 0.38, 0.18],
        transition: {
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };

  const lampAnim = shouldReduceMotion
    ? {}
    : {
        scale: [1, 1.12, 1],
        opacity: [0.88, 1, 0.88],
        transition: {
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };

  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Ořez pruhu přesně na siluetu majáku */}
        <clipPath id="lh-clip">
          <path d={PATH} />
        </clipPath>
      </defs>

      {/* ── Lampa — glow (za ikonou) ── */}
      <motion.circle
        cx="128"
        cy="22"
        r="34"
        fill="#FBBF24"
        initial={{ scale: 1, opacity: 0.18 }}
        animate={glowAnim}
        style={{ transformOrigin: "128px 22px" }}
      />

      {/* ── Silueta majáku (bílá) ── */}
      <path fill="white" d={PATH} />

      {/* ── Oranžový pruh — oříznutý siluetem ── */}
      <rect
        x="0"
        y="138"
        width="256"
        height="44"
        fill="#E86A24"
        clipPath="url(#lh-clip)"
      />

      {/* ── Lampa — zlatý kruh nahoře ── */}
      <motion.circle
        cx="128"
        cy="22"
        r="18"
        fill="#FBBF24"
        initial={{ scale: 1, opacity: 0.88 }}
        animate={lampAnim}
        style={{ transformOrigin: "128px 22px" }}
      />
    </svg>
  );
}

export default AnimatedLogo;
