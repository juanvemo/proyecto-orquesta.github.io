import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function AuthRedirectGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const action = new URLSearchParams(window.location.search).get("auth_action");
  const [sessionCheckFinished, setSessionCheckFinished] = useState(false);

  useEffect(() => {
    if (action !== "confirm" && action !== "recovery") return;
    if (session) {
      setSessionCheckFinished(true);
      return;
    }
    const timeout = window.setTimeout(() => setSessionCheckFinished(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [action, session]);

  useEffect(() => {
    if (loading || !sessionCheckFinished || (action !== "confirm" && action !== "recovery")) return;

    window.history.replaceState({}, "", window.location.pathname);
    if (!session) {
      sessionStorage.removeItem("password-recovery-active");
      navigate(action === "recovery" ? "/actualizar-clave" : "/login", { replace: true });
      return;
    }

    if (action === "recovery") {
      sessionStorage.setItem("password-recovery-active", "true");
      navigate("/actualizar-clave", { replace: true });
      return;
    }

    navigate("/correo-confirmado", { replace: true });
  }, [action, loading, navigate, session, sessionCheckFinished]);

  if (action === "confirm" || action === "recovery") {
    return <main className="grid min-h-screen place-items-center bg-[#f6f4fb] dark:bg-[#0d0b16]"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-primary" /><p className="mt-4 text-sm font-semibold text-muted-foreground">Validando el enlace seguro…</p></div></main>;
  }

  return children;
}
