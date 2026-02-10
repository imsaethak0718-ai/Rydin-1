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
    avatar_url?: string;
  };
}

export interface Conversation {
  id: string;
  ride_id: string;
  user_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar?: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

/**
 * Send a message
 */
export const sendMessage = async (
  rideId: string,
  recipientId: string,
  content: string,
  senderId: string
) => {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      ride_id: rideId,
      sender_id: senderId,
      recipient_id: recipientId,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get messages for a ride conversation
 */
export const getMessages = async (
  rideId: string,
  userId: string,
  otherId: string,
  limit = 50
) => {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      ride_id,
      sender_id,
      recipient_id,
      content,
      created_at,
      read_at,
      profiles:sender_id (name, avatar_url)
    `)
    .eq("ride_id", rideId)
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

/**
 * Get all conversations for a user
 */
export const getConversations = async (userId: string) => {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      ride_id,
      sender_id,
      recipient_id,
      content,
      created_at,
      read_at,
      profiles_sender:sender_id (name, avatar_url),
      profiles_recipient:recipient_id (name, avatar_url)
    `)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Group by conversation
  const conversations = new Map<string, any>();

  (data || []).forEach((msg) => {
    const otherUserId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
    const otherUser = msg.sender_id === userId ? msg.profiles_recipient : msg.profiles_sender;
    const key = `${msg.ride_id}-${otherUserId}`;

    if (!conversations.has(key)) {
      conversations.set(key, {
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

  return Array.from(conversations.values());
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (
  rideId: string,
  senderId: string,
  recipientId: string
) => {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("ride_id", rideId)
    .eq("sender_id", senderId)
    .eq("recipient_id", recipientId)
    .is("read_at", null);

  if (error) throw error;
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId: string) => {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId);

  if (error) throw error;
};
