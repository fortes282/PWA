"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, User, Check, ArrowRight, ArrowLeft, Sparkles, WifiOff } from "lucide-react";
import Link from "next/link";
import MiniCalendar from "@/components/MiniCalendar";

const fetcher = (url: string) => api.get<any[]>(url);

type Slot = {
  startTime: string;
  endTime: string;
  employeeId: number;
  employeeName?: string;
  roomId: number | null;
};

const STEPS = [
  { label: "Služba", num: 1 },
  { label: "Datum", num: 2 },
  { label: "Čas", num: 3 },
  { label: "Potvrzení", num: 4 },
];

function ProgressStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between mb-8 px-2">
      {STEPS.map((step, i) => (
        <div key={step.num} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                current > step.num
                  ? "bg-green-500 text-white"
                  : current === step.num
                    ? "bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900/50"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
              }`}
            >
              {current > step.num ? <Check size={16} /> : step.num}
            </div>
            <span
              className={`text-[10px] mt-1 ${
                current >= step.num ? "text-primary-600 dark:text-primary-400 font-medium" : "text-gray-400"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-1 mt-[-16px] transition-colors ${
                current > step.num ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ClientBooking() {
  const { user } = useAuth();
  const { data: services } = useSWR("/services", fetcher);

  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [clientNote, setClientNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const selectedService = services?.find((s: any) => s.id === parseInt(serviceId));

  // Determine current step
  const currentStep = !serviceId ? 1 : !date ? 2 : !selectedSlot ? 3 : 4;

  // Group services by category
  const servicesByCategory = (services ?? []).reduce((acc: Record<string, any[]>, s: any) => {
    const cat = s.category ?? "Ostatní";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, any[]>);

  // Fetch available slots when service and date are selected
  const slotsKey = serviceId && date ? `/appointments/available?serviceId=${serviceId}&date=${date}` : null;
  const { data: slots, isLoading: slotsLoading } = useSWR<Slot[]>(slotsKey, fetcher);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !serviceId) return;
    setSubmitting(true);
    setError("");

    try {
      await api.post("/appointments", {
        clientId: user!.id,
        employeeId: selectedSlot.employeeId,
        serviceId: parseInt(serviceId),
        roomId: selectedSlot.roomId,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        price: selectedService?.price,
        clientNote: clientNote.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Chyba při rezervaci");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen with post-booking suggestions ──
  if (success) {
    return (
      <RouteGuard allowedRoles={["CLIENT"]}>
        <Layout>
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={36} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Rezervace odeslána!</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {selectedService?.name} — {date && new Date(date).toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
            </p>
            <div className="card text-left mb-6">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">
                <Sparkles size={12} className="inline mr-1" />
                Doporučujeme také
              </p>
              <div className="space-y-2">
                <Link
                  href="/client/health-record"
                  className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline min-h-[44px]"
                >
                  → Vyplňte zdravotní kartu pro lepší péči
                </Link>
                <Link
                  href="/client/settings"
                  className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline min-h-[44px]"
                >
                  → Zapněte SMS připomínky termínů
                </Link>
              </div>
            </div>
            <Link
              href="/client/appointments"
              className="btn-primary inline-flex items-center gap-2"
            >
              Zobrazit moje termíny <ArrowRight size={14} />
            </Link>
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Rezervace termínu</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Vyberte službu, datum a čas</p>

          {/* Offline notice */}
          {isOffline && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 text-amber-800 dark:text-amber-300">
              <WifiOff size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Jste offline</p>
                <p className="text-xs mt-0.5">Rezervace bude odeslána po připojení k internetu.</p>
              </div>
            </div>
          )}

          <ProgressStepper current={currentStep} />

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ── Step 1: Service (card-based) ── */}
            <div className="card">
              <label className="label flex items-center gap-2">
                <span className="w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                Vyberte službu
              </label>
              {Object.entries(servicesByCategory).map(([cat, svcs]) => (
                <div key={cat} className="mb-4 last:mb-0">
                  {Object.keys(servicesByCategory).length > 1 && (
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    {(svcs as any[]).map((s: any) => {
                      const selected = serviceId === String(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setServiceId(String(s.id));
                            setSelectedSlot(null);
                          }}
                          className={`border rounded-xl p-4 text-left transition-all min-h-[44px] ${
                            selected
                              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-500/30 shadow-sm"
                              : "border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={`font-medium text-sm ${selected ? "text-primary-700 dark:text-primary-400" : "text-gray-900 dark:text-gray-100"}`}>
                                {s.name}
                              </p>
                              {s.description && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {s.durationMin} min
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`font-bold text-sm ${selected ? "text-primary-600 dark:text-primary-400" : "text-gray-900 dark:text-gray-100"}`}>
                                {formatCurrency(s.price)}
                              </p>
                              {selected && (
                                <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center mt-1 ml-auto">
                                  <Check size={12} className="text-white" />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Step 2: Date (MiniCalendar) ── */}
            {serviceId && (
              <div className="card animate-slide-in">
                <label className="label flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                  Vyberte datum
                </label>
                <MiniCalendar
                  value={date}
                  onChange={(d) => {
                    setDate(d);
                    setSelectedSlot(null);
                  }}
                  minDate={new Date().toISOString().slice(0, 10)}
                />
                {serviceId && !date && (
                  <button
                    type="button"
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-3 flex items-center gap-1"
                    onClick={() => setServiceId("")}
                  >
                    <ArrowLeft size={12} /> Zpět na výběr služby
                  </button>
                )}
              </div>
            )}

            {/* ── Step 3: Available slots ── */}
            {serviceId && date && (
              <div className="card animate-slide-in">
                <label className="label flex items-center gap-2">
                  <span className="w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                  Vyberte čas
                </label>
                {slotsLoading ? (
                  <div className="py-6 text-center">
                    <div className="animate-pulse text-gray-400 text-sm">Načítání volných termínů…</div>
                  </div>
                ) : slots && slots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {slots.map((slot, i) => {
                      const start = new Date(slot.startTime);
                      const timeStr = start.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
                      const isSelected = selectedSlot?.startTime === slot.startTime && selectedSlot?.employeeId === slot.employeeId;

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`border rounded-xl p-3 text-left transition-all min-h-[44px] ${
                            isSelected
                              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-500/30 shadow-sm"
                              : "border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-primary-500" />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{timeStr}</span>
                          </div>
                          {slot.employeeName && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <User size={11} className="text-gray-400" />
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{slot.employeeName}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-gray-400 text-sm">Žádné volné termíny pro tento den</p>
                    <button
                      type="button"
                      onClick={() => setDate("")}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-2 inline-flex items-center gap-1"
                    >
                      <ArrowLeft size={12} /> Zkusit jiný den
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Summary ── */}
            {selectedSlot && selectedService && (
              <div className="card bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/20 dark:to-gray-900 border-primary-200 dark:border-primary-800 animate-slide-in">
                <label className="label flex items-center gap-2">
                  <span className="w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">4</span>
                  Souhrn rezervace
                </label>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Služba:</span>
                    <span className="font-medium">{selectedService.name} ({selectedService.durationMin} min)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Datum:</span>
                    <span className="font-medium">
                      {new Date(selectedSlot.startTime).toLocaleDateString("cs-CZ", {
                        weekday: "long", day: "numeric", month: "long",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Čas:</span>
                    <span className="font-medium">
                      {new Date(selectedSlot.startTime).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                      –
                      {new Date(selectedSlot.endTime).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {selectedSlot.employeeName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Terapeut:</span>
                      <span className="font-medium">{selectedSlot.employeeName}</span>
                    </div>
                  )}
                  <div className="border-t border-primary-200 dark:border-primary-800 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">Cena:</span>
                      <span className="text-lg font-bold text-primary-700 dark:text-primary-400">
                        {formatCurrency(selectedService.price)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Client note */}
                <div className="mt-4">
                  <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Poznámka (nepovinné)</label>
                  <textarea
                    className="input min-h-[60px] mt-1"
                    value={clientNote}
                    onChange={(e) => setClientNote(e.target.value)}
                    maxLength={500}
                    placeholder="Zvláštní požadavky, zdravotní omezení…"
                  />
                  {clientNote.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5 text-right">{clientNote.length}/500</p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedSlot}
              className="btn-primary w-full disabled:opacity-50 min-h-[48px] text-base font-semibold flex items-center justify-center gap-2"
            >
              {submitting ? "Rezervuji…" : (
                <>Potvrdit rezervaci <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>
      </Layout>
    </RouteGuard>
  );
}
