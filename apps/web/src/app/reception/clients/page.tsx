"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any[]>(url);

export default function ReceptionClients() {
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);
  const [search, setSearch] = useState("");

  const filtered = clients?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Klienti</h1>

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

          <div className="space-y-2">
            {filtered?.map((c: any) => (
              <Link key={c.id} href={`/reception/clients/${c.id}`} className="card flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 text-sm font-bold">
                      {c.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Behavior score</p>
                    <p className={`text-sm font-bold ${c.behaviorScore >= 80 ? "text-green-600" : c.behaviorScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                      {c.behaviorScore?.toFixed(0)}/100
                    </p>
                  </div>
                  <span className={`badge ${c.isActive ? "badge-green" : "badge-red"}`}>
                    {c.isActive ? "Aktivní" : "Neaktivní"}
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </Link>
            ))}
            {filtered?.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">Žádní klienti</p>
            )}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
