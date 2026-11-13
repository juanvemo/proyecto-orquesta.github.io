import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageCircle, MessagesSquare, Send, Sparkles, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { createCommunityComment, createCommunityPost, deleteChatMessage, deleteCommunityComment, deleteCommunityPost, getCommunityChat, getCommunityFeed, sendChatMessage, type ChatMessage, type CommunityPost } from "@/features/community/service";
import { listMusicians } from "@/features/musicians/service";
import type { Musician } from "@/features/musicians/types";
import { supabase } from "@/integrations/supabase/client";

export default function Community() {
  const { membership, session, user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [musicians, setMusicians] = useState<Musician[]>([]);
  const [postText, setPostText] = useState("");
  const [chatText, setChatText] = useState("");
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!membership) return;
    try {
      const [feed, chat, people] = await Promise.all([getCommunityFeed(membership.organizationId), getCommunityChat(membership.organizationId), listMusicians(membership.organizationId)]);
      setPosts(feed);
      setMessages(chat);
      setMusicians(people.filter((person) => person.status === "ACTIVO"));
    } catch (error) {
      toast.error("No fue posible cargar la comunidad", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [membership]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!membership) return;
    const filter = `organization_id=eq.${membership.organizationId}`;
    const channel = supabase.channel(`community-${membership.organizationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts", filter }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_comments", filter }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_chat_messages", filter }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, membership]);

  if (!membership || !session) return null;

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!postText.trim()) return;
    setPublishing(true);
    try {
      await createCommunityPost(membership.organizationId, session.user.id, postText);
      setPostText("");
      await load();
      toast.success("Publicación compartida");
    } catch (error) { toast.error("No se pudo publicar", { description: error instanceof Error ? error.message : undefined }); }
    finally { setPublishing(false); }
  };

  const comment = async (postId: string) => {
    const content = commentText[postId]?.trim();
    if (!content) return;
    try {
      await createCommunityComment(membership.organizationId, postId, session.user.id, content);
      setCommentText((current) => ({ ...current, [postId]: "" }));
      await load();
    } catch (error) { toast.error("No se pudo comentar", { description: error instanceof Error ? error.message : undefined }); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!chatText.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(membership.organizationId, session.user.id, chatText);
      setChatText("");
      await load();
    } catch (error) { toast.error("No se pudo enviar el mensaje", { description: error instanceof Error ? error.message : undefined }); }
    finally { setSending(false); }
  };

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">Comunidad interna</p><h1 className="mt-2 text-3xl font-black">Entre músicos</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Comparte novedades en el muro o conversa en tiempo real con todos los integrantes aprobados.</p></div><span className="flex w-fit items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-700"><UsersRound className="size-4" /> Espacio privado</span></div>

    <Tabs defaultValue="feed" className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl p-1.5 sm:w-[360px]"><TabsTrigger value="feed" className="rounded-xl py-2.5"><Sparkles className="mr-2 size-4" />Muro</TabsTrigger><TabsTrigger value="chat" className="rounded-xl py-2.5"><MessagesSquare className="mr-2 size-4" />Chat general</TabsTrigger></TabsList>
      <TabsContent value="feed" className="space-y-5">
        <Card className="rounded-[2rem] border-primary/15 shadow-none"><CardContent className="p-5 sm:p-6"><form onSubmit={publish}><div className="flex gap-3"><Avatar name={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`} url={user?.avatarUrl ?? null} /><Textarea value={postText} onChange={(event) => setPostText(event.target.value)} maxLength={5000} placeholder="Comparte una novedad, convocatoria o mensaje para la orquesta…" className="min-h-28 rounded-2xl" /></div><div className="mt-3 flex justify-end"><Button disabled={publishing || !postText.trim()} className="rounded-xl font-black">{publishing ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}Publicar</Button></div></form></CardContent></Card>
        {loading ? <div className="space-y-4"><Skeleton className="h-48 rounded-[2rem]" /><Skeleton className="h-48 rounded-[2rem]" /></div> : posts.length ? posts.map((post) => <Card key={post.id} className="rounded-[2rem] shadow-none"><CardContent className="p-5 sm:p-6"><div className="flex items-start gap-3"><Avatar name={post.author_name} url={post.author_avatar} /><div className="min-w-0 flex-1"><p className="font-black">{post.author_name}</p><p className="text-xs text-muted-foreground">{formatDateTime(post.created_at)}</p></div>{post.user_id === session.user.id && <Button size="icon" variant="ghost" className="rounded-xl text-muted-foreground hover:text-destructive" onClick={() => void deleteCommunityPost(post.id).then(load)} aria-label="Eliminar publicación"><Trash2 className="size-4" /></Button>}</div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p><div className="mt-5 border-t pt-4"><p className="mb-3 flex items-center gap-2 text-xs font-black text-muted-foreground"><MessageCircle className="size-4" />{post.comments.length} comentarios</p><div className="space-y-3">{post.comments.map((item) => <div key={item.id} className="flex gap-2 rounded-2xl bg-muted/45 p-3"><Avatar small name={item.author_name} url={item.author_avatar} /><div className="min-w-0 flex-1"><p className="text-xs font-black">{item.author_name} <span className="ml-1 font-normal text-muted-foreground">{formatDateTime(item.created_at)}</span></p><p className="mt-1 whitespace-pre-wrap text-sm">{item.content}</p></div>{item.user_id === session.user.id && <button onClick={() => void deleteCommunityComment(item.id).then(load)} className="self-start text-muted-foreground hover:text-destructive" aria-label="Eliminar comentario"><Trash2 className="size-3.5" /></button>}</div>)}</div><div className="mt-3 flex gap-2"><Input value={commentText[post.id] ?? ""} onChange={(event) => setCommentText((current) => ({ ...current, [post.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void comment(post.id); } }} maxLength={2000} placeholder="Escribe un comentario…" className="rounded-xl" /><Button size="icon" disabled={!commentText[post.id]?.trim()} onClick={() => void comment(post.id)} className="shrink-0 rounded-xl"><Send className="size-4" /></Button></div></div></CardContent></Card>) : <Empty icon={Sparkles} title="El muro está listo" text="Sé la primera persona en compartir una publicación con la orquesta." />}
      </TabsContent>
      <TabsContent value="chat">
        <Card className="overflow-hidden rounded-[2rem] shadow-none"><CardContent className="p-0"><div className="border-b bg-primary/5 p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><MessagesSquare className="size-5" /></span><div><h2 className="font-black">Chat general</h2><p className="text-xs text-muted-foreground">Visible para todos los usuarios aprobados.</p></div></div></div><div className="h-[min(58vh,600px)] space-y-3 overflow-y-auto p-4 sm:p-5">{loading ? <Skeleton className="h-full rounded-2xl" /> : messages.length ? messages.map((message) => { const own = message.user_id === session.user.id; return <div key={message.id} className={`flex gap-2 ${own ? "justify-end" : "justify-start"}`}>{!own && <Avatar small name={message.author_name} url={message.author_avatar} />}<div className={`max-w-[82%] rounded-2xl px-4 py-3 ${own ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted"}`}><div className="flex items-center gap-2"><p className="text-xs font-black">{own ? "Tú" : message.author_name}</p><span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${availabilityTone(message.author_availability, own)}`}>{message.author_availability}</span><span className={`text-[10px] ${own ? "text-primary-foreground/65" : "text-muted-foreground"}`}>{formatTime(message.created_at)}</span>{own && <button onClick={() => void deleteChatMessage(message.id).then(load)} className="ml-auto opacity-60 hover:opacity-100" aria-label="Eliminar mensaje"><Trash2 className="size-3" /></button>}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p></div></div>; }) : <div className="grid h-full place-items-center"><div className="text-center"><MessagesSquare className="mx-auto size-10 text-primary" /><p className="mt-3 font-black">Inicia la conversación</p><p className="text-sm text-muted-foreground">Envía el primer mensaje al equipo.</p></div></div>}<div ref={chatEndRef} /></div><form onSubmit={sendMessage} className="flex gap-2 border-t p-4"><Input value={chatText} onChange={(event) => setChatText(event.target.value)} maxLength={2000} placeholder="Escribe un mensaje para todos…" className="h-11 rounded-xl" /><Button size="icon" disabled={sending || !chatText.trim()} className="size-11 shrink-0 rounded-xl">{sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}</Button></form></CardContent></Card>
      </TabsContent>
    </Tabs>
  </div>;
}

function Avatar({ name, url, small = false }: { name: string; url: string | null; small?: boolean }) {
  const size = small ? "size-8 rounded-xl text-[10px]" : "size-11 rounded-2xl text-xs";
  return <span className={`grid shrink-0 place-items-center overflow-hidden bg-primary/10 font-black text-primary ${size}`}>{url ? <img src={url} alt="" className="size-full object-cover" /> : initials(name)}</span>;
}
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PO"; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function availabilityTone(status: string, own: boolean) { if (own) return "bg-white/15 text-white"; if (status === "DISPONIBLE") return "bg-emerald-500/15 text-emerald-700"; if (status === "NO DISPONIBLE") return "bg-rose-500/15 text-rose-700"; return "bg-amber-500/15 text-amber-700"; }
function Empty({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) { return <Card className="rounded-[2rem] shadow-none"><CardContent className="p-12 text-center"><Icon className="mx-auto size-10 text-primary" /><h2 className="mt-4 text-xl font-black">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p></CardContent></Card>; }
