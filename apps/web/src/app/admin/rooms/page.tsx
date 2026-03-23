"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Edit2, Check, X } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

type Room = {
  id: number;
  name: string;
  description: string | null;
  capacity: number;
  isActive: boolean;
};

export default function AdminRooms() {
  const shouldReduce = useReducedMotion();
  const { data: rooms, mutate } = useSWR<Room[]>("/rooms", fetcher as any);
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", capacity: "1" });
  const [editForm, setEditForm] = useState({ name: "", description: "", capacity: "1" });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/rooms", {
        name: form.name,
        description: form.description || undefined,
        capacity: parseInt(form.capacity),
      });
      setShowNew(false);
      setForm({ name: "", description: "", capacity: "1" });
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (room: Room) => {
    setEditId(room.id);
    setEditForm({
      name: room.name,
      description: room.description ?? "",
      capacity: String(room.capacity),
    });
  };

  const handleUpdate = async (id: number) => {
    await api.patch(`/rooms/${id}`, {
      name: editForm.name,
      description: editForm.description || undefined,
      capacity: parseInt(editForm.capacity),
    });
    setEditId(null);
    mutate();
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    if (!isActive && !confirm("Deaktivovat místnost? Nebude dostupná pro nové termíny.")) return;
    await api.patch(`/rooms/${id}`, { isActive });
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Místnosti</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {rooms?.filter((r) => r.isActive).length ?? 0} aktivních místností
              </p>
            </div>
            <motion.button
              onClick={() => setShowNew(true)}
              className="btn-primary flex items-center gap-2"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <Plus size={16} /> Přidat místnost
            </motion.button>
          </motion.div>

          <AnimatePresence>
            {showNew && (
              <motion.div
                key="new-room-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="card mb-6 border border-primary-200 dark:border-primary-800"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Nová místnost</h2>
                <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Název</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="input"
                      placeholder="Místnost 1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kapacita</label>
                    <input
                      type="number"
                      min="1"
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Popis</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="input"
                      placeholder="Volitelný popis"
                    />
                  </div>
                  <div className="col-span-2 flex gap-3 justify-end">
                    <motion.button
                      type="button"
                      onClick={() => setShowNew(false)}
                      className="btn-secondary"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      Zrušit
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={saving}
                      className="btn-primary"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      {saving ? "Ukládám…" : "Přidat"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {(rooms ?? []).map((room, i) => (
              <motion.div
                key={room.id}
                initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                className={`card ${!room.isActive ? "opacity-60" : ""}`}
              >
                <AnimatePresence mode="wait">
                  {editId === room.id ? (
                    <motion.div
                      key="edit"
                      initial={shouldReduce ? {} : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Název</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Kapacita</label>
                        <input
                          type="number"
                          min="1"
                          value={editForm.capacity}
                          onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                          className="input"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Popis</label>
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="input"
                        />
                      </div>
                      <div className="col-span-2 flex gap-2 justify-end">
                        <motion.button
                          onClick={() => setEditId(null)}
                          className="btn-secondary flex items-center gap-1 text-sm"
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        >
                          <X size={14} /> Zrušit
                        </motion.button>
                        <motion.button
                          onClick={() => handleUpdate(room.id)}
                          className="btn-primary flex items-center gap-1 text-sm"
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        >
                          <Check size={14} /> Uložit
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view"
                      initial={shouldReduce ? {} : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{room.name}</p>
                          <span className={`badge ${room.isActive ? "badge-green" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>
                            {room.isActive ? "Aktivní" : "Neaktivní"}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">kapacita: {room.capacity}</span>
                        </div>
                        {room.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{room.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          onClick={() => startEdit(room)}
                          className="btn-secondary text-xs py-1 flex items-center gap-1"
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        >
                          <Edit2 size={12} /> Upravit
                        </motion.button>
                        <motion.button
                          onClick={() => handleToggle(room.id, !room.isActive)}
                          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                            room.isActive
                              ? "border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              : "border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                          }`}
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        >
                          {room.isActive ? "Deaktivovat" : "Aktivovat"}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
