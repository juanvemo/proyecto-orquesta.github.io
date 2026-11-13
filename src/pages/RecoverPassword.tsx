import { FormEvent, useState } from "react";
import { ArrowLeft, KeyRound, LoaderCircle, MailCheck, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { assetUrl } from "@/lib/assets";
import { getAuthRedirectUrl } from "@/lib/authRedirect";

export default function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [limited, setLimited] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value.includes("@")) { setLimited(true); return; }
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(value, { redirectTo: getAuthRedirectUrl("recovery") });
    setSending(false);
    if (error) { setLimited(true); return; }
    setSent(true);
  };

  return <main className="grid min-h-screen place-items-center bg-[#f6f4fb] p-5 dark:bg-[#0d0b16]"><Card className="w-full max-w-lg overflow-hidden rounded-[2.25rem] border-0 shadow-xl"><div className="bg-[#24163d] p-7 text-white"><img src={assetUrl("/assets/proyecto-orquesta-logo.png")} alt="Proyecto Orquesta" className="h-20 w-auto rounded-xl bg-white p-1" /><p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-violet-200">Acceso seguro</p><h1 className="mt-2 text-3xl font-black">Recupera tu contraseña</h1></div><CardContent className="p-7 sm:p-9">{sent ? <div className="text-center"><MailCheck className="mx-auto size-12 text-emerald-600" /><h2 className="mt-4 text-xl font-black">Revisa tu correo</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Si la cuenta existe y el servicio de correo está disponible, recibirás un enlace que abrirá la página para crear una contraseña nueva.</p><Button asChild className="mt-6 w-full rounded-xl"><Link to="/login">Volver al ingreso</Link></Button></div> : <form onSubmit={submit}><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span><p className="mt-5 text-sm leading-relaxed text-muted-foreground">Escribe el correo real asociado a tu cuenta. Si ingresas mediante un nombre de usuario, administración puede asignarte una nueva contraseña sin utilizar email.</p><div className="mt-6"><Label htmlFor="recovery-email">Correo electrónico</Label><Input id="recovery-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setLimited(false); }} autoComplete="email" className="mt-2 h-12 rounded-xl" required /></div>{limited && <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300"><ShieldAlert className="mb-2 size-5" /><p className="font-black">El correo no está disponible en este momento</p><p className="mt-1 text-xs leading-relaxed">Esto no bloquea solicitudes, cotizaciones ni usuarios nuevos. Pide a administración que te asigne una contraseña temporal desde Usuarios.</p></div>}<Button disabled={sending} className="mt-6 h-12 w-full rounded-xl font-black">{sending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <MailCheck className="mr-2 size-4" />}Enviar enlace</Button><Button asChild variant="ghost" className="mt-2 w-full rounded-xl"><Link to="/login"><ArrowLeft className="mr-2 size-4" />Volver al ingreso</Link></Button></form>}</CardContent></Card></main>;
}
