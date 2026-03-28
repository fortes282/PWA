"use client";

import {
  useRef,
  useCallback,
  useState,
  type ReactNode,
  useImperativeHandle,
  forwardRef,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";
import { MOTION } from "@/lib/motion";
import ConfettiCelebration from "./ConfettiCelebration";

export type InteractionType = "tap" | "success" | "error" | "celebrate" | "bounce";

export interface MicroInteractionRef {
  trigger: () => void;
}

interface MicroInteractionProps {
  type: InteractionType;
  children: ReactNode;
  disabled?: boolean;
}

/** Znovupoužitelný wrapper pro mikro-interakce s haptickou odezvou */
const MicroInteraction = forwardRef<MicroInteractionRef, MicroInteractionProps>(
  function MicroInteraction({ type, children, disabled = false }, ref) {
    const prefersReducedMotion = useReducedMotion();
    const [triggered, setTriggered] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const trigger = useCallback(() => {
      if (disabled) return;
      setTriggered(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setTriggered(false), 600);
    }, [disabled]);

    useImperativeHandle(ref, () => ({ trigger }), [trigger]);

    if (disabled || prefersReducedMotion) {
      return <>{children}</>;
    }

    // Tap — stisk se zmenšením
    if (type === "tap") {
      return (
        <motion.div
          whileTap={MOTION.variants.tap}
          onTapStart={() => haptics.light()}
          transition={{ ...MOTION.easing.spring, duration: MOTION.duration.micro }}
        >
          {children}
        </motion.div>
      );
    }

    // Success — zelený pulse
    if (type === "success") {
      return (
        <motion.div
          animate={
            triggered
              ? { scale: [1, 1.05, 1], boxShadow: ["0 0 0 0 rgba(34,197,94,0)", "0 0 12px 4px rgba(34,197,94,0.4)", "0 0 0 0 rgba(34,197,94,0)"] }
              : {}
          }
          transition={{ duration: MOTION.duration.short }}
          onAnimationStart={() => triggered && haptics.success()}
          style={{ borderRadius: "inherit" }}
        >
          {children}
        </motion.div>
      );
    }

    // Error — červený třes
    if (type === "error") {
      return (
        <motion.div
          animate={
            triggered
              ? { x: [0, -6, 6, -4, 4, 0], boxShadow: ["0 0 0 0 rgba(239,68,68,0)", "0 0 10px 2px rgba(239,68,68,0.35)", "0 0 0 0 rgba(239,68,68,0)"] }
              : {}
          }
          transition={{ duration: MOTION.duration.short }}
          onAnimationStart={() => triggered && haptics.error()}
          style={{ borderRadius: "inherit" }}
        >
          {children}
        </motion.div>
      );
    }

    // Celebrate — burst + konfety
    if (type === "celebrate") {
      return (
        <div className="relative">
          <motion.div
            animate={triggered ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: MOTION.duration.long }}
            onAnimationStart={() => triggered && haptics.success()}
          >
            {children}
          </motion.div>
          <ConfettiCelebration active={triggered} />
        </div>
      );
    }

    // Bounce — animace při připojení (mount)
    return (
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...MOTION.easing.springBouncy, duration: MOTION.duration.short }}
      >
        {children}
      </motion.div>
    );
  },
);

export default MicroInteraction;
