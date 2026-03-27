"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { FileText, Plus, X, Edit2 } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

const CATEGORIES = [
  { value: "ALL", label: "Všechny" },
  { value: "ANAMNESIS", label: "Anamnéza" },
  { value: "PROGRESS", label: "Pokrok" },
  { value: "CONCLUSION", label: "Závěr" },
  { value: "INTAKE", label: "Vstupní" },
  { value: "DISCHARGE", label: "Propouštěcí" },
];

const CATEGORY_BADGE: Record<string, string> = {
  ANAMNESIS: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  PROGRESS: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  CONCLUSION: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  INTAKE: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  DISCHARGE: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

const CATEGORY_LABEL: Record<string, string> = {
  ANAMNESIS: "Anamnéza",
  PROGRESS: "Pokrok",
  CONCLUSION: "Závěr",
  INTAKE: "Vstupní",
  DISCHARGE: "Propouštěcí",
};

export default function EmployeeSessionTemplates() {
  const shouldReduce = useReducedMotion();
  const { data: templates, mutate } = useSWR("/session-templates", fetcher);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ANAMNESIS");
  const [content, setContent] = useState("");

  const resetForm = () => {
    setTitle("");
    setCategory("ANAMNESIS");
    setContent("");
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (template: any) => {
    haptics.light();
    setTitle(template.title);
    setCategory(template.category);
    setContent(template.content);
    setEditingId(template.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await api.patch(`/session-templates/${editingId}`, { title, category, content });
        toast("success", "Šablona byla upravena.");
      } else {
        await api.post("/session-templates", { title, category, content });
        toast("success", "Šablona byla vytvořena.");
      }
      resetForm();
      setShowForm(false);
      mutate();
    } catch {
      toast("error", editingId ? "Chyba při úpravě šablony." : "Chyba při vytváření šablony.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = templates?.filter(
    (t: any) => activeTab === "ALL" || t.category === activeTab
  );

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
              <FileText size={24} className="text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Šablony poznámek</h1>
            </div>
            <motion.button
              onClick={() => { showForm ? setShowForm(false) : openCreate(); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors min-h-[44px] text-sm font-medium"
              whileTap={shouldReduce ? undefined : { scale: 0.95 }}
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Zavřít" : "Nová šablona"}
            </motion.button>
          </motion.div>

          {/* Create/edit form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                key="template-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card"
              >
                <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  {editingId ? "Upravit šablonu" : "Nová šablona"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Název *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Vstupní vyšetření - fyzioterapie"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kategorie
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
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
                      Obsah šablony *
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={8}
                      placeholder={"Klient: {{client_name}}\nDatum: {{date}}\n\nAnamnéza:\n...\n\nDoporučení:\n..."}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {"Proměnné: {{client_name}}, {{date}}, {{employee_name}}, {{service_name}}"}
                    </p>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={submitting || !title || !content}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors min-h-[44px] text-sm font-medium"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    {submitting ? "Ukládám..." : editingId ? "Uložit změny" : "Vytvořit šablonu"}
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
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat.value}
                onClick={() => { haptics.light(); setActiveTab(cat.value); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap min-h-[36px] transition-colors ${
                  activeTab === cat.value
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                whileTap={shouldReduce ? undefined : { scale: 0.95 }}
              >
                {cat.label}
              </motion.button>
            ))}
          </motion.div>

          {/* Template list */}
          <AnimatePresence mode="wait">
            {!templates ? (
              <motion.p
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Načítám šablony...
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
                <FileText size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {activeTab === "ALL" ? "Zatím nebyly vytvořeny žádné šablony" : "Žádné šablony v této kategorii"}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`template-list-${activeTab}`}
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {filtered.map((tpl: any, i: number) => (
                  <motion.div
                    key={tpl.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className="card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{tpl.title}</h3>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE[tpl.category] ?? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
                            {CATEGORY_LABEL[tpl.category] ?? tpl.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-3 whitespace-pre-line">
                          {tpl.content}
                        </p>
                      </div>
                      <motion.button
                        onClick={() => openEdit(tpl)}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
                        whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                      >
                        <Edit2 size={16} />
                      </motion.button>
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
