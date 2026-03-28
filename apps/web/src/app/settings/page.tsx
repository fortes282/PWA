"use client";

import Image from "next/image";
import Link from "next/link";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Bell, ChevronRight } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28, delay: i * 0.07 },
  }),
};

const fetcher = (url: string) => api.get<any>(url);

export default function SettingsPage() {
  const shouldReduce = useReducedMotion();
  const { user, refreshUser } = useAuth();
  const { data: me, mutate } = useSWR(user ? `/users/${user.id}` : null, fetcher);

  // Profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Vyberte prosím obrázek (JPEG, PNG, WebP)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Obrázek je příliš velký (max 2 MB)");
      return;
    }
    setAvatarError(null);
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const avatar = reader.result as string;
        await api.patch("/users/me/avatar", { avatar });
        await mutate();
        await refreshUser();
      } catch (err: any) {
        setAvatarError(err?.message ?? "Chyba při nahrávání obrázku");
      } finally {
        setAvatarUploading(false);
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await api.delete("/users/me/avatar");
      await mutate();
      await refreshUser();
    } catch (err: any) {
      setAvatarError(err?.message ?? "Chyba");
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setPhone(me.phone ?? "");
    }
  }, [me]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError(null);
    try {
      await api.patch(`/users/${user!.id}`, {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      await mutate();
      await refreshUser();
      haptics.success();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      haptics.error();
      setProfileError(err?.message ?? "Chyba při ukládání");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <RouteGuard>
      <Layout>
        <div className="max-w-md mx-auto space-y-4">
          {/* Page header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3">
              <img src="/brand/mascot-happy.svg" alt="" className="w-12 h-12" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nastavení</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Profil, notifikace a zabezpečení</p>
              </div>
            </div>
          </motion.div>

          {/* Profile edit */}
          <motion.form
            custom={0}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
            onSubmit={handleSaveProfile}
            className="card space-y-4"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Profil</h2>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {me?.avatarUrl ? (
                  <Image
                    src={`${process.env.NEXT_PUBLIC_API_URL || "/api"}${me.avatarUrl}`}
                    alt="Avatar"
                    width={64}
                    height={64}
                    unoptimized
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {(me?.name || user?.name || "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 rounded-full flex items-center justify-center">
                    <motion.div
                      animate={shouldReduce ? {} : { rotate: 360 }}
                      transition={shouldReduce ? { duration: 0 } : { repeat: Infinity, duration: 0.8, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-600 dark:border-primary-400 border-t-transparent rounded-full"
                    />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-input"
                />
                <div className="flex gap-2">
                  <label
                    htmlFor="avatar-input"
                    className="text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 rounded-lg cursor-pointer transition"
                  >
                    {me?.avatarUrl ? "Změnit foto" : "Nahrát foto"}
                  </label>
                  {me?.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleAvatarRemove}
                      disabled={avatarUploading}
                      className="text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      Odstranit
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {avatarError && (
                    <motion.p
                      initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="text-xs text-red-500 dark:text-red-400 mt-1"
                    >
                      {avatarError}
                    </motion.p>
                  )}
                </AnimatePresence>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max 2 MB · JPEG, PNG, WebP</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
              <p><span className="font-medium text-gray-700 dark:text-gray-200">Email:</span> {user?.email}</p>
              <p><span className="font-medium text-gray-700 dark:text-gray-200">Role:</span> {user?.role}</p>
            </div>

            <div>
              <label className="label dark:text-gray-300" htmlFor="profile-name">Jméno</label>
              <input
                id="profile-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vaše celé jméno"
                minLength={2}
                required
              />
            </div>

            <div>
              <label className="label dark:text-gray-300">Telefon</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+420 123 456 789"
                type="tel"
              />
            </div>

            <AnimatePresence>
              {profileSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-green-700 dark:text-green-300 text-sm"
                >
                  Profil uložen ✓
                </motion.div>
              )}
              {profileError && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm"
                >
                  {profileError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={profileSaving}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn-primary w-full"
            >
              {profileSaving ? "Ukládám…" : "Uložit profil"}
            </motion.button>
          </motion.form>

          {/* Navigation to sub-pages */}
          <motion.div
            custom={1}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
            className="card space-y-1"
          >
            <motion.div whileTap={shouldReduce ? undefined : { scale: 0.98 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
              <Link
                href="/settings/security"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition -mx-1"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="text-blue-600 dark:text-blue-400" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Zabezpečení</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Změna hesla, dvoufaktorové ověření</p>
                </div>
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              </Link>
            </motion.div>

            <motion.div whileTap={shouldReduce ? undefined : { scale: 0.98 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
              <Link
                href="/settings/notifications"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition -mx-1"
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Bell className="text-amber-600 dark:text-amber-400" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Notifikace</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email, SMS a push notifikace</p>
                </div>
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
