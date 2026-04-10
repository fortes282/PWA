"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  reception: "Recepce",
  employee: "Terapeut",
  client: "Klient",
  appointments: "Rezervace",
  calendar: "Kalendář",
  clients: "Klienti",
  users: "Uživatelé",
  services: "Služby",
  rooms: "Místnosti",
  stats: "Statistiky",
  background: "Background",
  billing: "Billing",
  settings: "Nastavení",
  reports: "Zprávy",
  credits: "Kredity",
  invoices: "Faktury",
  progress: "Pokrok",
  booking: "Booking",
  waitlist: "Waitlist",
  messages: "Zprávy",
  notifications: "Notifikace",
  colleagues: "Kolegové",
  fio: "FIO",
  audit: "Audit Log",
  "health-records": "Zdravotní záznamy",
  "health-record": "Zdravotní karta",
  "working-hours": "Pracovní hodiny",
  "credit-request": "Žádost o kredit",
  "credit-requests": "Žádosti o kredit",
  "medical-reports": "Lékařské zprávy",
  schedule: "Harmonogram",
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = SEGMENT_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === segments.length - 1;
    return { href, label, isLast, isNumeric: /^\d+$/.test(segment) };
  });

  return (
    <nav aria-label="Breadcrumbs" className="hidden md:flex items-center gap-1 text-sm text-[#46464F] dark:text-gray-400 mb-4">
      <Link
        href="/"
        className="hover:text-primary dark:hover:text-gray-200 transition-colors"
      >
        <Home size={14} />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight size={12} className="text-[#C7C5D1] dark:text-gray-400" />
          {crumb.isLast ? (
            <span className="text-primary dark:text-gray-100 font-medium">
              {crumb.isNumeric ? `#${crumb.label}` : crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-primary dark:hover:text-gray-200 transition-colors"
            >
              {crumb.isNumeric ? `#${crumb.label}` : crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
