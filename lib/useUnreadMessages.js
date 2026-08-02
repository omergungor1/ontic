"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Okunmamış mesaj sayacı + realtime.
 * role: 'producer' | 'admin'
 * clearOnPath: bu path'teyken badge kapanır (mesajlar sayfası)
 */
export function useUnreadMessages({ role, clearOnPath, pathname }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel = null;
    let cancelled = false;
    let userId = null;
    let conversationId = null; // producer only

    async function refresh() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      userId = user.id;

      if (role === "producer") {
        if (pathname?.startsWith(clearOnPath)) {
          setUnreadCount(0);
          // sayfadayken okundu işaretle
          if (conversationId) {
            await supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("conversation_id", conversationId)
              .neq("sender_id", user.id)
              .is("read_at", null);
          }
          return;
        }

        if (!conversationId) {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("producer_id", user.id)
            .maybeSingle();
          conversationId = conv?.id || null;
        }
        if (!conversationId) {
          setUnreadCount(0);
          return;
        }

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
          .neq("sender_id", user.id)
          .is("read_at", null);
        if (!cancelled) setUnreadCount(count || 0);
        return;
      }

      // admin: üreticiden gelen okunmamışlar
      if (pathname?.startsWith(clearOnPath)) {
        // mesajlar sayfasındayken badge'i tamamen sıfırlamıyoruz;
        // sadece seçili sohbet okununca düşecek. Genel sayıyı yenile.
      }

      const { data: convs } = await supabase
        .from("conversations")
        .select("id, producer_id");
      if (!convs?.length) {
        if (!cancelled) setUnreadCount(0);
        return;
      }

      const { data: unread } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id")
        .is("read_at", null);

      let total = 0;
      for (const m of unread || []) {
        const conv = convs.find((c) => c.id === m.conversation_id);
        if (conv && m.sender_id === conv.producer_id) total += 1;
      }
      if (!cancelled) setUnreadCount(total);
    }

    async function init() {
      await refresh();
      if (cancelled) return;

      channel = supabase
        .channel(`unread-${role}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const msg = payload.new;
            if (!userId) return;

            if (role === "producer") {
              if (conversationId && msg.conversation_id !== conversationId) {
                return;
              }
              if (msg.sender_id === userId) return;
              if (pathname?.startsWith(clearOnPath)) {
                await supabase
                  .from("messages")
                  .update({ read_at: new Date().toISOString() })
                  .eq("id", msg.id);
                setUnreadCount(0);
              } else {
                setUnreadCount((c) => c + 1);
              }
              return;
            }

            // admin: üreticiden gelen
            const { data: conv } = await supabase
              .from("conversations")
              .select("producer_id")
              .eq("id", msg.conversation_id)
              .maybeSingle();
            if (conv && msg.sender_id === conv.producer_id) {
              setUnreadCount((c) => c + 1);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            // okundu işaretlenince yenile
            if (payload.new?.read_at && !payload.old?.read_at) {
              refresh();
            }
          }
        )
        .subscribe();

      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [role, clearOnPath, pathname]);

  return { unreadCount, hasUnread: unreadCount > 0, ready };
}
