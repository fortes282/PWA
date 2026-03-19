"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import {
  Mail, MailOpen, Send, Trash2, Plus, ChevronLeft, MessageSquare,
} from "lucide-react";

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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">
            {replyTo ? "Odpovědět" : "Nová zpráva"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {!replyTo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Příjemce</label>
              <select
                value={toUserId}
                onChange={(e) => setToUserId(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
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
            <p className="text-sm text-gray-600">
              Komu: <span className="font-medium">{replyTo.toName}</span>
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Předmět</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Předmět zprávy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zpráva</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Napište zprávu..."
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Zrušit
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={14} />
            {sending ? "Odesílám…" : "Odeslat"}
          </button>
        </div>
      </div>
    </div>
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
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800">
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-semibold text-gray-800 flex-1 truncate">{msg.subject}</h2>
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 p-1"
          title="Smazat zprávu"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{msg.from?.name ?? "Neznámý"}</p>
              <p className="text-xs text-gray-500">→ {msg.to?.name ?? "Neznámý"}</p>
            </div>
            <span className="text-xs text-gray-500">{formatDate(msg.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.body}</p>
        </div>

        {msg.replies?.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Odpovědi</p>
            {msg.replies.map((r: any) => (
              <div key={r.id} className="bg-blue-50 rounded-xl border border-blue-100 p-4 ml-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-blue-800">{r.fromUserId === msg.from?.id ? msg.from?.name : msg.to?.name}</p>
                  <span className="text-xs text-blue-400">{formatDate(r.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-4 border-t bg-white">
        <button
          onClick={onReply}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <MessageSquare size={16} />
          Odpovědět
        </button>
      </div>
    </div>
  );
}

export default function MessagesPage() {
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
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <div className="flex items-center gap-3">
              <Mail className="text-blue-600" size={22} />
              <h1 className="text-lg font-bold text-gray-800">Zprávy</h1>
              {unreadCount && unreadCount.count > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {unreadCount.count}
                </span>
              )}
            </div>
            <button
              onClick={() => { setReplyTo(null); setComposing(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus size={16} />
              Nová zpráva
            </button>
          </div>

          <div className="flex border-b bg-white">
            {(["inbox", "sent"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFolder(f); setSelectedMsg(null); }}
                className={`flex-1 py-2 text-sm font-medium ${folder === f ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                {f === "inbox" ? "Doručené" : "Odeslané"}
              </button>
            ))}
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Message list */}
            <div className={`${selectedMsg ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r bg-gray-50 overflow-auto`}>
              {!messages ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
                  <MailOpen size={32} />
                  <p className="text-sm">Žádné zprávy</p>
                </div>
              ) : (
                <div className="divide-y">
                  {messages.map((msg: any) => (
                    <button
                      key={msg.id}
                      onClick={() => handleSelectMsg(msg)}
                      className={`w-full text-left p-4 hover:bg-white transition-colors ${selectedMsg?.id === msg.id ? "bg-white border-r-2 border-blue-600" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {!msg.isRead && folder === "inbox" && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                          )}
                          <p className={`text-sm truncate ${!msg.isRead && folder === "inbox" ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                            {folder === "inbox" ? (msg.from?.name ?? "Neznámý") : (msg.to?.name ?? "Neznámý")}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(msg.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{msg.subject}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Message detail */}
            <div className={`${selectedMsg ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
              {selectedMsg ? (
                <MessageDetail
                  msg={selectedMsg}
                  onBack={() => setSelectedMsg(null)}
                  onReply={handleReply}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                  <MessageSquare size={40} />
                  <p className="text-sm">Vyberte zprávu ze seznamu</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {composing && (
          <ComposeModal
            contacts={contacts ?? []}
            onClose={() => { setComposing(false); setReplyTo(null); }}
            onSent={() => mutate()}
            replyTo={replyTo}
          />
        )}
      </Layout>
    </RouteGuard>
  );
}
