"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { BookOpen, Check, ChevronDown, ExternalLink, Clock } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any[]>(url);

export default function ClientHomework() {
  const shouldReduce = useReducedMotion();
  const [showCompleted, setShowCompleted] = useState(false);
  const { toast } = useToast();
  const { data: active, mutate: mutateActive } = useSWR("/homework?status=ACTIVE", fetcher);
  const { data: completed, mutate: mutateCompleted } = useSWR(
    showCompleted ? "/homework?status=COMPLETED" : null,
    fetcher
  );

  const markComplete = async (id: number) => {
    try {
      await api.patch(`/homework/${id}`, { status: "COMPLETED" });
      toast("success", "Cvičení označeno jako hotové!");
      mutateActive();
      if (showCompleted) mutateCompleted();
    } catch {
      toast("error", "Chyba při označování cvičení.");
    }
  };

  const parseExercises = (ex: string | null) => {
    if (!ex) return [];
    try { return JSON.parse(ex); } catch { return []; }
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-2"
          >
            <BookOpen size={24} className="text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Domácí cvičení</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cvičení přiřazená vaším terapeutem</p>
            </div>
          </motion.div>

          {/* Empty state */}
          <AnimatePresence mode="wait">
            {(!active || active.length === 0) ? (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                className="card text-center py-8"
              >
                <img src="/brand/empty-homework.svg" alt="" className="w-32 h-32 mx-auto mb-4" aria-hidden="true" />
                <p className="text-gray-500 dark:text-gray-400">Zatím nemáte žádné aktivní cvičení</p>
              </motion.div>
            ) : (
              <motion.div
                key="active-list"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {active.map((hw: any, cardIdx: number) => {
                  const exercises = parseExercises(hw.exercises);
                  return (
                    <motion.div
                      key={hw.id}
                      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.06 + cardIdx * 0.06 }}
                      className="card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{hw.title}</h3>
                          {hw.employee_name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">od {hw.employee_name}</p>
                          )}
                          {hw.due_date && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1 mt-1">
                              <Clock size={12} />
                              Do {new Date(hw.due_date).toLocaleDateString("cs-CZ")}
                            </p>
                          )}
                        </div>
                        <motion.button
                          onClick={() => markComplete(hw.id)}
                          className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors min-h-[44px] flex items-center gap-1"
                          whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                        >
                          <Check size={14} />
                          Hotovo
                        </motion.button>
                      </div>

                      {hw.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">{hw.description}</p>
                      )}

                      {exercises.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {exercises.map((ex: any, i: number) => (
                            <motion.div
                              key={i}
                              initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 + cardIdx * 0.06 + i * 0.03 }}
                              className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                            >
                              <span className="text-xs font-bold text-primary-600 dark:text-primary-400 mt-0.5">{i + 1}.</span>
                              <div>
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ex.name}</p>
                                {ex.sets && ex.reps && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{ex.sets}× {ex.reps} opakování</p>
                                )}
                                {ex.duration && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{ex.duration}</p>
                                )}
                                {ex.notes && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ex.notes}</p>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {hw.video_url && (
                        <a
                          href={hw.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline mt-3 min-h-[44px]"
                        >
                          <ExternalLink size={14} />
                          Instruktážní video
                        </a>
                      )}

                      {/* Media gallery */}
                      {hw.media_urls && (() => {
                        let mediaItems: string[] = [];
                        try { mediaItems = JSON.parse(hw.media_urls); } catch { mediaItems = []; }
                        if (mediaItems.length === 0) return null;
                        const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
                        return (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Fotky/videa</p>
                            <div className="grid grid-cols-3 gap-2">
                              {mediaItems.map((url, idx) => {
                                const isVideo = url.match(/\.(mp4|webm|mov)$/i);
                                const fullUrl = url.startsWith("http") ? url : `${apiBase}${url}`;
                                if (isVideo) {
                                  return (
                                    <motion.video
                                      key={idx}
                                      src={fullUrl}
                                      controls
                                      className="w-full aspect-square object-cover rounded-lg"
                                      preload="metadata"
                                      initial={shouldReduce ? {} : { opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 + idx * 0.04 }}
                                    />
                                  );
                                }
                                return (
                                  <motion.a
                                    key={idx}
                                    href={fullUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    initial={shouldReduce ? {} : { opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 + idx * 0.04 }}
                                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={fullUrl}
                                      alt={`Media ${idx + 1}`}
                                      className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity"
                                    />
                                  </motion.a>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Completed toggle */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
            className="flex justify-center"
          >
            <motion.button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 min-h-[44px] px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <motion.span
                animate={shouldReduce ? {} : { rotate: showCompleted ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <ChevronDown size={14} />
              </motion.span>
              {showCompleted ? "Skrýt dokončená" : "Zobrazit dokončená"}
            </motion.button>
          </motion.div>

          {/* Completed list */}
          <AnimatePresence>
            {showCompleted && completed && completed.length > 0 && (
              <motion.div
                key="completed-list"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="space-y-3 opacity-60"
              >
                {completed.map((hw: any, i: number) => (
                  <motion.div
                    key={hw.id}
                    initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className="card"
                  >
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-green-500" />
                      <h3 className="font-medium text-gray-600 dark:text-gray-400 line-through">{hw.title}</h3>
                    </div>
                    {hw.completed_at && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Dokončeno {new Date(hw.completed_at).toLocaleDateString("cs-CZ")}
                      </p>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
