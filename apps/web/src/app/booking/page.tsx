"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";

const MOCK_SLOTS = [
  { date: "2026-04-07", times: ["09:00", "10:00", "11:00", "14:00", "15:00"] },
  { date: "2026-04-08", times: ["09:00", "10:30", "13:00", "14:30"] },
  { date: "2026-04-09", times: ["08:30", "10:00", "11:30", "15:00"] },
  { date: "2026-04-10", times: ["09:00", "10:00", "14:00"] },
  { date: "2026-04-11", times: ["09:00", "11:00", "13:00", "15:30"] },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" });
}

type Step = "service" | "slot" | "form" | "confirm";

export default function PublicBookingPage() {
  const shouldReduce = useReducedMotion();
  const [step, setStep] = useState<Step>("slot");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const handleSlotSelect = (date: string, time: string) => {
    haptics.medium();
    setSelectedDate(date);
    setSelectedTime(time);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      haptics.error();
      setError("Vyplňte prosím jméno a e-mail.");
      return;
    }
    haptics.medium();
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post<{ id: number; message: string }>("/booking/public", {
        slotDate: selectedDate,
        slotTime: selectedTime,
        name: form.name,
        email: form.email,
        phone: form.phone,
        note: form.note,
      });
      setBookingId(res.id);
      haptics.success();
      setStep("confirm");
    } catch (e: any) {
      haptics.error();
      setError(e.message ?? "Chyba při odesílání rezervace. Zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6"
          initial={{ scale: 0 }}
          animate={{ scale: 1, transition: { type: "spring", stiffness: 260, damping: 14 } }}
        >
          <motion.svg
            className="w-12 h-12 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1, transition: { delay: 0.2, duration: 0.5 } }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </motion.svg>
        </motion.div>

        <motion.h1
          className="text-2xl font-bold text-gray-900 mb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
        >
          Rezervace odeslána!
        </motion.h1>
        <motion.p
          className="text-gray-500 mb-1 text-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
        >
          Brzy vás budeme kontaktovat pro potvrzení termínu.
        </motion.p>
        {bookingId && (
          <motion.p
            className="text-xs text-gray-400 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.45 } }}
          >
            Číslo rezervace: #{bookingId}
          </motion.p>
        )}

        <motion.div
          className="bg-gray-50 rounded-2xl px-6 py-4 w-full max-w-xs text-left mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }}
        >
          <p className="text-sm text-gray-600"><strong>Termín:</strong> {formatDate(selectedDate)}, {selectedTime}</p>
          <p className="text-sm text-gray-600 mt-1"><strong>Jméno:</strong> {form.name}</p>
          <p className="text-sm text-gray-600 mt-1"><strong>Email:</strong> {form.email}</p>
        </motion.div>

        <motion.button
          onClick={() => { setStep("slot"); setSelectedDate(""); setSelectedTime(""); setForm({ name: "", email: "", phone: "", note: "" }); setBookingId(null); }}
          className="w-full max-w-xs py-3 bg-primary text-white rounded-xl font-medium text-sm"
          initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduce ? { opacity: 1 } : { opacity: 1, y: 0, transition: { delay: 0.6 } }}
          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
        >
          Rezervovat další termín
        </motion.button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Přístav Radosti</p>
            <p className="text-xs text-gray-500">Online rezervace</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 py-8">
        {step === "slot" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Vyberte termín</h1>
            <p className="text-gray-500 text-sm mb-6">Zvolte datum a čas, který vám vyhovuje.</p>
            <div className="space-y-4">
              {MOCK_SLOTS.map((day) => (
                <div key={day.date} className="bg-white rounded-xl shadow-sm p-4">
                  <p className="font-medium text-gray-800 mb-3 capitalize">{formatDate(day.date)}</p>
                  <div className="flex flex-wrap gap-2">
                    {day.times.map((time) => (
                      <motion.button
                        key={time}
                        onClick={() => handleSlotSelect(day.date, time)}
                        whileTap={shouldReduce ? undefined : { scale: 0.93 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="px-4 py-2 rounded-lg border border-primary-200 text-primary hover:bg-primary-50 text-sm font-medium transition-colors"
                      >
                        {time}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === "form" && (
          <>
            <button onClick={() => setStep("slot")} className="text-sm text-primary hover:underline mb-4 flex items-center gap-1">
              ← Zpět na výběr termínu
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Vyplňte kontaktní údaje</h1>
            <p className="text-gray-500 text-sm mb-6">
              Termín: <strong>{formatDate(selectedDate)}, {selectedTime}</strong>
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jméno a příjmení *</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jan Novák"
                  inputMode="text"
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jan@novak.cz"
                  inputMode="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+420 123 456 789"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poznámka</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Volitelná poznámka k rezervaci…"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary disabled:opacity-50 transition-colors"
              >
                {submitting ? "Odesílám…" : "Odeslat rezervaci"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
