import { useState } from "react";
import { Check, ChevronDown, LogOut, Menu, Moon, Search, Settings, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationCenter } from "./NotificationCenter";

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, membership, signOut, hasPermission } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const initials = `${user?.firstName?.[0] ?? "U"}${user?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6">
        <Button variant="ghost" size="icon" className="rounded-xl lg:hidden" onClick={onOpenMenu}><Menu className="size-5" /><span className="sr-only">Abrir menú</span></Button>
        <button onClick={() => setSearchOpen(true)} className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border bg-muted/35 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/60 sm:max-w-md">
          <Search className="size-4 shrink-0" /><span className="truncate">Buscar músicos, eventos, documentos…</span><kbd className="ml-auto hidden rounded-md border bg-background px-2 py-0.5 text-[10px] font-bold sm:block">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}<span className="sr-only">Cambiar tema</span>
          </Button>
          <NotificationCenter userId={user?.id} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 flex items-center gap-2 rounded-xl p-1.5 pr-2 transition-colors hover:bg-muted">
                <Avatar className="size-8 border"><AvatarImage src={user?.avatarUrl ?? undefined} /><AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{initials}</AvatarFallback></Avatar>
                <div className="hidden text-left md:block"><p className="max-w-32 truncate text-xs font-bold">{user?.firstName} {user?.lastName}</p><p className="text-[10px] text-muted-foreground">{membership?.roleName}</p></div>
                <ChevronDown className="hidden size-3 text-muted-foreground md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
              <DropdownMenuLabel className="p-3"><p className="font-bold">{user?.firstName} {user?.lastName}</p><p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p><Badge className="mt-2 rounded-lg bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"><Check className="mr-1 size-3" /> {membership?.roleName}</Badge></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl py-2.5" onClick={() => navigate("/mi-perfil")}><User className="mr-2 size-4" /> Mi perfil</DropdownMenuItem>
              {hasPermission("organization.manage") && <DropdownMenuItem className="rounded-xl py-2.5" onClick={() => navigate("/configuracion")}><Settings className="mr-2 size-4" /> Configuración</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl py-2.5 text-destructive focus:text-destructive" onClick={() => void signOut()}><LogOut className="mr-2 size-4" /> Cerrar sesión</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
