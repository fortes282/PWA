"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface SearchResult {
  type: "user" | "appointment" | "invoice" | "medical";
  id: number;
  label: string;
  meta: Record<string, unknown>;
}

const dropdownVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: 0.1, ease: "easeIn" as const },
  },
};

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<{ results?: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}&limit=10`);
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const typeLabel: Record<string, string> = {
    user: "Uživatel",
    appointment: "Termín",
    invoice: "Faktura",
    medical: "Zpráva",
  };

  const typeColors: Record<string, string> = {
    user: "bg-blue-100 text-blue-700",
    appointment: "bg-green-100 text-green-700",
    invoice: "bg-yellow-100 text-yellow-700",
    medical: "bg-purple-100 text-purple-700",
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (result.type === "user") router.push(`/admin/users/${result.id}`);
    else if (result.type === "appointment") router.push(`/reception/appointments`);
    else if (result.type === "invoice") router.push(`/reception/billing`);
    else if (result.type === "medical") router.push(`/admin/medical-reports`);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Hledat..."
          className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-48 lg:w-64 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        />
        {loading && (
          <motion.div
            className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-gray-400 border-t-transparent rounded-full"
            animate={shouldReduce ? undefined : { rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" as const }}
          />
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            className="absolute top-full mt-1 left-0 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden"
            variants={shouldReduce ? undefined : dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}-${i}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColors[r.type] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
                  {typeLabel[r.type] ?? r.type}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{r.label}</span>
              </button>
            ))}
          </motion.div>
        )}

        {open && results.length === 0 && !loading && query.length >= 2 && (
          <motion.div
            className="absolute top-full mt-1 left-0 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 px-4 py-3"
            variants={shouldReduce ? undefined : dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">Nic nenalezeno</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
