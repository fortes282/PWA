"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, ExternalLink, Clock } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

export default function ClientHomework() {
  const [showCompleted, setShowCompleted] = useState(false);
  const { data: active, mutate: mutateActive } = useSWR("/homework?status=ACTIVE", fetcher);
  const { data: completed, mutate: mutateCompleted } = useSWR(
    showCompleted ? "/homework?status=COMPLETED" : null,
    fetcher
  );

  const markComplete = async (id: number) => {
    try {
      await api.patch(`/homework/${id}`, { status: "COMPLETED" });
      mutateActive();
      if (showCompleted) mutateCompleted();
    } catch {
      alert("Chyba při označování");
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
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={24} className="text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Domácí cvičení</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cvičení přiřazená vaším terapeutem</p>
            </div>
          </div>

          {(!active || active.length === 0) ? (
            <div className="card text-center py-8">
              <BookOpen size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 dark:text-gray-500">Zatím nemáte žádné aktivní cvičení</p>
            </div>
          ) : (
            <div className="space-y-4">
              {active.map((hw: any) => {
                const exercises = parseExercises(hw.exercises);
                return (
                  <div key={hw.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{hw.title}</h3>
                        {hw.employee_name && (
                          <p className="text-xs text-gray-400 mt-0.5">od {hw.employee_name}</p>
                        )}
                        {hw.due_date && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1 mt-1">
                            <Clock size={12} />
                            Do {new Date(hw.due_date).toLocaleDateString("cs-CZ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => markComplete(hw.id)}
                        className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors min-h-[44px] flex items-center gap-1"
                      >
                        <Check size={14} />
                        Hotovo
                      </button>
                    </div>
                    {hw.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">{hw.description}</p>
                    )}
                    {exercises.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {exercises.map((ex: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <span className="text-xs font-bold text-primary-600 dark:text-primary-400 mt-0.5">{i + 1}.</span>
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ex.name}</p>
                              {ex.sets && ex.reps && (
                                <p className="text-xs text-gray-500">{ex.sets}× {ex.reps} opakování</p>
                              )}
                              {ex.duration && (
                                <p className="text-xs text-gray-500">{ex.duration}</p>
                              )}
                              {ex.notes && (
                                <p className="text-xs text-gray-400 mt-1">{ex.notes}</p>
                              )}
                            </div>
                          </div>
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
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mx-auto min-h-[44px]"
          >
            {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showCompleted ? "Skrýt dokončená" : "Zobrazit dokončená"}
          </button>

          {showCompleted && completed && completed.length > 0 && (
            <div className="space-y-3 opacity-60">
              {completed.map((hw: any) => (
                <div key={hw.id} className="card">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-green-500" />
                    <h3 className="font-medium text-gray-600 dark:text-gray-400 line-through">{hw.title}</h3>
                  </div>
                  {hw.completed_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Dokončeno {new Date(hw.completed_at).toLocaleDateString("cs-CZ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
