import { supabase } from "@/integrations/supabase/client";

export type CommunityComment = { id: string; user_id: string; content: string; created_at: string; author_name: string; author_avatar: string | null };
export type CommunityPost = { id: string; user_id: string; content: string; created_at: string; author_name: string; author_avatar: string | null; comments: CommunityComment[] };
export type ChatMessage = { id: string; user_id: string; message: string; created_at: string; author_name: string; author_avatar: string | null; author_availability: string };

export async function getCommunityFeed(organizationId: string) {
  const { data, error } = await supabase.rpc("get_community_feed", { target_organization_id: organizationId });
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

export async function getCommunityChat(organizationId: string) {
  const { data, error } = await supabase.rpc("get_community_chat", { target_organization_id: organizationId });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function createCommunityPost(organizationId: string, userId: string, content: string) {
  const { error } = await supabase.from("community_posts").insert({ organization_id: organizationId, user_id: userId, content: content.trim() });
  if (error) throw error;
}

export async function deleteCommunityPost(postId: string) {
  const { error } = await supabase.from("community_posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function createCommunityComment(organizationId: string, postId: string, userId: string, content: string) {
  const { error } = await supabase.from("community_post_comments").insert({ organization_id: organizationId, post_id: postId, user_id: userId, content: content.trim() });
  if (error) throw error;
}

export async function deleteCommunityComment(commentId: string) {
  const { error } = await supabase.from("community_post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function sendChatMessage(organizationId: string, userId: string, message: string) {
  const { error } = await supabase.from("community_chat_messages").insert({ organization_id: organizationId, user_id: userId, message: message.trim() });
  if (error) throw error;
}

export async function deleteChatMessage(messageId: string) {
  const { error } = await supabase.from("community_chat_messages").delete().eq("id", messageId);
  if (error) throw error;
}
