"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Save, ChevronDown, ChevronUp } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const DAYS = [
  { index: 1, label: "Pondělí" },
  { index: 2, label: "Úterý" },
  { index: 3, label: "Středa" },
  { index: 4, label: "Čtvrtek" },
  { index: 5, label: "Pátek" },
  { index: 6, label: "Sobota" },
  { index: 0, label: "Neděle" },
];

type WHRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type EmployeeWH = {
  id: number;
  name: string;
  email: string;
  workingHours: Array<{ id: number; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>;
};

function defaultHours(): WHRow[] {
  return DAYS.map((d) => ({
    dayOfWeek: d.index,
    startTime: "08:00",
    endTime: "16:00",
    isActive: d.index >= 1 && d.index <= 5,
  }));
}

function EmployeeHoursEditor({ emp, onSaved }: { emp: EmployeeWH; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<WHRow[]>(() => {
    const base = defaultHours();
    const existing = emp.workingHours;
    return base.map((b) => {
      const found = existing.find((e) => e.dayOfWeek === b.dayOfWeek);
      return found ? { dayOfWeek: found.dayOfWeek, startTime: found.startTime, endTime: found.endTime, isActive: found.isActive } : b;
    });
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (i: number, field: keyof WHRow, value: string | boolean) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: value };
    setRows(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put(`/working-hours/${emp.id}`, rows);
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setOpen(!open)}
      >
        <div>
          <p className="font-semibold text-gray-900">{emp.name}</p>
          <p className="text-xs text-gray-400">{emp.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {emp.workingHours.filter((w) => w.isActive).length} aktivních dní
          </span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs text-gray-500 font-medium px-1 mb-1">
            <span>Den</span>
            <span>Od</span>
            <span>Do</span>
            <span>Aktivní</span>
          </div>
          {DAYS.map((day, i) => {
            const row = rows[i];
            if (!row) return null;
            return (
              <div key={day.index} className={`grid grid-cols-4 gap-2 items-center p-2 rounded-lg ${row.isActive ? "bg-gray-50" : "bg-gray-50 opacity-50"}`}>
                <span className="text-sm font-medium text-gray-700">{day.label}</span>
                <input
                  type="time"
                  value={row.startTime}
                  onChange={(e) => update(i, "startTime", e.target.value)}
                  disabled={!row.isActive}
                  className="input text-sm py-1"
                />
                <input
                  type="time"
                  value={row.endTime}
                  onChange={(e) => update(i, "endTime", e.target.value)}
                  disabled={!row.isActive}
                  className="input text-sm py-1"
                />
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(e) => update(i, "isActive", e.target.checked)}
                    className="w-4 h-4 accent-primary-600"
                  />
                </label>
              </div>
            );
          })}

          {saved && (
            <p className="text-xs text-green-600 font-medium">✓ Uloženo</p>
          )}

          <div className="flex justify-end mt-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={14} /> {saving ? "Ukládám…" : "Uložit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceptionWorkingHours() {
  const { data: employees, mutate } = useSWR<EmployeeWH[]>("/working-hours/employees", fetcher as any);

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pracovní hodiny</h1>
          <p className="text-sm text-gray-400 mb-6">
            Nastavte dostupnost každého terapeuta pro automatické generování slotů.
          </p>

          {(!employees || employees.length === 0) && (
            <div className="card text-center text-gray-400 py-10">
              Žádní terapeuti v systému
            </div>
          )}

          <div className="space-y-4">
            {(employees ?? []).map((emp) => (
              <EmployeeHoursEditor key={emp.id} emp={emp} onSaved={() => mutate()} />
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
