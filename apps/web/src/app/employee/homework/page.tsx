"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useRef } from "react";
import { BookOpen, Plus, Trash2, X, Image as ImageIcon, Film } from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any[]>(url);

interface Exercise {
  name: string;
  sets?: string;
  reps?: string;
  duration?: string;
  notes?: string;
}

export default function EmployeeHomework() {
  const { data: homework, mutate } = useSWR("/homework", fetcher);
  const { data: clients } = useSWR("/employees/me/clients", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([{ name: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<{ name: string; dataUrl: string }[]>([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addExercise = () => setExercises([...exercises, { name: "" }]);
  const removeExercise = (i: number) => setExercises(exercises.filter((_, idx) => idx !== i));
  const updateExercise = (i: number, field: keyof Exercise, value: string) => {
    const copy = [...exercises];
    copy[i] = { ...copy[i], [field]: value };
    setExercises(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !title) return;
    setSubmitting(true);
    try {
      const created = await api.post<{ id: number }>("/homework", {
        clientId: parseInt(clientId),
        title,
        description: description || undefined,
        exercises: exercises.filter((ex) => ex.name.trim()),
        videoUrl: videoUrl || undefined,
        dueDate: dueDate || undefined,
      });

      // Upload media files if any
      for (const mf of mediaFiles) {
        try {
          await api.post(`/homework/${created.id}/media`, {
            file: mf.dataUrl,
            filename: mf.name,
          });
        } catch {
          toast("warning", `Nepodařilo se nahrát soubor: ${mf.name}`);
        }
      }

      setShowForm(false);
      setClientId("");
      setTitle("");
      setDescription("");
      setVideoUrl("");
      setDueDate("");
      setExercises([{ name: "" }]);
      setMediaFiles([]);
      toast("success", "Cvičení bylo přiřazeno.");
      mutate();
    } catch {
      toast("error", "Chyba při ukládání cvičení.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Smazat toto cvičení?")) return;
    try {
      await api.delete(`/homework/${id}`);
      toast("success", "Cvičení bylo smazáno.");
      mutate();
    } catch {
      toast("error", "Chyba při mazání cvičení.");
    }
  };

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={24} className="text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Domácí cvičení</h1>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary flex items-center gap-2 min-h-[44px]"
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Zrušit" : "Zadat cvičení"}
            </button>
          </div>

          {/* Assignment form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="card space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Nové domácí cvičení</h2>

              <div>
                <label className="label">Klient</label>
                <select
                  className="input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                >
                  <option value="">Vyberte klienta…</option>
                  {(clients ?? []).map((c: any) => (
                    <option key={c.id ?? c.clientId} value={c.id ?? c.clientId}>
                      {c.name ?? c.clientName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Název</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="např. Ranní protažení"
                  required
                />
              </div>

              <div>
                <label className="label">Popis (nepovinný)</label>
                <textarea
                  className="input min-h-[60px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instrukce pro klienta…"
                />
              </div>

              {/* Exercises */}
              <div>
                <label className="label">Cviky</label>
                <div className="space-y-2">
                  {exercises.map((ex, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-primary-600">{i + 1}.</span>
                        <input
                          className="input flex-1 !py-1.5"
                          value={ex.name}
                          onChange={(e) => updateExercise(i, "name", e.target.value)}
                          placeholder="Název cviku"
                        />
                        {exercises.length > 1 && (
                          <button type="button" onClick={() => removeExercise(i)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          className="input !py-1 text-xs"
                          value={ex.sets || ""}
                          onChange={(e) => updateExercise(i, "sets", e.target.value)}
                          placeholder="Série"
                        />
                        <input
                          className="input !py-1 text-xs"
                          value={ex.reps || ""}
                          onChange={(e) => updateExercise(i, "reps", e.target.value)}
                          placeholder="Opakování"
                        />
                        <input
                          className="input !py-1 text-xs"
                          value={ex.duration || ""}
                          onChange={(e) => updateExercise(i, "duration", e.target.value)}
                          placeholder="Trvání"
                        />
                      </div>
                      <input
                        className="input !py-1 text-xs mt-2"
                        value={ex.notes || ""}
                        onChange={(e) => updateExercise(i, "notes", e.target.value)}
                        placeholder="Poznámka ke cviku"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addExercise}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-2 flex items-center gap-1"
                >
                  <Plus size={12} /> Přidat cvik
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Video URL (nepovinné)</label>
                  <input
                    className="input"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/..."
                  />
                </div>
                <div>
                  <label className="label">Splnit do (nepovinné)</label>
                  <input
                    type="date"
                    className="input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Media upload */}
              <div>
                <label className="label">Fotky / videa (nepovinné)</label>
                <div className="mt-1">
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      files.forEach((file) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (ev.target?.result) {
                            setMediaFiles((prev) => [
                              ...prev,
                              { name: file.name, dataUrl: ev.target!.result as string },
                            ]);
                          }
                        };
                        reader.readAsDataURL(file);
                      });
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 border border-dashed border-primary-300 dark:border-primary-700 rounded-lg px-4 py-3 w-full hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    <ImageIcon size={16} />
                    <Film size={16} />
                    Nahrát fotku nebo video
                  </button>
                  {mediaFiles.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {mediaFiles.map((mf, idx) => (
                        <div key={idx} className="relative group">
                          {mf.dataUrl.startsWith("data:video") ? (
                            <video src={mf.dataUrl} className="w-full aspect-square object-cover rounded-lg" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mf.dataUrl} alt={mf.name} className="w-full aspect-square object-cover rounded-lg" />
                          )}
                          <button
                            type="button"
                            onClick={() => setMediaFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">{mf.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? "Ukládám…" : "Přiřadit klientovi"}
              </button>
            </form>
          )}

          {/* Homework list */}
          {(!homework || homework.length === 0) ? (
            <div className="card text-center py-8">
              <p className="text-gray-500">Zatím žádná přiřazená cvičení</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(homework ?? []).map((hw: any) => (
                <div key={hw.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{hw.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {hw.client_name} · {new Date(hw.created_at).toLocaleDateString("cs-CZ")}
                      </p>
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${
                        hw.status === "COMPLETED"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      }`}>
                        {hw.status === "COMPLETED" ? "Dokončeno" : "Aktivní"}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(hw.id)}
                      className="text-gray-500 hover:text-red-500 p-1"
                      title="Smazat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Media preview */}
                  {hw.media_urls && (() => {
                    let mediaItems: string[] = [];
                    try { mediaItems = JSON.parse(hw.media_urls); } catch { mediaItems = []; }
                    if (mediaItems.length === 0) return null;
                    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                    return (
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {mediaItems.map((url, idx) => {
                          const isVideo = url.match(/\.(mp4|webm|mov)$/i);
                          const fullUrl = url.startsWith("http") ? url : `${apiBase}${url}`;
                          if (isVideo) {
                            return <video key={idx} src={fullUrl} controls className="h-16 w-16 object-cover rounded flex-shrink-0" preload="metadata" />;
                          }
                          return (
                            <a key={idx} href={fullUrl} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={fullUrl} alt={`Media ${idx + 1}`} className="h-16 w-16 object-cover rounded flex-shrink-0 hover:opacity-80" />
                            </a>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
