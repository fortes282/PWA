"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, User, FileText } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const categoryColor: Record<string, string> = {
  intake: "border-blue-400 bg-blue-50",
  progress: "border-green-400 bg-green-50",
  final: "border-purple-400 bg-purple-50",
  cognitive: "border-orange-400 bg-orange-50",
};

const categoryDesc: Record<string, string> = {
  intake: "Anamnéza, diagnóza, objektivní nález, plán terapie",
  progress: "Subjektivní hodnocení, objektivní nález, terapie provedena, plán",
  final: "Shrnutí terapie, dosažené výsledky, doporučení",
  cognitive: "Orientace, paměť, pozornost, exekutivní funkce (škály 1–5)",
};

export default function NewTherapyReportPage() {
  const router = useRouter();
  const { data: templates } = useSWR("/report-templates", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selectedTemplate = templates?.find((t: any) => t.id === selectedTemplateId);
  const selectedClient = clients?.find((c: any) => c.id === selectedClientId);

  // Auto-fill title when both client + template are selected
  const handleSelectTemplate = (tplId: number) => {
    setSelectedTemplateId(tplId);
    const tpl = templates?.find((t: any) => t.id === tplId);
    if (tpl && selectedClient) {
      setTitle(`${tpl.name} — ${selectedClient.name}`);
    } else if (tpl) {
      setTitle(tpl.name);
    }
  };

  const handleSelectClient = (clientId: number) => {
    setSelectedClientId(clientId);
    const client = clients?.find((c: any) => c.id === clientId);
    if (selectedTemplate && client) {
      setTitle(`${selectedTemplate.name} — ${client.name}`);
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplateId || !selectedClientId || !title.trim()) {
      setError("Vyberte šablonu, klienta a zadejte název zprávy.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const created = await api.post<{ id: number }>("/reports/therapy", {
        templateId: selectedTemplateId,
        clientId: selectedClientId,
        title: title.trim(),
        data: {},
        status: "DRAFT",
      });
      router.push(`/employee/therapy-reports/${created.id}`);
    } catch (e: any) {
      setError(e.message ?? "Nepodařilo se vytvořit zprávu.");
      setCreating(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push("/employee/therapy-reports")}
              className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-1 mb-2"
            >
              ← Zpět na zprávy
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Nová terapeutická zpráva</h1>
            <p className="text-sm text-gray-500 mt-1">Vyberte šablonu a klienta, pak zprávu vyplňte a exportujte do PDF.</p>
          </div>

          {/* Step 1: Select Template */}
          <div className="card mb-4">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              Vyberte šablonu zprávy
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(!templates || templates.length === 0) && (
                <div className="col-span-2 text-gray-400 text-sm py-4 text-center">Načítám šablony…</div>
              )}
              {templates?.map((tpl: any) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`border-2 rounded-xl p-4 text-left transition-all ${
                    selectedTemplateId === tpl.id
                      ? `${categoryColor[tpl.category] ?? "border-primary-400 bg-primary-50"} ring-2 ring-primary-400`
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-gray-900 text-sm">{tpl.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {categoryDesc[tpl.category] ?? "Šablona zprávy"}
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {tpl.structure?.length ?? 0} polí
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Select Client */}
          <div className="card mb-4">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Vyberte klienta
            </h2>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                className="input pl-8"
                value={selectedClientId ?? ""}
                onChange={(e) => handleSelectClient(Number(e.target.value))}
              >
                <option value="">— Vyberte klienta —</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: Title + create */}
          <div className="card mb-4">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">3</span>
              Název zprávy
            </h2>
            <div className="relative">
              <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-8"
                placeholder="Název zprávy (auto-vyplněno)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {/* Summary + action */}
          {selectedTemplate && selectedClient && (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-700">
                <strong>Šablona:</strong> {selectedTemplate.name}<br />
                <strong>Klient:</strong> {selectedClient.name}<br />
                <strong>Název:</strong> {title || "—"}
              </p>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !selectedTemplateId || !selectedClientId || !title.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Vytváří se…
              </>
            ) : (
              <>
                Vytvořit zprávu a vyplnit
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </Layout>
    </RouteGuard>
  );
}
