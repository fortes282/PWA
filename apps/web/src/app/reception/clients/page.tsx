"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Search, ChevronRight, Mail, CheckSquare, Square } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any[]>(url);

export default function ReceptionClients() {
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);
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
      let sent = 0;
      for (const userId of Array.from(selected)) {
        await api.post("/notifications", {
          userId,
          type: "GENERAL",
          title: bulkSubject || "Zpráva od recepce",
          message: bulkMessage,
        });
        sent++;
      }
      setBulkResult(`✓ Odesláno ${sent} in-app notifikací`);
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
            <h1 className="text-2xl font-bold text-gray-900">Klienti</h1>
            {selected.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{selected.size} vybráno</span>
                <button
                  onClick={() => setShowBulk(true)}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Mail size={14} /> Hromadná zpráva
                </button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">
                  Zrušit výběr
                </button>
              </div>
            )}
          </div>

          {/* Bulk message form */}
          {showBulk && selected.size > 0 && (
            <div className="card mb-6 border border-primary-200">
              <h2 className="font-semibold text-gray-900 mb-4">
                Hromadná zpráva ({selected.size} klientů)
              </h2>
              {bulkResult && (
                <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-3">{bulkResult}</div>
              )}
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
                  <button
                    onClick={() => handleBulkSend()}
                    disabled={!bulkMessage || bulkSending}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Mail size={14} /> {bulkSending ? "Odesílám…" : "Odeslat notifikaci"}
                  </button>
                  <button onClick={() => { setShowBulk(false); setBulkResult(null); }} className="btn-secondary">
                    Zrušit
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  * Zpráva bude doručena jako in-app notifikace. Email/SMS vyžaduje SMTP/FAYN konfiguraci.
                </p>
              </div>
            </div>
          )}

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
              <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <span className="text-xs text-gray-400">
                {allSelected ? "Zrušit výběr všech" : "Vybrat vše"} ({filtered.length})
              </span>
            </div>
          )}

          <div className="space-y-2">
            {filtered.map((c: any) => (
              <div key={c.id} className={`card flex items-center gap-3 hover:shadow-md transition-shadow ${selected.has(c.id) ? "border-primary-200 bg-primary-50" : ""}`}>
                <button onClick={() => toggleSelect(c.id)} className="text-gray-400 hover:text-primary-500 flex-shrink-0">
                  {selected.has(c.id) ? <CheckSquare size={18} className="text-primary-500" /> : <Square size={18} />}
                </button>
                <Link href={`/reception/clients/${c.id}`} className="flex items-center justify-between flex-1 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-700 text-sm font-bold">
                        {c.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Behavior</p>
                      <p className={`text-sm font-bold ${(c.behaviorScore ?? 100) >= 80 ? "text-green-600" : (c.behaviorScore ?? 100) >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                        {(c.behaviorScore ?? 100).toFixed(0)}/100
                      </p>
                    </div>
                    <span className={`badge ${c.isActive ? "badge-green" : "bg-red-100 text-red-600"}`}>
                      {c.isActive ? "Aktivní" : "Neaktivní"}
                    </span>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </Link>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">Žádní klienti</p>
            )}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
