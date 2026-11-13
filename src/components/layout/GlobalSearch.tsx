import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Music2, Search, Sparkles, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { navigationGroups } from "@/config/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type MusicianResult = { id: string; first_name: string; last_name: string; specialty: string | null };
type RehearsalResult = { id: string; name: string; rehearsal_date: string; location: string };
type SongResult = { id: string; name: string; original_artist: string | null; musical_key: string | null };

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [musicians, setMusicians] = useState<MusicianResult[]>([]);
  const [rehearsals, setRehearsals] = useState<RehearsalResult[]>([]);
  const [songs, setSongs] = useState<SongResult[]>([]);
  const navigate = useNavigate();
  const { membership, hasPermission } = useAuth();

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || query.trim().length < 2 || !membership) { setMusicians([]); setRehearsals([]); setSongs([]); return; }
    const term = query.trim().replace(/[,%()]/g, "");
    const timeout = window.setTimeout(() => {
      if (hasPermission("musicians.view")) supabase.from("musicians").select("id,first_name,last_name,specialty").eq("organization_id", membership.organizationId).or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,specialty.ilike.%${term}%`).limit(6).then(({ data }) => setMusicians((data ?? []) as MusicianResult[]));
      else setMusicians([]);
      if (hasPermission("rehearsals.view")) supabase.from("rehearsals").select("id,name,rehearsal_date,location").eq("organization_id", membership.organizationId).or(`name.ilike.%${term}%,location.ilike.%${term}%,objective.ilike.%${term}%`).limit(6).then(({ data }) => setRehearsals((data ?? []) as RehearsalResult[]));
      else setRehearsals([]);
      if (hasPermission("repertoire.view")) supabase.from("songs").select("id,name,original_artist,musical_key").eq("organization_id", membership.organizationId).or(`name.ilike.%${term}%,original_artist.ilike.%${term}%,composer.ilike.%${term}%`).limit(6).then(({ data }) => setSongs((data ?? []) as SongResult[]));
      else setSongs([]);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [open, query, membership, hasPermission]);

  const items = useMemo(() => navigationGroups.flatMap((group) => group.items)
    .filter((item) => (!item.permission || hasPermission(item.permission)) && (!item.anyPermission || item.anyPermission.some(hasPermission)))
    .filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query, hasPermission]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] translate-y-0 gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        <div className="flex items-center border-b px-5">
          <Search className="size-5 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en Portal Proyecto Orquesta…" className="h-16 border-0 bg-transparent text-base shadow-none focus-visible:ring-0" />
          <kbd className="rounded-lg border bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Accesos disponibles</p>
          {items.map((item) => (
            <button key={item.path} onClick={() => { navigate(item.path); onOpenChange(false); setQuery(""); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-primary/10">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon className="size-5" /></span>
              <span className="font-semibold">{item.label}</span>
            </button>
          ))}
          {musicians.length > 0 && <><p className="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Músicos</p>{musicians.map((musician) => <button key={musician.id} onClick={() => { navigate(`/musicos/${musician.id}`); onOpenChange(false); setQuery(""); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-primary/10"><span className="grid size-10 place-items-center rounded-xl bg-orange-500/10 text-orange-600"><UserRound className="size-5" /></span><span><span className="block font-semibold">{musician.first_name} {musician.last_name}</span><span className="block text-xs text-muted-foreground">{musician.specialty || "Músico"}</span></span></button>)}</>}
          {rehearsals.length > 0 && <><p className="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Ensayos</p>{rehearsals.map((rehearsal) => <button key={rehearsal.id} onClick={() => { navigate(`/ensayos/${rehearsal.id}`); onOpenChange(false); setQuery(""); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-primary/10"><span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600"><CalendarClock className="size-5" /></span><span><span className="block font-semibold">{rehearsal.name}</span><span className="block text-xs text-muted-foreground">{rehearsal.rehearsal_date} · {rehearsal.location}</span></span></button>)}</>}
          {songs.length > 0 && <><p className="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Canciones</p>{songs.map((song) => <button key={song.id} onClick={() => { navigate(`/repertorio?cancion=${song.id}`); onOpenChange(false); setQuery(""); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-primary/10"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-600"><Music2 className="size-5" /></span><span><span className="block font-semibold">{song.name}</span><span className="block text-xs text-muted-foreground">{song.original_artist || "Sin artista"} · {song.musical_key || "Sin tono"}</span></span></button>)}</>}
          {!items.length && !musicians.length && !rehearsals.length && !songs.length && <div className="py-10 text-center"><Sparkles className="mx-auto size-7 text-primary" /><p className="mt-3 font-semibold">Sin resultados</p><p className="text-sm text-muted-foreground">Busca por nombre, canción, ensayo o módulo.</p></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
