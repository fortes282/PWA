"use client";
import { motion, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Search, ExternalLink, Download, UserPlus, X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Link from "next/link";

const fetcher = (url: string) => api.get<any[]>(url);

interface NewUserForm {
  name: string;
  email: string;
  password: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  CLIENT: "Klient",
  RECEPTION: "Recepce",
  EMPLOYEE: "Terapeut",
  ADMIN: "Admin",
};

export default function AdminUsers() {
  const shouldReduceMotion = useReducedMotion();
  const { data: users, mutate } = useSWR("/users", fetcher);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterActive, setFilterActive] = useState("ALL");
  const [confirmDeactivate, setConfirmDeactivate] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({ name: "", email: "", password: "", role: "CLIENT" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const filtered = users?.filter((u) => {
    if (filterRole !== "ALL" && u.role !== filterRole) return false;
    if (filterActive === "ACTIVE" && !u.isActive) return false;
    if (filterActive === "INACTIVE" && u.isActive) return false;
    return (
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleBulkAction = async (isActive: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await api.post("/batch/users/active", { ids: Array.from(selectedIds), isActive });
      setSelectedIds(new Set());
      mutate();
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === (filtered?.length ?? 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((filtered ?? []).map((u: any) => u.id)));
    }
  };

  const handleRoleChange = async (id: number, role: string) => {
    await api.patch(`/users/${id}/role`, { role });
    mutate();
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    if (!isActive) {
      setConfirmDeactivate(id);
      return;
    }
    // isActive=true means user is active → deactivate
    await api.delete(`/users/${id}`);
    mutate();
  };

  const handleReactivate = async (id: number) => {
    await api.post(`/users/${id}/reactivate`, {});
    mutate();
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivate) return;
    await api.delete(`/users/${confirmDeactivate}`);
    setConfirmDeactivate(null);
    mutate();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      await api.post("/users", {
        name: newUserForm.name,
        email: newUserForm.email,
        password: newUserForm.password,
        role: newUserForm.role,
      });
      setShowAddForm(false);
      setNewUserForm({ name: "", email: "", password: "", role: "CLIENT" });
      mutate();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Chyba při vytváření uživatele.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!filtered || filtered.length === 0) return;
    const headers = ["ID", "Jméno", "Email", "Role", "Telefon", "Aktivní", "Behavior score", "Registrován"];
    const rows = filtered.map((u: any) => [
      u.id,
      u.name,
      u.email,
      ROLE_LABELS[u.role] ?? u.role,
      u.phone ?? "",
      u.isActive ? "Ano" : "Ne",
      u.behaviorScore ?? 100,
      u.createdAt ? new Date(u.createdAt).toLocaleDateString("cs-CZ") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uzivatele-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <ConfirmDialog
        open={!!confirmDeactivate}
        title="Deaktivovat uživatele"
        message="Opravdu chcete deaktivovat tohoto uživatele? Uživatel nebude moci přistupovat do systému."
        confirmLabel="Deaktivovat"
        destructive
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setConfirmDeactivate(null)}
      />
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Uživatelé</h1>
            <div className="flex gap-2">
              <motion.button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2 text-sm"
          whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}>
                <UserPlus size={16} /> Přidat uživatele
              </motion.button>
              <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2 text-sm">
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>

          {/* Add user modal */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Přidat uživatele</h2>
                  <button onClick={() => { setShowAddForm(false); setAddError(""); }} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div>
                    <label className="label">Jméno</label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      placeholder="Jan Novák"
                    />
                  </div>
                  <div>
                    <label className="label">E-mail</label>
                    <input
                      type="email"
                      required
                      className="input"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      placeholder="jan.novak@example.com"
                    />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <select
                      className="input"
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    >
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Heslo</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      className="input"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      placeholder="Minimálně 8 znaků"
                    />
                  </div>
                  {addError && <p className="text-sm text-red-600">{addError}</p>}
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => { setShowAddForm(false); setAddError(""); }} className="btn-secondary">
                      Zrušit
                    </button>
                    <motion.button type="submit" disabled={addLoading} className="btn-primary disabled:opacity-50"
          whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}>
                      {addLoading ? "Vytvářím…" : "Vytvořit uživatele"}
                    </motion.button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="card mb-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                placeholder="Hledat jméno / email…"
                className="input pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="input w-auto"
            >
              <option value="ALL">Všechny role</option>
              <option value="CLIENT">Klienti</option>
              <option value="EMPLOYEE">Terapeuti</option>
              <option value="RECEPTION">Recepce</option>
              <option value="ADMIN">Admins</option>
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="input w-auto"
            >
              <option value="ALL">Aktivní i neaktivní</option>
              <option value="ACTIVE">Jen aktivní</option>
              <option value="INACTIVE">Jen neaktivní</option>
            </select>
            <span className="text-xs text-gray-500 ml-auto">{filtered?.length ?? 0} uživatelů</span>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="card mb-4 flex items-center gap-3 bg-blue-50 border-blue-200">
              <span className="text-sm font-medium text-blue-800">{selectedIds.size} vybraných</span>
              <button
                onClick={() => handleBulkAction(false)}
                disabled={bulkLoading}
                className="text-sm bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                Deaktivovat vybrané
              </button>
              <button
                onClick={() => handleBulkAction(true)}
                disabled={bulkLoading}
                className="text-sm bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              >
                Aktivovat vybrané
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
              >
                Zrušit výběr
              </button>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === (filtered?.length ?? 0)}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">Jméno</th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">Email</th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">Role</th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">Skóre</th>
                  <th className="text-left py-3 px-2 text-gray-500 font-medium">Status</th>
                  <th className="py-3 px-2" />
                </tr>
              </thead>
              <tbody>
                {filtered?.map((u: any) => (
                  <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 ${selectedIds.has(u.id) ? "bg-blue-50" : ""}`}>
                    <td className="py-3 px-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-3 px-2 font-medium">{u.name}</td>
                    <td className="py-3 px-2 text-gray-500">{u.email}</td>
                    <td className="py-3 px-2">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1"
                      >
                        {Object.entries(ROLE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`font-medium ${u.behaviorScore >= 80 ? "text-green-600" : u.behaviorScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                        {u.behaviorScore?.toFixed(0)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`badge ${u.isActive ? "badge-green" : "badge-red"}`}>
                        {u.isActive ? "Aktivní" : "Neaktivní"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right flex gap-2 items-center justify-end">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Detail
                      </Link>
                      {u.isActive ? (
                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Deaktivovat
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(u.id)}
                          className="text-xs text-green-600 hover:text-green-800"
                        >
                          Obnovit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
