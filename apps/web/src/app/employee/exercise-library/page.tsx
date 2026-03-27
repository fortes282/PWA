"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Dumbbell, Plus, X, Play, ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

const CATEGORIES = [
  { value: "ALL", label: "Vše" },
  { value: "STRETCHING", label: "Protahování" },
  { value: "STRENGTH", label: "Síla" },
  { value: "BREATHING", label: "Dýchání" },
  { value: "MINDFULNESS", label: "Mindfulness" },
  { value: "MOBILITY", label: "Mobilita" },
  { value: "BALANCE", label: "Rovnováha" },
];

const DIFFICULTIES = [
  { value: "ALL", label: "Vše" },
  { value: "EASY", label: "Snadné" },
  { value: "MEDIUM", label: "Střední" },
  { value: "HARD", label: "Těžké" },
];

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  MEDIUM: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  HARD: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Snadné",
  MEDIUM: "Střední",
  HARD: "Těžké",
};

const CATEGORY_LABEL: Record<string, string> = {
  STRETCHING: "Protahování",
  STRENGTH: "Síla",
  BREATHING: "Dýchání",
  MINDFULNESS: "Mindfulness",
  MOBILITY: "Mobilita",
  BALANCE: "Rovnováha",
};

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function EmployeeExerciseLibrary() {
  const shouldReduce = useReducedMotion();
  const { data: exercises, mutate } = useSWR("/exercise-library", fetcher);
  const { data: clients } = useSWR("/employees/me/clients", fetcher);
  const { toast } = useToast();

  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeDifficulty, setActiveDifficulty] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("STRETCHING");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formDifficulty, setFormDifficulty] = useState("EASY");
  const [formBodyPart, setFormBodyPart] = useState("");
  const [formInstructions, setFormInstructions] = useState("");

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormCategory("STRETCHING");
    setFormVideoUrl("");
    setFormDuration("");
    setFormDifficulty("EASY");
    setFormBodyPart("");
    setFormInstructions("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle) return;
    setSubmitting(true);
    try {
      await api.post("/exercise-library", {
        title: formTitle,
        description: formDescription || undefined,
        category: formCategory,
        videoUrl: formVideoUrl || undefined,
        duration: formDuration ? Number(formDuration) : undefined,
        difficulty: formDifficulty,
        bodyPart: formBodyPart || undefined,
        instructions: formInstructions || undefined,
      });
      toast("success", "Cvičení bylo přidáno.");
      resetForm();
      setShowForm(false);
      mutate();
    } catch {
      toast("error", "Chyba při přidávání cvičení.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (exerciseId: number) => {
    if (!assignClientId) {
      toast("error", "Vyberte klienta.");
      return;
    }
    try {
      await api.post(`/exercises/${exerciseId}/assign`, { clientId: Number(assignClientId) });
      toast("success", "Cvičení přiřazeno klientovi.");
      setAssignClientId("");
    } catch {
      toast("error", "Chyba při přiřazování cvičení.");
    }
  };

  const filtered = exercises?.filter((ex: any) => {
    if (activeCategory !== "ALL" && ex.category !== activeCategory) return false;
    if (activeDifficulty !== "ALL" && ex.difficulty !== activeDifficulty) return false;
    return true;
  });

  // Detail view
  if (selectedExercise) {
    const embedUrl = getYoutubeEmbedUrl(selectedExercise.videoUrl ?? "");
    return (
      <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
        <Layout>
          <div className="max-w-4xl mx-auto space-y-6">
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <motion.button
                onClick={() => setSelectedExercise(null)}
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 min-h-[44px] mb-4"
                whileTap={shouldReduce ? undefined : { scale: 0.95 }}
              >
                <ArrowLeft size={16} />
                Zpět na seznam
              </motion.button>

              <div className="flex items-center gap-3 mb-2">
                <Dumbbell size={24} className="text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedExercise.title}</h1>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedExercise.category && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                    {CATEGORY_LABEL[selectedExercise.category] ?? selectedExercise.category}
                  </span>
                )}
                {selectedExercise.difficulty && (
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_BADGE[selectedExercise.difficulty] ?? ""}`}>
                    {DIFFICULTY_LABEL[selectedExercise.difficulty] ?? selectedExercise.difficulty}
                  </span>
                )}
                {selectedExercise.duration && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{selectedExercise.duration} min</span>
                )}
                {selectedExercise.bodyPart && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{selectedExercise.bodyPart}</span>
                )}
              </div>
            </motion.div>

            {/* Video embed */}
            {embedUrl && (
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                className="card overflow-hidden p-0"
              >
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    src={embedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={selectedExercise.title}
                  />
                </div>
              </motion.div>
            )}

            {/* Description & instructions */}
            {(selectedExercise.description || selectedExercise.instructions) && (
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
                className="card space-y-4"
              >
                {selectedExercise.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Popis</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{selectedExercise.description}</p>
                  </div>
                )}
                {selectedExercise.instructions && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Instrukce</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{selectedExercise.instructions}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Assign to client */}
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
              className="card"
            >
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Přiřadit klientovi</h3>
              <div className="flex gap-3">
                <select
                  value={assignClientId}
                  onChange={(e) => setAssignClientId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px] text-sm"
                >
                  <option value="">Vyberte klienta...</option>
                  {(clients ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <motion.button
                  onClick={() => handleAssign(selectedExercise.id)}
                  disabled={!assignClientId}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors min-h-[44px] text-sm font-medium"
                  whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                >
                  <Send size={14} />
                  Přiřadit
                </motion.button>
              </div>
            </motion.div>
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Dumbbell size={24} className="text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Knihovna cvičení</h1>
            </div>
            <motion.button
              onClick={() => { showForm ? setShowForm(false) : setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors min-h-[44px] text-sm font-medium"
              whileTap={shouldReduce ? undefined : { scale: 0.95 }}
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Zavřít" : "Přidat cvičení"}
            </motion.button>
          </motion.div>

          {/* Create form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                key="exercise-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card"
              >
                <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Přidat cvičení</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Název *
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kategorie
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                      >
                        {CATEGORIES.filter((c) => c.value !== "ALL").map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Popis
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Video URL
                      </label>
                      <input
                        type="url"
                        value={formVideoUrl}
                        onChange={(e) => setFormVideoUrl(e.target.value)}
                        placeholder="https://youtube.com/..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Délka (min)
                      </label>
                      <input
                        type="number"
                        value={formDuration}
                        onChange={(e) => setFormDuration(e.target.value)}
                        min={1}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Obtížnost
                      </label>
                      <select
                        value={formDifficulty}
                        onChange={(e) => setFormDifficulty(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                      >
                        {DIFFICULTIES.filter((d) => d.value !== "ALL").map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tělesná partie
                    </label>
                    <input
                      type="text"
                      value={formBodyPart}
                      onChange={(e) => setFormBodyPart(e.target.value)}
                      placeholder="např. záda, ramena, kyčle"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Instrukce
                    </label>
                    <textarea
                      value={formInstructions}
                      onChange={(e) => setFormInstructions(e.target.value)}
                      rows={4}
                      placeholder={"1. Stoupněte si rovně...\n2. Pomalu předkloňte...\n3. Držte 30 sekund..."}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={submitting || !formTitle}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors min-h-[44px] text-sm font-medium"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    {submitting ? "Ukládám..." : "Přidat cvičení"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category tabs */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
            className="space-y-3"
          >
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <motion.button
                  key={cat.value}
                  onClick={() => { haptics.light(); setActiveCategory(cat.value); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap min-h-[36px] transition-colors ${
                    activeCategory === cat.value
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                >
                  {cat.label}
                </motion.button>
              ))}
            </div>

            {/* Difficulty filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DIFFICULTIES.map((diff) => (
                <motion.button
                  key={diff.value}
                  onClick={() => { haptics.light(); setActiveDifficulty(diff.value); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[32px] transition-colors ${
                    activeDifficulty === diff.value
                      ? "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                >
                  {diff.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Exercise list */}
          <AnimatePresence mode="wait">
            {!exercises ? (
              <motion.p
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Načítám cvičení...
              </motion.p>
            ) : !filtered || filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card text-center py-8"
              >
                <Dumbbell size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Žádná cvičení v této kategorii</p>
              </motion.div>
            ) : (
              <motion.div
                key={`exercise-list-${activeCategory}-${activeDifficulty}`}
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {filtered.map((ex: any, i: number) => (
                  <motion.div
                    key={ex.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className="card cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { haptics.light(); setSelectedExercise(ex); }}
                  >
                    {/* Thumbnail */}
                    {ex.thumbnailUrl ? (
                      <div className="w-full aspect-video rounded-lg overflow-hidden mb-3 bg-gray-100 dark:bg-gray-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ex.thumbnailUrl}
                          alt={ex.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : ex.videoUrl ? (
                      <div className="w-full aspect-video rounded-lg overflow-hidden mb-3 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <Play size={32} className="text-gray-400 dark:text-gray-600" />
                      </div>
                    ) : null}

                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{ex.title}</h3>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {ex.category && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                          {CATEGORY_LABEL[ex.category] ?? ex.category}
                        </span>
                      )}
                      {ex.difficulty && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_BADGE[ex.difficulty] ?? ""}`}>
                          {DIFFICULTY_LABEL[ex.difficulty] ?? ex.difficulty}
                        </span>
                      )}
                      {ex.duration && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{ex.duration} min</span>
                      )}
                      {ex.bodyPart && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{ex.bodyPart}</span>
                      )}
                    </div>
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
