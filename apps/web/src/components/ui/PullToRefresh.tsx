"use client";
import { useState, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { haptics } from "@/lib/haptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 64;
const MAX_PULL = THRESHOLD * 1.4;

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const thresholdReached = useRef(false);
  const shouldReduce = useReducedMotion();

  const progress = Math.min(pullY / THRESHOLD, 1); // 0 → 1
  const isReady = pullY >= THRESHOLD;

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    thresholdReached.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0 && window.scrollY === 0) {
      setPulling(true);
      const clamped = Math.min(diff, MAX_PULL);
      setPullY(clamped);
      // Haptic feedback exactly once when threshold is crossed
      if (clamped >= THRESHOLD && !thresholdReached.current) {
        thresholdReached.current = true;
        haptics.light();
      }
    }
  };

  const onTouchEnd = async () => {
    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(0);
      setPulling(false);
      await onRefresh();
      haptics.success();
      setRefreshing(false);
    } else {
      setPulling(false);
      setPullY(0);
    }
    thresholdReached.current = false;
  };

  const showIndicator = pulling || refreshing;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <motion.div
        animate={showIndicator ? { height: refreshing ? 48 : Math.max(pullY * 0.55, 0), opacity: 1 } : { height: 0, opacity: 0 }}
        transition={
          shouldReduce
            ? { duration: 0 }
            : pulling
            ? { type: "spring", stiffness: 280, damping: 32, mass: 0.6 }
            : { type: "spring", stiffness: 420, damping: 36, mass: 0.5 }
        }
        className="flex items-center justify-center overflow-hidden"
      >
        <motion.div
          animate={
            refreshing
              ? { rotate: 360, scale: 1, opacity: 1 }
              : {
                  rotate: progress * 180,
                  scale: shouldReduce ? 1 : 0.5 + progress * 0.5,
                  opacity: 0.3 + progress * 0.7,
                }
          }
          transition={
            refreshing && !shouldReduce
              ? { rotate: { repeat: Infinity, duration: 0.7, ease: "linear" }, scale: { duration: 0.15 } }
              : refreshing && shouldReduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 380, damping: 28 }
          }
          className={`transition-colors ${isReady || refreshing ? "text-primary-500" : "text-gray-400 dark:text-gray-400"}`}
        >
          <RefreshCw size={20} strokeWidth={2.2} />
        </motion.div>
      </motion.div>
      {children}
    </div>
  );
}
