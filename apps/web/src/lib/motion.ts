import type { Variants } from "framer-motion";

export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.25, ease: "easeIn" },
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

export const scaleOut: Variants = {
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

export const cardHover: Variants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

export const shakeVariant: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -8, 8, -6, 6, -4, 4, 0],
    transition: { duration: 0.5 },
  },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

export const slideFromBottom: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: 16,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// ── New variants for Phase 3 Polish ──────────────────────────────────────────

export const pulseGlow: Variants = {
  idle: { scale: 1, opacity: 1 },
  pulse: {
    scale: [1, 1.06, 1],
    opacity: [1, 0.85, 1],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const rotateIcon: Variants = {
  light: { rotate: 0, transition: { duration: 0.3, ease: "easeOut" } },
  dark: { rotate: 180, transition: { duration: 0.3, ease: "easeOut" } },
};

export const bounceIn: Variants = {
  hidden: { opacity: 0, scale: 0.6, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 18,
    },
  },
};

export const buttonTap = {
  whileTap: { scale: 0.97 },
} as const;

// ── New variants for Phase 4 Premium Polish ──────────────────────────────────

/** Swipe-to-dismiss: horizontal slide out */
export const swipeDismiss: Variants = {
  visible: { x: 0, opacity: 1 },
  dismiss: {
    x: -120,
    opacity: 0,
    transition: { duration: 0.25, ease: "easeIn" },
  },
};

/** Success checkmark pop — used after form submission */
export const successPop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 16 },
  },
};

/** Slide-over panel from right edge (full-height drawer) */
export const slideOverRight: Variants = {
  hidden: { x: "100%" },
  visible: {
    x: 0,
    transition: { type: "spring", stiffness: 320, damping: 32 },
  },
  exit: {
    x: "100%",
    transition: { duration: 0.25, ease: "easeIn" },
  },
};

/** Page-level fade+slide (used by AnimatedPages) */
export const pageFade: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};
