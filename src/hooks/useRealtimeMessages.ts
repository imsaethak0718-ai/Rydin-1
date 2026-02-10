import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  ride_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at?: string;
  sender?: {
    name: string;
  };
}

export const useRealtimeMessages = (
  rideId: string,
  userId: string,
  otherId: string
) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*, profiles:sender_id (name)")
          .eq("ride_id", rideId)
          .or(
            `and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`
          )
          .order("created_at", { ascending: true });

        if (error) throw error;
        setMessages((data || []) as unknown as Message[]);

        // Mark messages as read
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("ride_id", rideId)
          .eq("sender_id", otherId)
          .eq("recipient_id", userId)
          .is("read_at", null);
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages-${rideId}-${userId}-${otherId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          // Only add if it's part of this conversation
          if (
            (newMsg.sender_id === userId && newMsg.recipient_id === otherId) ||
            (newMsg.sender_id === otherId && newMsg.recipient_id === userId)
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [rideId, userId, otherId]);

  return { messages, loading };
};

export const useRealtimeConversations = (userId: string) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select(
            `
            id,
            ride_id,
            sender_id,
            recipient_id,
            content,
            created_at,
            read_at,
            profiles_sender:sender_id (name, avatar_url),
            profiles_recipient:recipient_id (name, avatar_url)
          `
          )
          .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Group by conversation
        const convMap = new Map<string, any>();
        (data || []).forEach((msg: any) => {
          const otherUserId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
          const otherUser =
            msg.sender_id === userId ? msg.profiles_recipient : msg.profiles_sender;
          const key = `${msg.ride_id}-${otherUserId}`;

          if (!convMap.has(key)) {
            convMap.set(key, {
              id: key,
              ride_id: msg.ride_id,
              user_id: userId,
              other_user_id: otherUserId,
              other_user_name: otherUser?.name || "Unknown",
              other_user_avatar: otherUser?.avatar_url,
              last_message: msg.content,
              last_message_time: msg.created_at,
              unread_count: msg.read_at && msg.recipient_id === userId ? 0 : 1,
            });
          }
        });

        setConversations(Array.from(convMap.values()));
      } catch (err) {
        console.error("Error fetching conversations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`conversations-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          // Refetch conversations on new message
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return { conversations, loading };
};
