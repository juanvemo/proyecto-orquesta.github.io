import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { assetUrl } from "@/lib/assets";
import { CelebrationsBanner } from "./CelebrationsBanner";
import { NavigationClickSound } from "./NavigationClickSound";
import { PageErrorBoundary } from "./PageErrorBoundary";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";

function Brand() {
  const { organization } = useAuth();
  return (
    <div className="flex h-[88px] items-center gap-3 px-5">
      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-sm"><img src={assetUrl(organization?.logoUrl ?? "/assets/proyecto-orquesta-logo.png")} alt={organization?.name ?? "Proyecto Orquesta"} className="h-full w-full object-contain" /></div>
      <div className="min-w-0"><p className="truncate text-sm font-black tracking-tight text-sidebar-foreground">Portal Proyecto Orquesta</p><p className="text-xs font-bold tracking-[0.2em] text-primary">{organization?.name ?? "PROYECTO ORQUESTA"}</p></div>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <NavigationClickSound />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r bg-sidebar lg:flex lg:flex-col">
        <Brand /><div className="mx-4 mb-5 h-px bg-sidebar-border" /><div className="min-h-0 flex-1 overflow-y-auto"><SidebarNav /></div>
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[290px] border-r bg-sidebar p-0"><SheetTitle className="sr-only">Navegación principal</SheetTitle><Brand /><div className="mx-4 mb-5 h-px bg-sidebar-border" /><div className="h-[calc(100vh-110px)] overflow-y-auto"><SidebarNav onNavigate={() => setMobileOpen(false)} /></div></SheetContent>
      </Sheet>
      <div className="lg:pl-[260px]">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 xl:p-8">
          <CelebrationsBanner />
          <SafePageOutlet />
        </main>
      </div>
    </div>
  );
}

function SafePageOutlet() {
  const location = useLocation();
  return <PageErrorBoundary key={location.pathname}><Outlet /></PageErrorBoundary>;
}
