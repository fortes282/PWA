"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import {
  Mail, MailOpen, Send, Trash2, Plus, ChevronLeft, MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any[]>(url);

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Včera";
  if (days < 7) return date.toLocaleDateString("cs-CZ", { weekday: "short" });
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
}

function ComposeModal({
  contacts,
  onClose,
  onSent,
  replyTo,
}: {
  contacts: any[];
  onClose: () => void;
  onSent: () => void;
  replyTo?: { toUserId: number; toName: string; subject: string; parentId?: number };
}) {
  const shouldReduce = useReducedMotion();
  const [toUserId, setToUserId] = useState<number>(replyTo?.toUserId ?? 0);
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject.replace(/^Re: /, "")}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!toUserId || !subject.trim() || !body.trim()) {
      setError("Vyplňte příjemce, předmět a zprávu.");
      return;
    }
    setSending(true);
    try {
      await api.post("/messages", {
        toUserId,
        subject: subject.trim(),
        body: body.trim(),
        ...(replyTo?.parentId ? { parentId: replyTo.parentId } : {}),
      });
      onSent();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Chyba při odesílání");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={shouldReduce ? {} : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduce ? {} : { opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">
            {replyTo ? "Odpovědět" : "Nová zpráva"}
          </h2>
          <motion.button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl w-8 h-8 flex items-center justify-center rounded-lg"
            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
          >
            ×
          </motion.button>
        </div>
        <div className="p-4 space-y-3">
          {!replyTo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Příjemce</label>
              <select
                value={toUserId}
                onChange={(e) => setToUserId(Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value={0}>— Vyberte příjemce —</option>
                {contacts.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role === "EMPLOYEE" ? "Terapeut" : c.role === "RECEPTION" ? "Recepce" : c.role === "ADMIN" ? "Admin" : c.role})
                  </option>
                ))}
              </select>
            </div>
          )}
          {replyTo && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Komu: <span className="font-medium text-gray-800 dark:text-gray-200">{replyTo.toName}</span>
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Předmět</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Předmět zprávy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zpráva</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Napište zprávu..."
            />
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <motion.button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            Zrušit
          </motion.button>
          <motion.button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            <Send size={14} />
            {sending ? "Odesílám…" : "Odeslat"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MessageDetail({
  msg,
  onBack,
  onReply,
  onDelete,
}: {
  msg: any;
  onBack: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      key={msg.id}
      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <motion.button
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          whileTap={shouldReduce ? undefined : { scale: 0.92 }}
        >
          <ChevronLeft size={20} />
        </motion.button>
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex-1 truncate">{msg.subject}</h2>
        <motion.button
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1"
          title="Smazat zprávu"
          whileTap={shouldReduce ? undefined : { scale: 0.9 }}
        >
          <Trash2 size={16} />
        </motion.button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{msg.from?.name ?? "Neznámý"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">→ {msg.to?.name ?? "Neznámý"}</p>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(msg.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.body}</p>
        </motion.div>

        {msg.replies?.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Odpovědi</p>
            {msg.replies.map((r: any, i: number) => (
              <motion.div
                key={r.id}
                initial={shouldReduce ? {} : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.08 + i * 0.04 }}
                className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 p-4 ml-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">{r.fromUserId === msg.from?.id ? msg.from?.name : msg.to?.name}</p>
                  <span className="text-xs text-blue-400 dark:text-blue-500">{formatDate(r.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{r.body}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <motion.button
          onClick={onReply}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
          whileTap={shouldReduce ? undefined : { scale: 0.98 }}
        >
          <MessageSquare size={16} />
          Odpovědět
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function MessagesPage() {
  const shouldReduce = useReducedMotion();
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);

  const { data: messages, mutate } = useSWR(`/messages?folder=${folder}`, fetcher, {
    refreshInterval: 30000,
  });
  const { data: contacts } = useSWR("/messages/contacts", (u) => api.get<any[]>(u));
  const { data: unreadCount } = useSWR("/messages/unread-count", (u) => api.get<{ count: number }>(u));

  const handleSelectMsg = async (msg: any) => {
    try {
      const detail = await api.get<any>(`/messages/${msg.id}`);
      setSelectedMsg(detail);
      mutate();
    } catch {
      setSelectedMsg(msg);
    }
  };

  const handleDelete = async () => {
    if (!selectedMsg) return;
    await api.delete(`/messages/${selectedMsg.id}`);
    setSelectedMsg(null);
    mutate();
  };

  const handleReply = () => {
    if (!selectedMsg) return;
    setReplyTo({
      toUserId: selectedMsg.fromUserId,
      toName: selectedMsg.from?.name ?? "",
      subject: selectedMsg.subject,
      parentId: selectedMsg.id,
    });
    setComposing(true);
  };

  return (
    <RouteGuard allowedRoles={["CLIENT", "EMPLOYEE", "RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="h-full flex flex-col">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <div className="flex items-center gap-3">
              <Mail className="text-blue-600 dark:text-blue-400" size={22} />
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Zprávy</h1>
              <AnimatePresence>
                {unreadCount && unreadCount.count > 0 && (
                  <motion.span
                    key="unread-badge"
                    initial={shouldReduce ? {} : { opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={shouldReduce ? {} : { opacity: 0, scale: 0.7 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5"
                  >
                    {unreadCount.count}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <motion.button
              onClick={() => { setReplyTo(null); setComposing(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <Plus size={16} />
              Nová zpráva
            </motion.button>
          </motion.div>

          {/* Folder tabs */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            {(["inbox", "sent"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFolder(f); setSelectedMsg(null); }}
                className="relative flex-1 py-2 text-sm font-medium transition-colors"
              >
                <span className={folder === f ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}>
                  {f === "inbox" ? "Doručené" : "Odeslané"}
                </span>
                {folder === f && (
                  <motion.div
                    layoutId="folder-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </motion.div>

          <div className="flex-1 flex overflow-hidden">
            {/* Message list */}
            <div className={`${selectedMsg ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-auto`}>
              {!messages ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400 gap-2"
                >
                  <MailOpen size={32} />
                  <p className="text-sm">Žádné zprávy</p>
                </motion.div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {messages.map((msg: any, i: number) => (
                    <motion.button
                      key={msg.id}
                      onClick={() => handleSelectMsg(msg)}
                      initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.03 }}
                      whileTap={shouldReduce ? undefined : { scale: 0.99 }}
                      className={`w-full text-left p-4 hover:bg-white dark:hover:bg-gray-800 transition-colors ${selectedMsg?.id === msg.id ? "bg-white dark:bg-gray-800 border-r-2 border-blue-600 dark:border-blue-400" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <AnimatePresence>
                            {!msg.isRead && folder === "inbox" && (
                              <motion.span
                                key={`dot-${msg.id}`}
                                initial={shouldReduce ? {} : { opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={shouldReduce ? {} : { opacity: 0, scale: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                                className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0"
                              />
                            )}
                          </AnimatePresence>
                          <p className={`text-sm truncate ${!msg.isRead && folder === "inbox" ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}>
                            {folder === "inbox" ? (msg.from?.name ?? "Neznámý") : (msg.to?.name ?? "Neznámý")}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{formatDate(msg.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{msg.subject}</p>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Message detail */}
            <div className={`${selectedMsg ? "flex" : "hidden md:flex"} flex-1 flex-col bg-gray-50 dark:bg-gray-900/30`}>
              <AnimatePresence mode="wait">
                {selectedMsg ? (
                  <MessageDetail
                    key={selectedMsg.id}
                    msg={selectedMsg}
                    onBack={() => setSelectedMsg(null)}
                    onReply={handleReply}
                    onDelete={handleDelete}
                  />
                ) : (
                  <motion.div
                    key="empty-detail"
                    initial={shouldReduce ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={shouldReduce ? {} : { opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-400 gap-3"
                  >
                    <MessageSquare size={40} />
                    <p className="text-sm">Vyberte zprávu ze seznamu</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {composing && (
            <ComposeModal
              key="compose"
              contacts={contacts ?? []}
              onClose={() => { setComposing(false); setReplyTo(null); }}
              onSent={() => mutate()}
              replyTo={replyTo}
            />
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
