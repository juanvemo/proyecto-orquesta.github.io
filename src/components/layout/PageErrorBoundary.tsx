import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("No fue posible renderizar la página", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return <Card className="rounded-[2rem] shadow-none"><CardContent className="grid min-h-[420px] place-items-center p-6 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600"><AlertTriangle className="size-6" /></span><h1 className="mt-5 text-2xl font-black">Esta sección no pudo mostrarse</h1><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Tus datos están seguros. Puedes intentar cargar nuevamente o volver al inicio para continuar navegando.</p><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><Button variant="outline" onClick={() => window.location.assign(import.meta.env.BASE_URL)} className="rounded-xl"><Home className="mr-2 size-4" />Ir al inicio</Button><Button onClick={() => window.location.reload()} className="rounded-xl"><RefreshCw className="mr-2 size-4" />Cargar nuevamente</Button></div></div></CardContent></Card>;
  }
}
