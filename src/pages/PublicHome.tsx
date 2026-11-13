import { useEffect, useState } from "react";
import { ArrowRight, CalendarCheck2, CheckCircle2, Facebook, Instagram, Music2, ShieldCheck, Sparkles, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { assetUrl } from "@/lib/assets";

type PublicIdentity = { name: string; logo_url: string | null; social_links: Record<string, string> };

export default function PublicHome() {
  const [identity, setIdentity] = useState<PublicIdentity | null>(null);

  useEffect(() => {
    supabase.rpc("get_public_organization_identity").then(({ data }) => {
      if (data) setIdentity(data as PublicIdentity);
    });
  }, []);

  const links = identity?.social_links ?? {};
  const social = [
    { key: "facebook", label: "Facebook", icon: Facebook },
    { key: "instagram", label: "Instagram", icon: Instagram },
    { key: "youtube", label: "YouTube", icon: Youtube },
    { key: "tiktok", label: "TikTok", icon: Music2 },
  ].filter((item) => safeSocialUrl(links[item.key]));

  return <main className="min-h-screen bg-[#f6f4fb] text-[#211b31] dark:bg-[#0d0b16] dark:text-white">
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5">
      <img src={identity?.logo_url || assetUrl("/assets/proyecto-orquesta-logo.png")} alt={identity?.name || "Proyecto Orquesta"} className="h-16 w-auto" />
      <div className="flex items-center gap-2">
        {social.length > 0 && <nav aria-label="Redes sociales" className="mr-1 flex items-center gap-1 border-r pr-2">{social.map(({ key, label, icon: Icon }) => <a key={key} href={safeSocialUrl(links[key])!} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"><Icon className="size-5" /></a>)}</nav>}
        <Button asChild variant="ghost" className="rounded-xl"><Link to="/login">Ingresar</Link></Button>
        <Button asChild className="rounded-xl font-black"><Link to="/solicitar-cotizacion">Cotizar</Link></Button>
      </div>
    </header>
    <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-16 pt-8 lg:grid-cols-[1fr_.9fr] lg:items-center lg:py-20">
      <div><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary"><Sparkles className="size-4" /> Música en vivo para momentos memorables</span><h1 className="mt-6 text-5xl font-black leading-[.98] tracking-tight sm:text-6xl xl:text-7xl">Tu evento merece sonar extraordinario.</h1><p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">Cuéntanos lo que imaginas. Proyecto Orquesta revisará la fecha, el formato musical y la producción para preparar una propuesta hecha a tu medida.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="h-14 rounded-2xl px-7 text-base font-black"><Link to="/solicitar-cotizacion">COTIZA TU EVENTO <ArrowRight className="ml-2 size-5" /></Link></Button><Button asChild size="lg" variant="outline" className="h-14 rounded-2xl px-7"><Link to="/login">Portal Proyecto Orquesta</Link></Button></div><div className="mt-9 grid gap-3 sm:grid-cols-3"><Trust icon={Music2} text="Formato personalizado" /><Trust icon={CalendarCheck2} text="Fecha verificada" /><Trust icon={ShieldCheck} text="Solicitud segura" /></div></div>
      <div className="relative overflow-hidden rounded-[2.5rem]"><img src={assetUrl("/assets/orquesta-stage-hero.png")} alt="Proyecto Orquesta en concierto" className="aspect-[4/5] w-full object-cover lg:aspect-[5/6]" /><div className="absolute inset-x-5 bottom-5 rounded-3xl bg-white/90 p-5 text-[#211b31] shadow-xl backdrop-blur"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-5" /></span><div><p className="font-black">Solicitud en pocos minutos</p><p className="text-sm text-slate-600">Sin cuenta y sin comprometer tu fecha.</p></div></div></div></div>
    </section>
  </main>;
}

function safeSocialUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function Trust({ icon: Icon, text }: { icon: typeof Music2; text: string }) {
  return <span className="flex items-center gap-2 text-sm font-bold"><Icon className="size-4 text-primary" />{text}</span>;
}
