"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Clock, User } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

type Slot = {
  startTime: string;
  endTime: string;
  employeeId: number;
  employeeName?: string;
  roomId: number | null;
};

export default function ClientBooking() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: services } = useSWR("/services", fetcher);

  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const selectedService = services?.find((s) => s.id === parseInt(serviceId));

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
      });
      setSuccess(true);
      setTimeout(() => router.push("/client/appointments"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Chyba při rezervaci");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <RouteGuard allowedRoles={["CLIENT"]}>
        <Layout>
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-2xl">&#10003;</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Rezervace odeslána!</h2>
            <p className="text-gray-500 text-sm">Přesměrování na vaše termíny…</p>
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Rezervace termínu</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Service */}
            <div className="card">
              <label className="label">1. Vyberte službu</label>
              <select
                className="input"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setSelectedSlot(null);
                }}
                required
              >
                <option value="">Vyberte službu…</option>
                {services?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.durationMin} min — {formatCurrency(s.price)}
                  </option>
                ))}
              </select>
              {selectedService && (
                <p className="text-xs text-gray-400 mt-2">{selectedService.description}</p>
              )}
            </div>

            {/* Step 2: Date */}
            {serviceId && (
              <div className="card">
                <label className="label">2. Vyberte datum</label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
            )}

            {/* Step 3: Available slots */}
            {serviceId && date && (
              <div className="card">
                <label className="label">3. Vyberte čas</label>
                {slotsLoading ? (
                  <p className="text-gray-400 text-sm py-4 text-center">Načítání volných termínů…</p>
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
                          className={`border rounded-lg p-2 text-left transition-colors ${
                            isSelected
                              ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                              : "border-gray-200 hover:border-primary-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-primary-500" />
                            <span className="text-sm font-medium">{timeStr}</span>
                          </div>
                          {slot.employeeName && (
                            <div className="flex items-center gap-1 mt-1">
                              <User size={11} className="text-gray-400" />
                              <span className="text-xs text-gray-500 truncate">{slot.employeeName}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm py-4 text-center">
                    Žádné volné termíny pro tento den
                  </p>
                )}
              </div>
            )}

            {/* Summary */}
            {selectedSlot && selectedService && (
              <div className="card bg-primary-50 border-primary-200">
                <h3 className="font-semibold text-primary-800 mb-2">Souhrn rezervace</h3>
                <div className="text-sm text-primary-700 space-y-1">
                  <p>{selectedService.name} ({selectedService.durationMin} min)</p>
                  <p>
                    {new Date(selectedSlot.startTime).toLocaleDateString("cs-CZ", {
                      weekday: "long", day: "numeric", month: "long",
                    })}{" "}
                    {new Date(selectedSlot.startTime).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                    –
                    {new Date(selectedSlot.endTime).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {selectedSlot.employeeName && <p>Terapeut: {selectedSlot.employeeName}</p>}
                  <p className="font-bold">{formatCurrency(selectedService.price)}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedSlot}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting ? "Rezervuji…" : "Potvrdit rezervaci"}
            </button>
          </form>
        </div>
      </Layout>
    </RouteGuard>
  );
}
