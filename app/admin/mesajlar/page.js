"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [producers, setProducers] = useState([]);
  const [meId, setMeId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const scrollRef = useRef(null);
  const prevScrollHeight = useRef(0);
  const shouldRestoreScroll = useRef(false);
  const fileInputRef = useRef(null);

  function appendMessage(message) {
    if (!message?.id) return;
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message]
    );
  }

  async function loadConversations() {
    setLoadingConversations(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMeId(user?.id || null);

    const { data: convs } = await supabase
      .from("conversations")
      .select("*, profiles!producer_id(id, full_name, username)")
      .order("last_message_at", { ascending: false, nullsFirst: false });

    const { data: unread } = await supabase
      .from("messages")
      .select("conversation_id, sender_id")
      .is("read_at", null);

    const map = {};
    for (const m of unread || []) {
      const conv = (convs || []).find((c) => c.id === m.conversation_id);
      if (!conv) continue;
      if (m.sender_id !== conv.producer_id) continue;
      map[m.conversation_id] = (map[m.conversation_id] || 0) + 1;
    }

    setConversations(convs || []);
    setUnreadMap(map);
    setLoadingConversations(false);
  }

  async function loadProducersForNew() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .eq("role", "producer")
      .order("full_name", { ascending: true });
    setProducers(data || []);
  }

  useEffect(() => {
    loadConversations();
  }, []);

  // Tüm sohbetler için realtime: liste + okunmamış anlık güncellenir
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-all-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new;
          const selectedId = selected?.id;

          setConversations((prev) => {
            const next = [...prev];
            const idx = next.findIndex((c) => c.id === msg.conversation_id);
            if (idx >= 0) {
              const [conv] = next.splice(idx, 1);
              next.unshift({
                ...conv,
                last_message_at: msg.created_at,
              });
            }
            return next;
          });

          if (selectedId && msg.conversation_id === selectedId) {
            appendMessage(msg);
            if (selected?.producer_id && msg.sender_id === selected.producer_id) {
              markRead(selected);
            }
          } else {
            const { data: conv } = await supabase
              .from("conversations")
              .select("id, producer_id")
              .eq("id", msg.conversation_id)
              .maybeSingle();
            if (conv && msg.sender_id === conv.producer_id) {
              setUnreadMap((prev) => ({
                ...prev,
                [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1,
              }));
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.producer_id]);

  async function markRead(conv) {
    const supabase = createClient();
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conv.id)
      .eq("sender_id", conv.producer_id)
      .is("read_at", null);
    setUnreadMap((prev) => ({ ...prev, [conv.id]: 0 }));
  }

  async function openConversation(conv) {
    setSelected(conv);
    setMessages([]);
    setHasMore(false);
    await loadMessages(conv.id, null, true);
    markRead(conv);
  }

  async function loadMessages(conversationId, before, replace) {
    setLoadingMessages(true);
    const params = new URLSearchParams({ conversationId, limit: "20" });
    if (before) params.set("before", before);
    const res = await fetch(`/api/messages?${params.toString()}`);
    const data = await res.json();
    const batch = data.messages || [];
    if (replace) {
      setMessages(batch);
    } else {
      if (scrollRef.current) {
        prevScrollHeight.current = scrollRef.current.scrollHeight;
        shouldRestoreScroll.current = true;
      }
      setMessages((prev) => [...batch, ...prev]);
    }
    setHasMore(batch.length === 20);
    setLoadingMessages(false);
  }

  useLayoutEffect(() => {
    if (shouldRestoreScroll.current && scrollRef.current) {
      const diff = scrollRef.current.scrollHeight - prevScrollHeight.current;
      scrollRef.current.scrollTop = diff;
      shouldRestoreScroll.current = false;
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length && scrollRef.current && !shouldRestoreScroll.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function onScroll() {
    if (!scrollRef.current || loadingMessages || !hasMore) return;
    if (scrollRef.current.scrollTop < 60) {
      const oldest = messages[0];
      if (oldest) loadMessages(selected.id, oldest.created_at, false);
    }
  }

  async function sendText(e) {
    e.preventDefault();
    if (!text.trim() || !selected) return;
    setSending(true);
    const body = text.trim();
    setText("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.id, body }),
      });
      const data = await res.json();
      if (res.ok) {
        appendMessage(data.message);
        loadConversations();
      }
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file) {
    if (!file || !selected) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "message-images");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selected.id,
          imageUrl: uploadData.url,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        appendMessage(data.message);
        loadConversations();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function startNewConversation(producer) {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("conversations")
      .select("*, profiles!producer_id(id, full_name, username)")
      .eq("producer_id", producer.id)
      .maybeSingle();

    let conv = existing;
    if (!conv) {
      const { data: created } = await supabase
        .from("conversations")
        .insert({ producer_id: producer.id })
        .select("*, profiles!producer_id(id, full_name, username)")
        .single();
      conv = created;
    }
    setNewOpen(false);
    await loadConversations();
    if (conv) openConversation(conv);
  }

  function closeConversation() {
    setSelected(null);
    setMessages([]);
    setText("");
  }

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-white select-none lg:h-[calc(100vh-9.5rem)] lg:flex-none lg:flex-row lg:gap-4 lg:bg-transparent lg:select-auto">
      {/* Üretici listesi — mobilde sohbet açıkken gizlenir */}
      <div
        className={`min-h-0 min-w-0 flex-col border-zinc-200 bg-white lg:max-w-xs lg:rounded-2xl lg:border ${
          selected ? "hidden lg:flex" : "flex"
        } h-full w-full`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="text-lg font-semibold">Mesajlar</h2>
          <button
            type="button"
            onClick={() => {
              setNewOpen(true);
              loadProducersForNew();
            }}
            className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-medium text-white"
          >
            + Yeni Mesaj
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loadingConversations ? (
            <p className="p-4 text-sm text-zinc-500">Yükleniyor...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">Henüz üretici yok</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => openConversation(conv)}
                className={`flex w-full items-center gap-3 border-b border-zinc-50 px-4 py-3.5 text-left hover:bg-orange-50 ${
                  selected?.id === conv.id ? "bg-orange-50" : ""
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
                  {conv.profiles?.full_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">
                    {conv.profiles?.full_name || "Üretici"}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    @{conv.profiles?.username}
                  </p>
                </div>
                {unreadMap[conv.id] ? (
                  <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                    {unreadMap[conv.id]}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Sohbet — mobilde tam ekran */}
      <div
        className={`min-h-0 min-w-0 flex-1 flex-col border-zinc-200 bg-white lg:rounded-2xl lg:border ${
          selected ? "flex" : "hidden lg:flex"
        } h-full w-full`}
      >
        {!selected ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-zinc-500">
            Mesajlaşmak için bir üretici seçin
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-3 py-3">
              <button
                type="button"
                onClick={closeConversation}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-lg text-zinc-600 lg:hidden"
                aria-label="Listeye dön"
              >
                ←
              </button>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
                {selected.profiles?.full_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">
                  {selected.profiles?.full_name}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  @{selected.profiles?.username}
                </p>
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 select-none"
            >
              {loadingMessages && hasMore ? (
                <p className="text-center text-xs text-zinc-400">
                  Eski mesajlar yükleniyor...
                </p>
              ) : null}
              {messages.map((m) => {
                const mine = m.sender_id === meId;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "bg-orange-600 text-white"
                          : "bg-zinc-100 text-zinc-800"
                      }`}
                    >
                      {m.image_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(m.image_url)}
                          className="mb-1 block overflow-hidden rounded-lg text-left"
                        >
                          <Image
                            src={m.image_url}
                            alt="Görsel"
                            width={220}
                            height={220}
                            className="object-cover"
                          />
                        </button>
                      ) : null}
                      {m.body ? (
                        <p className="break-words">{m.body}</p>
                      ) : null}
                      <p
                        className={`mt-1 text-[10px] ${
                          mine ? "text-orange-100" : "text-zinc-400"
                        }`}
                      >
                        {formatDate(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={sendText}
              className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => sendImage(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-zinc-300 p-2.5 text-lg"
                title="Görsel gönder"
              >
                {uploading ? "..." : "+"}
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Mesaj yazın..."
                className="min-w-0 flex-1 select-text rounded-full border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="shrink-0 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                Gönder
              </button>
            </form>
          </>
        )}
      </div>

      {newOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="flex max-h-[85dvh] w-full max-w-sm flex-col rounded-t-3xl bg-white sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-4">
              <h3 className="text-lg font-semibold">Yeni Mesaj</h3>
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500"
              >
                Kapat
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
              {producers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => startNewConversation(p)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left hover:bg-orange-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
                    {p.full_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.full_name}</p>
                    <p className="truncate text-xs text-zinc-500">@{p.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox src={previewUrl} onClose={() => setPreviewUrl("")} />
    </div>
  );
}
