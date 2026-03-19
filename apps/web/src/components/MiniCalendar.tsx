"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MiniCalendarProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  availableDates?: Set<string>; // YYYY-MM-DD strings that have slots
  minDate?: string; // YYYY-MM-DD
}

const DAYS_CZ = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const MONTHS_CZ = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function MiniCalendar({ value, onChange, availableDates, minDate }: MiniCalendarProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.slice(0, 4));
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return parseInt(value.slice(5, 7)) - 1;
    return today.getMonth();
  });

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Monday = 0, ... Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-500 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Předchozí měsíc"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {MONTHS_CZ[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-500 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Následující měsíc"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_CZ.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-500 dark:text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === value;
          const isPast = minDate ? dateStr < minDate : dateStr < todayStr;
          const hasSlots = availableDates ? availableDates.has(dateStr) : !isPast;
          const isDisabled = isPast || (availableDates ? !availableDates.has(dateStr) : false);

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(dateStr)}
              className={cn(
                "aspect-square flex items-center justify-center rounded-lg text-sm transition-all",
                isSelected
                  ? "bg-primary-600 text-white font-bold shadow-sm"
                  : isToday
                    ? "ring-2 ring-primary-400 font-semibold text-primary-700 dark:text-primary-400"
                    : isDisabled
                      ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      : hasSlots
                        ? "text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 cursor-pointer"
                        : "text-gray-300 dark:text-gray-600"
              )}
              aria-label={`${day}. ${MONTHS_CZ[viewMonth]} ${viewYear}`}
              aria-pressed={isSelected}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
