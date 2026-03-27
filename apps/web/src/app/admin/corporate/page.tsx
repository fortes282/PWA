"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Building2, Plus, X, ChevronDown, Users, Mail, Phone } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  INACTIVE: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  SUSPENDED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktivní",
  INACTIVE: "Neaktivní",
  SUSPENDED: "Pozastaveno",
};

export default function AdminCorporate() {
  const shouldReduce = useReducedMotion();
  const { data: companies, mutate } = useSWR("/corporate/companies", fetcher);
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [ico, setIco] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setName("");
    setIco("");
    setContactEmail("");
    setContactPhone("");
    setAddress("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ico || !contactEmail) return;
    setSubmitting(true);
    try {
      await api.post("/corporate/companies", {
        name,
        ico,
        contactEmail,
        contactPhone: contactPhone || undefined,
        address: address || undefined,
        notes: notes || undefined,
      });
      toast("success", "Firma byla vytvořena.");
      resetForm();
      setShowForm(false);
      mutate();
    } catch {
      toast("error", "Chyba při vytváření firmy.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = (id: number) => {
    haptics.light();
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Building2 size={24} className="text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Firemní wellness</h1>
            </div>
            <motion.button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors min-h-[44px] text-sm font-medium"
              whileTap={shouldReduce ? undefined : { scale: 0.95 }}
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Zavřít" : "Nová firma"}
            </motion.button>
          </motion.div>

          {/* Create form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                key="company-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card"
              >
                <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Nová firma</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Název firmy *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        IČO *
                      </label>
                      <input
                        type="text"
                        value={ico}
                        onChange={(e) => setIco(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kontaktní e-mail *
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kontaktní telefon
                      </label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Adresa
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Poznámky
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Interní poznámky o firmě..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={submitting || !name || !ico || !contactEmail}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors min-h-[44px] text-sm font-medium"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    {submitting ? "Vytvářím..." : "Vytvořit firmu"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Company list */}
          <AnimatePresence mode="wait">
            {!companies ? (
              <motion.p
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Načítám firmy...
              </motion.p>
            ) : companies.length === 0 ? (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card text-center py-8"
              >
                <Building2 size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Zatím nejsou registrovány žádné firmy</p>
              </motion.div>
            ) : (
              <motion.div
                key="company-list"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {companies.map((company: any, i: number) => (
                  <motion.div
                    key={company.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className="card"
                  >
                    <motion.button
                      onClick={() => toggleExpand(company.id)}
                      className="w-full text-left"
                      whileTap={shouldReduce ? undefined : { scale: 0.99 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{company.name}</h3>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[company.status] ?? STATUS_BADGE.INACTIVE}`}>
                              {STATUS_LABEL[company.status] ?? company.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                            <span>IČO: {company.ico}</span>
                            <span className="flex items-center gap-1">
                              <Mail size={12} />
                              {company.contactEmail}
                            </span>
                            {company.employeeCount != null && (
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                {company.employeeCount} zaměstnanců
                              </span>
                            )}
                          </div>
                          {company.creditBalance != null && (
                            <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-1">
                              Kredit: {Number(company.creditBalance).toLocaleString("cs-CZ")} Kč
                            </p>
                          )}
                        </div>
                        <motion.span
                          animate={shouldReduce ? {} : { rotate: expandedId === company.id ? 180 : 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1"
                        >
                          <ChevronDown size={18} />
                        </motion.span>
                      </div>
                    </motion.button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {expandedId === company.id && (
                        <CompanyDetail companyId={company.id} shouldReduce={shouldReduce} />
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}

function CompanyDetail({ companyId, shouldReduce }: { companyId: number; shouldReduce: boolean | null }) {
  const { data: employees } = useSWR(`/corporate/companies/${companyId}/employees`, (url: string) => api.get<any[]>(url));

  return (
    <motion.div
      key="detail"
      initial={shouldReduce ? {} : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={shouldReduce ? {} : { opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="overflow-hidden"
    >
      <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-gray-500 dark:text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Zaměstnanci</h4>
        </div>
        {!employees ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Načítám...</p>
        ) : employees.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Žádní registrovaní zaměstnanci</p>
        ) : (
          <div className="space-y-2">
            {employees.map((emp: any, i: number) => (
              <motion.div
                key={emp.id}
                initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.03 }}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{emp.name}</p>
                  {emp.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{emp.email}</p>
                  )}
                </div>
                {emp.phone && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Phone size={12} />
                    {emp.phone}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
