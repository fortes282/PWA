"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => api.get<any[]>(url);

export default function ClientBooking() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: services } = useSWR("/services", fetcher);
  const { data: employees } = useSWR("/users?role=EMPLOYEE", fetcher);

  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const selectedService = services?.find((s) => s.id === parseInt(serviceId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !employeeId || !date || !time) return;
    setSubmitting(true);
    setError("");

    const startTime = new Date(`${date}T${time}`).toISOString();
    const durationMin = selectedService?.durationMin ?? 60;
    const endTime = new Date(new Date(startTime).getTime() + durationMin * 60 * 1000).toISOString();

    try {
      await api.post("/appointments", {
        clientId: user!.id,
        employeeId: parseInt(employeeId),
        serviceId: parseInt(serviceId),
        startTime,
        endTime,
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
              <span className="text-green-600 text-2xl">✓</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Termín rezervován!</h2>
            <p className="text-gray-500 text-sm">Přesměrování na vaše termíny…</p>
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Rezervace termínu</h1>

          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label className="label">Služba</label>
              <select
                className="input"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
              >
                <option value="">Vyberte službu…</option>
                {services?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.durationMin} min — {formatCurrency(s.price)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Terapeut</label>
              <select
                className="input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
              >
                <option value="">Vyberte terapeuta…</option>
                {employees?.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Datum</label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div>
                <label className="label">Čas</label>
                <input
                  type="time"
                  className="input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  min="08:00"
                  max="18:00"
                  step="1800"
                  required
                />
              </div>
            </div>

            {selectedService && (
              <div className="bg-primary-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-primary-800">{selectedService.name}</p>
                <p className="text-primary-600">{selectedService.durationMin} min · {formatCurrency(selectedService.price)}</p>
                {selectedService.description && (
                  <p className="text-primary-600 mt-1">{selectedService.description}</p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Rezervuji…" : "Potvrdit rezervaci"}
            </button>
          </form>
        </div>
      </Layout>
    </RouteGuard>
  );
}
