"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { Search, ChevronRight, Mail, CheckSquare, Square, Download, X, Plus, Calendar, StickyNote } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";
import { SkeletonClientCard } from "@/components/Skeleton";
import { haptics } from "@/lib/haptics";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

const fetcher = (url: string) => api.get<any[]>(url);

// ── localStorage helpers ─────────────────────────────────────────────────────

const PRESET_TAGS = ["VIP", "Nový", "Problematický", "Preferuje ráno", "Bez pojišťovny", "Párová terapie"];

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  Nový: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  Problematický: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  "Preferuje ráno": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  "Bez pojišťovny": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  "Párová terapie": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
};
const DEFAULT_TAG_COLOR = "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

function getTags(clientId: number): string[] {
  try {
    const raw = localStorage.getItem(`client_tags_${clientId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveTags(clientId: number, tags: string[]) {
  localStorage.setItem(`client_tags_${clientId}`, JSON.stringify(tags));
}

function getNextContact(clientId: number): string {
  return localStorage.getItem(`client_next_contact_${clientId}`) ?? "";
}
function saveNextContact(clientId: number, date: string) {
  if (date) localStorage.setItem(`client_next_contact_${clientId}`, date);
  else localStorage.removeItem(`client_next_contact_${clientId}`);
}

function getNotes(clientId: number): string {
  return localStorage.getItem(`client_notes_${clientId}`) ?? "";
}
function saveNotes(clientId: number, notes: string) {
  if (notes) localStorage.setItem(`client_notes_${clientId}`, notes);
  else localStorage.removeItem(`client_notes_${clientId}`);
}

// ── Tag chip component ────────────────────────────────────────────────────────

function ClientTags({ clientId }: { clientId: number }) {
  const [tags, setTags] = useState<string[]>(() => getTags(clientId));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function addTag(tag: string) {
    if (tags.includes(tag)) return;
    const next = [...tags, tag];
    setTags(next);
    saveTags(clientId, next);
  }

  function removeTag(tag: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    saveTags(clientId, next);
  }

  const available = PRESET_TAGS.filter((t) => !tags.includes(t));

  return (
    <div className="relative flex items-center flex-wrap gap-1" ref={ref} onClick={(e) => e.preventDefault()}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR}`}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => removeTag(tag, e)}
            className="ml-0.5 hover:opacity-70"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
        title="Přidat tag"
      >
        <Plus size={10} />
      </button>

      {open && available.length > 0 && (
        <div className="absolute top-7 left-0 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 min-w-[180px]">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-1">Přidat tag:</p>
          {available.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addTag(tag); setOpen(false); }}
              className={`block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 ${TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR} mb-0.5`}
            >
              {tag}
            </button>
          ))}
          {available.length === 0 && (
            <p className="text-xs text-gray-400 px-1">Všechny tagy přidány</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Next-contact date popover ─────────────────────────────────────────────────

function NextContactDate({ clientId }: { clientId: number }) {
  const [date, setDate] = useState<string>(() => getNextContact(clientId));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function handleChange(val: string) {
    setDate(val);
    saveNextContact(clientId, val);
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => e.preventDefault()}>
      <button
        type="button"
        title={date ? `Příští kontakt: ${date}` : "Nastavit datum příštího kontaktu"}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors ${
          date
            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
            : "text-gray-400 hover:text-blue-500"
        }`}
      >
        <Calendar size={12} />
        {date && <span className="hidden sm:inline">{date}</span>}
      </button>

      {open && (
        <div className="absolute top-8 right-0 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Příští kontakt:</p>
          <input
            type="date"
            value={date}
            onChange={(e) => handleChange(e.target.value)}
            className="input text-sm w-full mb-2"
          />
          {date && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleChange(""); setOpen(false); }}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Smazat datum
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quick notes popover ───────────────────────────────────────────────────────

function QuickNotes({ clientId }: { clientId: number }) {
  const [notes, setNotes] = useState<string>(() => getNotes(clientId));
  const [draft, setDraft] = useState<string>("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setDraft(notes);
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    saveNotes(clientId, draft);
    setNotes(draft);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => e.preventDefault()}>
      <button
        type="button"
        title={notes ? `Poznámka: ${notes.slice(0, 60)}…` : "Přidat poznámku"}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors ${
          notes
            ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
            : "text-gray-400 hover:text-amber-500"
        }`}
      >
        <StickyNote size={12} />
      </button>

      {open && (
        <div className="absolute top-8 right-0 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-64">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Rychlá poznámka:</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="input text-sm w-full resize-none"
            placeholder="Zadejte poznámku…"
          />
          <div className="flex justify-between mt-2">
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary text-xs py-1 px-3"
            >
              Uložit
            </button>
            {notes && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDraft(""); saveNotes(clientId, ""); setNotes(""); setOpen(false); }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Smazat
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReceptionClients() {
  const shouldReduce = useReducedMotion();
  const { data: clients } = useSWR("/clients", fetcher);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const filtered = (clients ?? []).filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every((c: any) => selected.has(c.id));

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c: any) => c.id)));
    }
  };

  const handleBulkSend = async () => {
    if (!bulkMessage || selected.size === 0) return;
    setBulkSending(true);
    setBulkResult(null);
    try {
      const result = await api.post<{ sent: number }>("/notifications/bulk", {
        userIds: Array.from(selected),
        type: "GENERAL",
        title: bulkSubject || "Zpráva od recepce",
        message: bulkMessage,
      });
      haptics.success();
      setBulkResult(`✓ Odesláno ${result.sent} in-app notifikací`);
      setBulkMessage("");
      setBulkSubject("");
      setSelected(new Set());
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Klienti</h1>
            <div className="flex items-center gap-2">
              <a
                href={`${API_BASE}/users/export/csv?role=CLIENT`}
                download
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Exportovat klienty do CSV"
              >
                <Download size={14} /> CSV
              </a>
            </div>
            <AnimatePresence>
              {selected.size > 0 && (
                <motion.div
                  key="bulk-actions"
                  initial={shouldReduce ? false : { opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400">{selected.size} vybráno</span>
                  <motion.button
                    onClick={() => { haptics.light(); setShowBulk(true); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Mail size={14} /> Hromadná zpráva
                  </motion.button>
                  <motion.button
                    onClick={() => { haptics.light(); setSelected(new Set()); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Zrušit výběr
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bulk message form */}
          <AnimatePresence initial={false}>
            {showBulk && selected.size > 0 && (
              <motion.div
                key="bulk-form"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.97, y: -14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -10 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 border border-primary-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    Hromadná zpráva ({selected.size} klientů)
                  </h2>
                  <motion.button
                    type="button"
                    onClick={() => { haptics.light(); setShowBulk(false); setBulkResult(null); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={18} />
                  </motion.button>
                </div>
                <AnimatePresence>
                  {bulkResult && (
                    <motion.div
                      key="bulk-result"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 26 }}
                      className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-3"
                    >
                      {bulkResult}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Předmět / název zprávy"
                    value={bulkSubject}
                    onChange={(e) => setBulkSubject(e.target.value)}
                    className="input"
                  />
                  <textarea
                    placeholder="Text zprávy…"
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    className="input min-h-[80px]"
                    required
                  />
                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => handleBulkSend()}
                      disabled={!bulkMessage || bulkSending}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                      <Mail size={14} /> {bulkSending ? "Odesílám…" : "Odeslat notifikaci"}
                    </motion.button>
                    <motion.button
                      onClick={() => { haptics.light(); setShowBulk(false); setBulkResult(null); }}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary"
                    >
                      Zrušit
                    </motion.button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    * Zpráva bude doručena jako in-app notifikace. Email/SMS vyžaduje SMTP/FAYN konfiguraci.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            <input
              type="search"
              placeholder="Hledat klienty…"
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Select all */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <motion.button
                onClick={() => { haptics.light(); toggleAll(); }}
                whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </motion.button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {allSelected ? "Zrušit výběr všech" : "Vybrat vše"} ({filtered.length})
              </span>
            </div>
          )}

          {!clients && (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <SkeletonClientCard key={i} />)}
            </div>
          )}

          <div
            className="space-y-2"
          >
            {filtered.map((c: any, i: number) => (
              <motion.div
                key={c.id}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                layout
                className={`card flex items-start gap-3 hover:shadow-md transition-shadow ${selected.has(c.id) ? "border-primary-200 bg-primary-50" : ""}`}
              >
                <motion.button
                  onClick={() => { haptics.light(); toggleSelect(c.id); }}
                  whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="text-gray-500 dark:text-gray-400 hover:text-primary flex-shrink-0 mt-1"
                >
                  {selected.has(c.id) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                </motion.button>

                <div className="flex flex-col flex-1 min-w-0 gap-1.5">
                  {/* Top row: avatar + name/email + scores + chevron */}
                  <div className="flex items-center gap-3">
                    <Link href={`/reception/clients/${c.id}`} className="flex items-center justify-between flex-1 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-sm font-bold">
                            {c.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Skóre dochvilnosti</p>
                          <p className={`text-sm font-bold ${(c.behaviorScore ?? 100) >= 80 ? "text-green-600" : (c.behaviorScore ?? 100) >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {(c.behaviorScore ?? 100).toFixed(0)}/100
                          </p>
                        </div>
                        <span className={`badge ${c.isActive ? "badge-green" : "bg-red-100 text-red-600"}`}>
                          {c.isActive ? "Aktivní" : "Neaktivní"}
                        </span>
                        <ChevronRight size={16} className="text-gray-500 dark:text-gray-400" />
                      </div>
                    </Link>
                  </div>

                  {/* CRM row: tags + next-contact + notes */}
                  <div className="flex items-center gap-2 flex-wrap pl-12">
                    <ClientTags clientId={c.id} />
                    <div className="flex items-center gap-1 ml-auto">
                      <NextContactDate clientId={c.id} />
                      <QuickNotes clientId={c.id} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <EmptyState title="Žádní klienti" description="Žádný klient neodpovídá hledání" />
            )}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
