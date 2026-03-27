"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { ClipboardList, Plus, Edit2, Trash2, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const QUESTION_TYPES = [
  { value: "scale0-3", label: "Škála 0–3" },
  { value: "scale0-10", label: "Škála 0–10" },
  { value: "scale1-5", label: "Škála 1–5" },
  { value: "options", label: "Výběr možností (s hodnotami)" },
  { value: "text", label: "Volný text" },
  { value: "yesno", label: "Ano / Ne" },
];

function QuestionEditor({ question, onChange, onDelete }: { question: any; onChange: (q: any) => void; onDelete: () => void }) {
  const shouldReduce = useReducedMotion();
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold text-gray-500 mt-2">#{question.id}</span>
        <input
          className="input flex-1"
          placeholder="Text otázky"
          value={question.text}
          onChange={e => onChange({ ...question, text: e.target.value })}
        />
        <motion.button
          onClick={onDelete}
          className="p-2 text-red-400 hover:text-red-600"
          whileTap={shouldReduce ? undefined : { scale: 0.92 }}
        >
          <Trash2 size={16} />
        </motion.button>
      </div>
      <select
        className="input w-full"
        value={question.type}
        onChange={e => onChange({ ...question, type: e.target.value })}
      >
        {QUESTION_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      {(question.type === "options" || question.type === "scale0-3" || question.type === "scale1-5") && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Možnosti (každá na řádku):</p>
          <textarea
            className="input w-full text-sm"
            rows={3}
            placeholder="Vůbec ne&#10;Několik dní&#10;Téměř každý den"
            value={(question.options || []).join("\n")}
            onChange={e => onChange({ ...question, options: e.target.value.split("\n") })}
          />
        </div>
      )}
    </div>
  );
}

function TemplateModal({ template, onClose, onSaved }: { template?: any; onClose: () => void; onSaved: () => void }) {
  const shouldReduce = useReducedMotion();
  const isNew = !template;
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [questions, setQuestions] = useState<any[]>(template?.questions || [
    { id: 1, text: "", type: "scale0-3", options: [] },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addQuestion = () => {
    const nextId = questions.length > 0 ? Math.max(...questions.map((q: any) => q.id)) + 1 : 1;
    setQuestions([...questions, { id: nextId, text: "", type: "scale0-3", options: [] }]);
  };

  const updateQuestion = (idx: number, q: any) => {
    const updated = [...questions];
    updated[idx] = q;
    setQuestions(updated);
  };

  const deleteQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Název je povinný"); return; }
    if (questions.length === 0) { setError("Alespoň jedna otázka je povinná"); return; }
    setSaving(true);
    setError("");
    try {
      const body = { name, description, questions, scoringRules: template?.scoringRules || { method: "sum", thresholds: [] } };
      if (isNew) {
        await api.post("/questionnaire-templates", body);
      } else {
        await api.put(`/questionnaire-templates/${template.id}`, body);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={shouldReduce ? {} : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduce ? {} : { opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isNew ? "Nový dotazník" : "Upravit dotazník"}
          </h2>
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="space-y-3">
            <input className="input w-full" placeholder="Název dotazníku" value={name} onChange={e => setName(e.target.value)} />
            <textarea className="input w-full text-sm" rows={2} placeholder="Popis (volitelný)" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Otázky</h3>
              <motion.button
                onClick={addQuestion}
                className="btn-outline text-xs flex items-center gap-1 py-1 px-2"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                <Plus size={12} /> Přidat otázku
              </motion.button>
            </div>
            <AnimatePresence>
              {questions.map((q: any, idx: number) => (
                <motion.div
                  key={q.id}
                  initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                >
                  <QuestionEditor
                    question={q}
                    onChange={(updated) => updateQuestion(idx, updated)}
                    onDelete={() => deleteQuestion(idx)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="flex gap-3 pt-2">
            <motion.button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              {saving ? "Ukládám…" : "Uložit"}
            </motion.button>
            <motion.button
              onClick={onClose}
              className="btn-outline flex-1"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              Zrušit
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminQuestionnaires() {
  const shouldReduce = useReducedMotion();
  const { data: templates, mutate } = useSWR<any[]>("/questionnaire-templates", fetcher);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm("Opravdu smazat dotazník?")) return;
    await api.delete(`/questionnaire-templates/${id}`);
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-3">
              <ClipboardList size={24} className="text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dotazníky</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Správa šablon dotazníků</p>
              </div>
            </div>
            <motion.button
              onClick={() => { setEditTemplate(null); setShowModal(true); }}
              className="btn-primary flex items-center gap-2"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <Plus size={16} /> Nový dotazník
            </motion.button>
          </motion.div>

          {!templates ? (
            <motion.p
              initial={shouldReduce ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-500 dark:text-gray-400 text-center py-8"
            >
              Načítám…
            </motion.p>
          ) : templates.length === 0 ? (
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="card text-center py-12"
            >
              <ClipboardList size={40} className="text-gray-300 dark:text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Žádné dotazníky</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {templates.map((t: any, i: number) => (
                <motion.div
                  key={t.id}
                  initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                  className="card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t.name}</h3>
                        <span className="badge badge-blue text-xs">{t.questions?.length || 0} otázek</span>
                      </div>
                      {t.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        title="Zobrazit otázky"
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                      >
                        {expanded === t.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </motion.button>
                      <motion.button
                        onClick={() => { setEditTemplate(t); setShowModal(true); }}
                        className="p-1.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                        title="Upravit"
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                      >
                        <Edit2 size={16} />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        title="Smazat"
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                      >
                        <Trash2 size={16} />
                      </motion.button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expanded === t.id && t.questions && (
                      <motion.div
                        key={`questions-${t.id}`}
                        initial={shouldReduce ? {} : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={shouldReduce ? {} : { opacity: 0, height: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 border-t dark:border-gray-700 pt-4 space-y-2">
                          {t.questions.map((q: any, idx: number) => (
                            <motion.div
                              key={idx}
                              initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: idx * 0.03 }}
                              className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                            >
                              <HelpCircle size={14} className="text-primary-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm text-gray-800 dark:text-gray-200">{q.text}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Typ: {QUESTION_TYPES.find(t => t.value === q.type)?.label || q.type}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showModal && (
            <TemplateModal
              key="template-modal"
              template={editTemplate}
              onClose={() => setShowModal(false)}
              onSaved={() => mutate()}
            />
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
