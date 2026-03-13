"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Search, ExternalLink, Download } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any[]>(url);

const ROLE_LABELS: Record<string, string> = {
  CLIENT: "Klient",
  RECEPTION: "Recepce",
  EMPLOYEE: "Terapeut",
  ADMIN: "Admin",
};

export default function AdminUsers() {
  const { data: users, mutate } = useSWR("/users", fetcher);
  const [search, setSearch] = useState("");

  const filtered = users?.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleChange = async (id: number, role: string) => {
    await api.patch(`/users/${id}/role`, { role });
    mutate();
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    if (!isActive && !confirm("Opravdu deaktivovat uživatele?")) return;
    await api.delete(`/users/${id}`);
    mutate();
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
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Uživatelé</h1>
            <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={16} /> Export CSV
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Hledat…"
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
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
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
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
                      {u.isActive && (
                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Deaktivovat
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
