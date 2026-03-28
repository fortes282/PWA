// Motion Design Tokens — based on standard_animaci_a_custom_grafiky_mobilni_aplikace.md
//
// Timing ranges:
//   micro:  120-160ms — tap, pressed, toggle, icon change
//   short:  180-220ms — chip, tab, inline content swap
//   medium: 240-320ms — modal, card expand, screen transition
//   long:   350-450ms — brand moment (use sparingly!)
//
// Rules:
//   - Max 1 dominant + 1 supporting animation per screen
//   - Decorative animations must not compete with CTA/text/status
//   - Loop animations only for informational purpose or empty states

export const MOTION = {
  // Duration tokens (seconds)
  duration: {
    micro: 0.14, //  140ms — tap, pressed, toggle, icon change
    short: 0.2, //  200ms — chip, tab, inline content swap
    medium: 0.28, //  280ms — modal, card expand, screen transition
    long: 0.4, //  400ms — brand moment (use sparingly!)
  },

  // Easing curves
  easing: {
    standard: [0.2, 0, 0, 1] as readonly [number, number, number, number], // Material 3 standard
    emphasized: [0.2, 0, 0, 1] as readonly [number, number, number, number], // enter
    decelerate: [0, 0, 0, 1] as readonly [number, number, number, number], // exit
    spring: { type: "spring" as const, stiffness: 380, damping: 28 },
    springSnappy: { type: "spring" as const, stiffness: 500, damping: 30 },
    springBouncy: { type: "spring" as const, stiffness: 300, damping: 20 },
  },

  // Framer Motion variants — ready to use
  variants: {
    // Tap feedback (micro)
    tap: { scale: 0.96 },

    // Card/item entrance (short)
    fadeInUp: {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
    },

    // Screen push (medium) — iOS-like
    screenEnter: {
      initial: { x: "100%", opacity: 0.8 },
      animate: { x: 0, opacity: 1 },
      exit: { x: "-30%", opacity: 0.5 },
    },

    // Screen pop (medium) — reverse
    screenExit: {
      initial: { x: "-30%", opacity: 0.5 },
      animate: { x: 0, opacity: 1 },
      exit: { x: "100%", opacity: 0.8 },
    },

    // Modal/sheet enter (medium)
    sheetEnter: {
      initial: { y: "100%" },
      animate: { y: 0 },
      exit: { y: "100%" },
    },

    // Fade (micro) — reduced motion fallback
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },

    // Scale bounce (short) — success feedback
    popIn: {
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
    },

    // Stagger children
    stagger: (delay = 0.04) => ({
      animate: { transition: { staggerChildren: delay } },
    }),
  },

  // Reduced motion: returns fade-only variants
  reduced: {
    tap: {},
    fadeInUp: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
    },
    screenEnter: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
  },
} as const;

// Helper: get variant based on reduced motion preference
export function motionVariant(
  shouldReduce: boolean | null,
  variant: keyof typeof MOTION.variants,
) {
  if (shouldReduce) {
    return (MOTION.reduced as Record<string, unknown>)[variant] ??
      MOTION.variants.fade;
  }
  return MOTION.variants[variant];
}
