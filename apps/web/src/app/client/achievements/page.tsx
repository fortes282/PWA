"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { Trophy, Star, Award } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientAchievements() {
  const shouldReduce = useReducedMotion();
  const { data: myBadges } = useSWR<any[]>("/gamification/my-badges", fetcher);
  const { data: allBadges } = useSWR<any[]>("/gamification/badges", fetcher);
  const { data: leaderboard } = useSWR<any[]>("/gamification/leaderboard", fetcher);

  const earnedIds = new Set((myBadges ?? []).map((b: any) => b.badgeId ?? b.id));
  const totalEarned = myBadges?.length ?? 0;
  const totalPoints = myBadges?.reduce((sum: number, b: any) => sum + (b.points ?? 0), 0) ?? 0;

  // Merge all badges with earned status
  const badges = (allBadges ?? []).map((badge: any) => {
    const earned = (myBadges ?? []).find((mb: any) => (mb.badgeId ?? mb.id) === badge.id);
    return {
      ...badge,
      isEarned: earnedIds.has(badge.id),
      earnedAt: earned?.earnedAt ?? earned?.createdAt,
      currentProgress: earned?.progress ?? 0,
    };
  });

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3"
          >
            <img
              src={totalEarned > 0 ? "/brand/mascot-celebrate.svg" : "/brand/mascot-happy.svg"}
              alt=""
              className="w-20 h-20"
              aria-hidden="true"
            />
            <div className="flex items-center gap-3">
              <Trophy size={24} className="text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Moje úspěchy</h1>
            </div>
          </motion.div>

          {/* Summary cards */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="card border-l-4 border-amber-400 dark:border-amber-600">
              <p className="text-xs text-gray-500 dark:text-gray-400">Získané odznaky</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalEarned}</p>
              {allBadges && (
                <p className="text-xs text-gray-500 dark:text-gray-400">z {allBadges.length} celkem</p>
              )}
            </div>
            <div className="card border-l-4 border-purple-400 dark:border-purple-600">
              <p className="text-xs text-gray-500 dark:text-gray-400">Celkem bodů</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalPoints.toLocaleString("cs-CZ")}</p>
            </div>
          </motion.div>

          {/* Badge grid */}
          <AnimatePresence mode="wait">
            {!allBadges ? (
              <motion.p
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Načítám odznaky...
              </motion.p>
            ) : badges.length === 0 ? (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card text-center py-8"
              >
                <img src="/brand/empty-achievements.svg" alt="" className="w-24 h-24 mx-auto mb-3" aria-hidden="true" />
                <p className="text-gray-500 dark:text-gray-400">Zatím nejsou k dispozici žádné odznaky</p>
              </motion.div>
            ) : (
              <motion.div
                key="badge-grid"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 md:grid-cols-3 gap-4"
              >
                {badges.map((badge: any, i: number) => (
                  <motion.div
                    key={badge.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className={`card text-center relative overflow-hidden ${
                      badge.isEarned
                        ? "ring-2 ring-amber-400 dark:ring-amber-500"
                        : "opacity-50 grayscale"
                    }`}
                  >
                    {/* Glow effect for earned badges */}
                    {badge.isEarned && !shouldReduce && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-900/20 dark:to-transparent pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      />
                    )}

                    <div className="relative z-10">
                      <motion.div
                        className="text-4xl mb-2"
                        animate={badge.isEarned && !shouldReduce ? { scale: [1, 1.1, 1] } : {}}
                        transition={shouldReduce ? { duration: 0 } : { duration: 2, repeat: Infinity, repeatDelay: 3 }}
                      >
                        {badge.emoji ?? badge.icon ?? "🏆"}
                      </motion.div>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{badge.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{badge.description}</p>

                      {badge.isEarned && badge.earnedAt ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2">
                          Získáno {new Date(badge.earnedAt).toLocaleDateString("cs-CZ")}
                        </p>
                      ) : badge.threshold && badge.threshold > 0 ? (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <motion.div
                              className="bg-primary-500 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (badge.currentProgress / badge.threshold) * 100)}%` }}
                              transition={{ type: "spring", stiffness: 200, damping: 28, delay: 0.2 + i * 0.04 }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {badge.currentProgress} / {badge.threshold}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Leaderboard */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
            className="card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Award size={18} className="text-amber-500" />
              <h2 className="font-semibold text-gray-800 dark:text-gray-200">Žebříček</h2>
            </div>

            {!leaderboard ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Načítám žebříček...</p>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Žebříček je prázdný</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry: any, i: number) => (
                  <motion.div
                    key={entry.id ?? i}
                    initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.17 + i * 0.03 }}
                    className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0"
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                      i === 1 ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300" :
                      i === 2 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" :
                      "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {entry.displayName ?? entry.name ?? `Uživatel #${entry.rank ?? i + 1}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star size={14} className="text-amber-500" />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {(entry.points ?? 0).toLocaleString("cs-CZ")}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
