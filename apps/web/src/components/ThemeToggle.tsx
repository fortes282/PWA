"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  const options = [
    { value: "light" as const, icon: Sun, label: "Světlý" },
    { value: "dark" as const, icon: Moon, label: "Tmavý" },
    { value: "system" as const, icon: Monitor, label: "Systém" },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {options.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        const isDark = value === "dark";
        const rotateAngle = shouldReduceMotion ? 0 : (isDark && isActive ? 180 : 0);

        return (
          <motion.button
            key={value}
            onClick={() => setTheme(value)}
            whileTap={shouldReduceMotion ? {} : { scale: 0.85 }}
            className={`p-1.5 rounded-md transition-colors ${
              isActive
                ? "bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400"
                : "text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
            title={label}
            aria-label={`Přepnout na ${label} režim`}
          >
            <motion.span
              animate={{ rotate: rotateAngle }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="block"
            >
              <Icon size={14} />
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  );
}
