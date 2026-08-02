"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";

export default function ProducerMessagesPage() {
  const [conversationId, setConversationId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  async function loadMessages(convId, before, replace) {
    setLoadingMessages(true);
    const params = new URLSearchParams({ conversationId: convId, limit: "20" });
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

  async function markRead(convId, uid) {
    const supabase = createClient();
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", convId)
      .neq("sender_id", uid)
      .is("read_at", null);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      let { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("producer_id", user.id)
        .maybeSingle();

      if (!conv) {
        const { data: created } = await supabase
          .from("conversations")
          .insert({ producer_id: user.id })
          .select("id")
          .single();
        conv = created;
      }

      setConversationId(conv.id);
      await loadMessages(conv.id, null, true);
      await markRead(conv.id, user.id);
      setLoading(false);
    }
    init();
  }, []);

  useLayoutEffect(() => {
    if (shouldRestoreScroll.current && scrollRef.current) {
      const diff = scrollRef.current.scrollHeight - prevScrollHeight.current;
      scrollRef.current.scrollTop = diff;
      shouldRestoreScroll.current = false;
    } else if (scrollRef.current && !loading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (!conversationId || !userId) return undefined;
    const supabase = createClient();
    const channel = supabase
      .channel(`producer-conv-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          appendMessage(payload.new);
          if (payload.new.sender_id !== userId) {
            markRead(conversationId, userId);
          }
        }
      )
      .subscribe((status) => {
        // Bağlantı koptuğunda sessizce yeniden dener
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          supabase.removeChannel(channel);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  function onScroll() {
    if (!scrollRef.current || loadingMessages || !hasMore) return;
    if (scrollRef.current.scrollTop < 60) {
      const oldest = messages[0];
      if (oldest) loadMessages(conversationId, oldest.created_at, false);
    }
  }

  async function sendText(e) {
    e.preventDefault();
    if (!text.trim() || !conversationId) return;
    setSending(true);
    const body = text.trim();
    setText("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });
      const data = await res.json();
      if (res.ok) {
        appendMessage(data.message);
      }
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file) {
    if (!file || !conversationId) return;
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
        body: JSON.stringify({ conversationId, imageUrl: uploadData.url }),
      });
      const data = await res.json();
      if (res.ok) {
        appendMessage(data.message);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <p className="flex flex-1 items-center justify-center text-lg text-zinc-500">
        Yükleniyor...
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white select-none">
      <div className="shrink-0 border-b border-zinc-100 px-4 py-3 select-none">
        <h1 className="text-lg font-semibold">Ontic Destek</h1>
        <p className="text-sm text-zinc-500">Sorularınız için buradan yazın</p>
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
        {messages.length === 0 ? (
          <p className="text-center text-base text-zinc-400">
            Henüz mesaj yok. İlk mesajı siz gönderin!
          </p>
        ) : null}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-base ${
                  mine ? "bg-orange-600 text-white" : "bg-zinc-100 text-zinc-800"
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
                {m.body ? <p className="break-words">{m.body}</p> : null}
                <p
                  className={`mt-1 text-[11px] ${
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
        className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-3 py-2.5"
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
        >
          {uploading ? "..." : "+"}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mesaj yazın..."
          className="flex-1 select-text rounded-full border border-zinc-200 px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-full bg-orange-600 px-4 py-2.5 text-base font-medium text-white disabled:opacity-60"
        >
          Gönder
        </button>
      </form>

      <ImageLightbox src={previewUrl} onClose={() => setPreviewUrl("")} />
    </div>
  );
}
