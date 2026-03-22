"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { CalendarDays, BedDouble, Utensils, Users, BadgeCheck } from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);
}

export default function ClientIntensiveBlocksPage() {
  const { data: blocks, mutate, isLoading } = useSWR("/intensive-blocks", fetcher);
  const { toast } = useToast();
  const [loading, setLoading] = useState<number | null>(null);

  const handleEnroll = async (blockId: number) => {
    setLoading(blockId);
    try {
      await api.post(`/intensive-blocks/${blockId}/enroll`, {});
      toast("success", "Byli jste úspěšně přihlášeni.");
      mutate();
    } catch (e: any) {
      toast("error", e.message ?? "Chyba při přihlašování");
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async (blockId: number) => {
    if (!confirm("Opravdu se chcete odhlásit z tohoto bloku?")) return;
    setLoading(blockId);
    try {
      await api.delete(`/intensive-blocks/${blockId}/enroll`);
      toast("success", "Odhlášení proběhlo úspěšně.");
      mutate();
    } catch (e: any) {
      toast("error", e.message ?? "Chyba při odhlašování");
    } finally {
      setLoading(null);
    }
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <CalendarDays size={28} className="text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Intenzivní pobyty</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Vícedenní skupinové terapeutické bloky s ubytováním</p>
            </div>
          </div>

          {isLoading && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Načítám…</p>
          )}

          {!isLoading && (!blocks || blocks.length === 0) && (
            <div className="card text-center py-12">
              <CalendarDays size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Momentálně nejsou vypsány žádné intenzivní pobyty.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Sledujte tuto stránku — nové termíny přibývají průběžně.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5">
            {(blocks ?? []).map((block: any) => {
              const spotsLeft = block.max_participants - (block.enrolled_count ?? 0);
              const isFull = spotsLeft <= 0 || block.status === "FULL";
              const myStatus = block.my_enrollment_status;
              const isEnrolled = myStatus === "ENROLLED";
              const isWaitlist = myStatus === "WAITLIST";

              return (
                <div key={block.id} className="card flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{block.title}</h2>
                      {block.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{block.description}</p>
                      )}
                    </div>
                    {(isEnrolled || isWaitlist) && (
                      <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        isEnrolled
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                      }`}>
                        <BadgeCheck size={12} />
                        {isEnrolled ? "Přihlášen/a" : "Čekací listina"}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays size={15} className="text-primary-500" />
                      {formatDate(block.start_date)} – {formatDate(block.end_date)}
                    </span>
                    {block.includes_accommodation && (
                      <span className="flex items-center gap-1.5">
                        <BedDouble size={15} className="text-indigo-500" />
                        Ubytování v ceně
                        {block.accommodation_details && ` — ${block.accommodation_details}`}
                      </span>
                    )}
                    {block.meal_plan && (
                      <span className="flex items-center gap-1.5">
                        <Utensils size={15} className="text-orange-500" />
                        {block.meal_plan}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users size={15} className="text-gray-400" />
                      {isFull ? (
                        <span className="text-red-500 font-medium">Obsazeno</span>
                      ) : (
                        <span>{spotsLeft} volných míst z {block.max_participants}</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                      {formatCurrency(block.price_per_person)}{" "}
                      <span className="text-sm font-normal text-gray-500">/ osoba</span>
                    </span>

                    {isEnrolled ? (
                      <button
                        onClick={() => handleCancel(block.id)}
                        disabled={loading === block.id}
                        className="btn-secondary text-sm px-4"
                      >
                        {loading === block.id ? "Zpracovávám…" : "Odhlásit se"}
                      </button>
                    ) : isWaitlist ? (
                      <button
                        onClick={() => handleCancel(block.id)}
                        disabled={loading === block.id}
                        className="btn-secondary text-sm px-4"
                      >
                        {loading === block.id ? "Zpracovávám…" : "Odhlásit z čekací listiny"}
                      </button>
                    ) : isFull ? (
                      <button
                        onClick={() => handleEnroll(block.id)}
                        disabled={loading === block.id}
                        className="btn-secondary text-sm px-4"
                      >
                        {loading === block.id ? "Zpracovávám…" : "Přidat na čekací listinu"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnroll(block.id)}
                        disabled={loading === block.id}
                        className="btn-primary text-sm px-4"
                      >
                        {loading === block.id ? "Zpracovávám…" : "Přihlásit se"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
