import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LogIn, Music2, ShieldCheck, UserRound } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { assetUrl } from "@/lib/assets";

const USERNAME_DOMAIN = "usuarios.proyecto-orquesta.local";

export default function Login() {
  const { session, user, membership, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && session && membership?.approvalStatus === "PENDING") navigate("/acceso-pendiente", { replace: true });
  }, [loading, session, membership, navigate]);

  if (!loading && session && membership?.approvalStatus === "APPROVED") return <Navigate to={user?.profileComplete ? "/" : "/completar-perfil"} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = identifier.trim().toLowerCase();
    if (!value || password.length < 8) { toast.error("Escribe tu correo o usuario y una contraseña válida"); return; }
    const email = value.includes("@") ? value : `${value}@${USERNAME_DOMAIN}`;
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSigningIn(false);
    if (error) toast.error("No fue posible ingresar", { description: "Revisa el correo o usuario y la contraseña." });
  };

  return <main className="min-h-screen bg-[#f6f4fb] p-3 dark:bg-[#0d0b16] sm:p-5"><div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] overflow-hidden rounded-[2rem] border border-white/70 bg-background shadow-2xl shadow-violet-950/10 dark:border-white/10 lg:grid-cols-[1.08fr_.92fr]"><section className="relative hidden overflow-hidden lg:block"><img src={assetUrl("/assets/orquesta-stage-hero.png")} alt="Orquesta tropical en escenario" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-[#151029]/45" /><div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14"><div className="w-fit rounded-2xl bg-white/90 p-3 shadow-xl backdrop-blur"><img src={assetUrl("/assets/proyecto-orquesta-logo.png")} alt="Proyecto Orquesta" className="h-20 w-auto" /></div><div className="max-w-xl text-white"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur"><Music2 className="size-4 text-violet-300" /> El sistema operativo de tu orquesta</div><h1 className="text-4xl font-black leading-[1.05] tracking-tight xl:text-6xl">Toda la operación.<br />Un mismo compás.</h1><p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 xl:text-lg">Dirección artística, administración, producción y finanzas conectadas en una plataforma profesional.</p><Button asChild className="mt-7 h-12 rounded-xl bg-white px-6 font-black text-primary hover:bg-white/90"><Link to="/solicitar-cotizacion">COTIZA TU EVENTO <ArrowRight className="ml-2 size-4" /></Link></Button><div className="mt-8 flex gap-6 text-sm text-white/80"><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-violet-300" /> Usuarios administrados</span><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-violet-300" /> Acceso por roles</span></div></div></div></section><section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14"><div className="w-full max-w-lg"><img src={assetUrl("/assets/proyecto-orquesta-logo.png")} alt="Proyecto Orquesta" className="mx-auto mb-5 h-24 w-auto lg:hidden" /><Button asChild className="mb-8 h-12 w-full rounded-xl font-black lg:hidden"><Link to="/solicitar-cotizacion">COTIZA TU EVENTO <ArrowRight className="ml-2 size-4" /></Link></Button><div className="mb-8"><p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-primary">Portal Proyecto Orquesta</p><h2 className="text-3xl font-black tracking-tight sm:text-4xl">Bienvenido al escenario</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Ingresa con el correo o nombre de usuario que te entregó la administración.</p></div><form onSubmit={submit} className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7"><span className="mb-6 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LogIn className="size-5" /></span><div><Label htmlFor="login-identifier">Correo o usuario</Label><div className="relative mt-2"><UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" className="h-12 rounded-xl pl-9" placeholder="correo@dominio.com o usuario" required /></div></div><div className="mt-5"><Label htmlFor="login-password">Contraseña</Label><div className="relative mt-2"><KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" minLength={8} className="h-12 rounded-xl px-9" required /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Mostrar contraseña">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div><Button disabled={signingIn} className="mt-6 h-12 w-full rounded-xl font-black">{signingIn ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}Ingresar</Button><div className="mt-5 text-center"><Link to="/recuperar-clave" className="text-sm font-bold text-primary hover:underline">¿Olvidaste tu contraseña?</Link></div><p className="mt-6 rounded-2xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">Las cuentas son creadas por administración. En tu primer acceso completarás de forma segura tus datos personales y musicales.</p></form><p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> Acceso protegido y aislado por organización</p></div></section></div></main>;
}
