"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { CalendarDays, Plus, Pencil, X, BedDouble, Users, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Koncept",
  PUBLISHED: "Zveřejněno",
  FULL: "Obsazeno",
  CANCELLED: "Zrušeno",
  COMPLETED: "Dokončeno",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  FULL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  pricePerPerson: "",
  maxParticipants: "10",
  includesAccommodation: false,
  accommodationDetails: "",
  mealPlan: "",
  programDetails: "",
  status: "DRAFT",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);
}

export default function AdminIntensiveBlocksPage() {
  const { data: blocks, mutate, isLoading } = useSWR("/intensive-blocks", fetcher);
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (block: any) => {
    setEditId(block.id);
    setForm({
      title: block.title,
      description: block.description ?? "",
      startDate: block.start_date,
      endDate: block.end_date,
      pricePerPerson: String(block.price_per_person),
      maxParticipants: String(block.max_participants),
      includesAccommodation: !!block.includes_accommodation,
      accommodationDetails: block.accommodation_details ?? "",
      mealPlan: block.meal_plan ?? "",
      programDetails: block.program_details ?? "",
      status: block.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.startDate || !form.endDate || !form.pricePerPerson) {
      toast("error", "Vyplňte název, termín a cenu.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        startDate: form.startDate,
        endDate: form.endDate,
        pricePerPerson: parseFloat(form.pricePerPerson),
        maxParticipants: parseInt(form.maxParticipants),
        includesAccommodation: form.includesAccommodation,
        accommodationDetails: form.accommodationDetails || null,
        mealPlan: form.mealPlan || null,
        programDetails: form.programDetails || null,
        status: form.status,
      };

      if (editId) {
        await api.patch(`/intensive-blocks/${editId}`, payload);
        toast("success", "Blok byl aktualizován.");
      } else {
        await api.post("/intensive-blocks", payload);
        toast("success", "Blok byl vytvořen.");
      }

      setShowForm(false);
      mutate();
    } catch (e: any) {
      toast("error", e.message ?? "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (block: any) => {
    const newStatus = block.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await api.patch(`/intensive-blocks/${block.id}`, { status: newStatus });
      toast("success", newStatus === "PUBLISHED" ? "Blok byl zveřejněn." : "Blok byl skryt.");
      mutate();
    } catch (e: any) {
      toast("error", e.message ?? "Chyba");
    }
  };

  const handleCancel = async (block: any) => {
    if (!confirm(`Opravdu zrušit blok "${block.title}"?`)) return;
    try {
      await api.delete(`/intensive-blocks/${block.id}`);
      toast("success", "Blok byl zrušen.");
      mutate();
    } catch (e: any) {
      toast("error", e.message ?? "Chyba");
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays size={28} className="text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Intenzivní pobyty</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Správa vícedenních terapeutických bloků</p>
              </div>
            </div>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Nový pobyt
            </button>
          </div>

          {/* Create / Edit form */}
          {showForm && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  {editId ? "Upravit pobyt" : "Nový intenzivní pobyt"}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="form-label">Název *</label>
                  <input
                    className="input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="např. Jarní detoxikační pobyt"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">Popis</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Podrobný popis pobytu…"
                  />
                </div>

                <div>
                  <label className="form-label">Začátek *</label>
                  <input
                    className="input"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Konec *</label>
                  <input
                    className="input"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Cena / osoba (Kč) *</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.pricePerPerson}
                    onChange={(e) => setForm({ ...form, pricePerPerson: e.target.value })}
                    placeholder="5990"
                  />
                </div>

                <div>
                  <label className="form-label">Max. účastníků</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.maxParticipants}
                    onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="includesAccommodation"
                    checked={form.includesAccommodation}
                    onChange={(e) => setForm({ ...form, includesAccommodation: e.target.checked })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <label htmlFor="includesAccommodation" className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <BedDouble size={15} /> Zahrnuje ubytování
                  </label>
                </div>

                {form.includesAccommodation && (
                  <div className="md:col-span-2">
                    <label className="form-label">Popis ubytování</label>
                    <input
                      className="input"
                      value={form.accommodationDetails}
                      onChange={(e) => setForm({ ...form, accommodationDetails: e.target.value })}
                      placeholder="např. Dvoulůžkové pokoje, sdílené sociální zařízení"
                    />
                  </div>
                )}

                <div>
                  <label className="form-label">Stravování</label>
                  <select
                    className="input"
                    value={form.mealPlan}
                    onChange={(e) => setForm({ ...form, mealPlan: e.target.value })}
                  >
                    <option value="">Bez stravy</option>
                    <option value="Snídaně">Snídaně</option>
                    <option value="Polopenze">Polopenze</option>
                    <option value="Plná penze">Plná penze</option>
                    <option value="All inclusive">All inclusive</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Stav</label>
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="DRAFT">Koncept</option>
                    <option value="PUBLISHED">Zveřejněno</option>
                    <option value="COMPLETED">Dokončeno</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">Program (denní plán, JSON nebo text)</label>
                  <textarea
                    className="input font-mono text-xs"
                    rows={4}
                    value={form.programDetails}
                    onChange={(e) => setForm({ ...form, programDetails: e.target.value })}
                    placeholder='{"den1": "Příjezd, večeře, úvodní sezení", "den2": "Ranní jóga, terapie, skupinová práce"}'
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="btn-secondary">Zrušit</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? "Ukládám…" : editId ? "Uložit změny" : "Vytvořit pobyt"}
                </button>
              </div>
            </div>
          )}

          {/* Blocks list */}
          {isLoading ? (
            <p className="text-sm text-gray-500">Načítám…</p>
          ) : !blocks || blocks.length === 0 ? (
            <div className="card text-center py-10">
              <CalendarDays size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">Žádné pobyty zatím nevytvořeny.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(blocks as any[]).map((block) => {
                const spotsLeft = block.max_participants - (block.enrolled_count ?? 0);
                return (
                  <div key={block.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{block.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[block.status] ?? ""}`}>
                          {STATUS_LABELS[block.status] ?? block.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={13} />
                          {formatDate(block.start_date)} – {formatDate(block.end_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={13} />
                          {block.enrolled_count ?? 0}/{block.max_participants} účastníků
                          {spotsLeft > 0 ? ` (${spotsLeft} volných)` : " — obsazeno"}
                        </span>
                        {block.includes_accommodation && (
                          <span className="flex items-center gap-1">
                            <BedDouble size={13} /> Ubytování
                          </span>
                        )}
                        <span className="font-medium text-primary-600 dark:text-primary-400">
                          {formatCurrency(block.price_per_person)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {["DRAFT", "PUBLISHED"].includes(block.status) && (
                        <button
                          onClick={() => togglePublish(block)}
                          title={block.status === "PUBLISHED" ? "Skrýt" : "Zveřejnit"}
                          className="btn-secondary p-2"
                        >
                          {block.status === "PUBLISHED" ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(block)}
                        title="Upravit"
                        className="btn-secondary p-2"
                      >
                        <Pencil size={15} />
                      </button>
                      {block.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleCancel(block)}
                          title="Zrušit"
                          className="btn-danger p-2"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
