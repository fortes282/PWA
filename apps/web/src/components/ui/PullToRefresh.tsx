"use client";
import { useState, useRef } from "react";
import { motion } from "framer-motion";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const THRESHOLD = 60;

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0 && window.scrollY === 0) {
      setPulling(true);
      setPullY(Math.min(diff, THRESHOLD * 1.5));
    }
  };

  const onTouchEnd = async () => {
    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
    setPullY(0);
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {(pulling || refreshing) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center py-2 text-primary-500"
        >
          <motion.div
            animate={refreshing ? { rotate: 360 } : { rotate: pullY * 3 }}
            transition={refreshing ? { repeat: Infinity, duration: 0.6, ease: "linear" } : {}}
          >
            ↓
          </motion.div>
        </motion.div>
      )}
      {children}
    </div>
  );
}
