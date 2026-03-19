"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light" as const, icon: Sun, label: "Světlý" },
    { value: "dark" as const, icon: Moon, label: "Tmavý" },
    { value: "system" as const, icon: Monitor, label: "Systém" },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`p-1.5 rounded-md transition-colors ${
            theme === value
              ? "bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400"
              : "text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
          title={label}
          aria-label={`Přepnout na ${label} režim`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
