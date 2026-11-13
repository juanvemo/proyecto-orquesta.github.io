import type { LucideIcon } from "lucide-react";
import { Boxes, CalendarCheck2, CalendarDays, ClipboardList, ContactRound, Database, FileText, Gauge, HandCoins, ListTodo, MessagesSquare, Music2, Settings, SlidersHorizontal, Sparkles, UserRound, UsersRound, UserRoundCog } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: string;
  anyPermission?: string[];
}

export const navigationGroups: { label: string; items: NavItem[] }[] = [
  { label: "Principal", items: [
    { label: "Dashboard", path: "/", icon: Gauge, permission: "dashboard.view" },
    { label: "Comunidad", path: "/comunidad", icon: MessagesSquare },
    { label: "Mi perfil", path: "/mi-perfil", icon: UserRound, permission: "portal.use" },
    { label: "Mi disponibilidad", path: "/mi-disponibilidad", icon: CalendarCheck2, permission: "portal.use" },
    { label: "Mi trabajo musical", path: "/mi-trabajo-musical", icon: ListTodo, permission: "tasks.self" },
    { label: "Mis aportes", path: "/mis-aportes", icon: HandCoins, permission: "portal.use" },
    { label: "Calendario", path: "/calendario", icon: CalendarDays, anyPermission: ["rehearsals.view", "quotes.manage", "events.manage", "tasks.manage", "tasks.self"] },
  ] },
  { label: "Operación musical", items: [
    { label: "Dirección Musical", path: "/direccion-musical", icon: ListTodo, permission: "tasks.manage" },
    { label: "Músicos", path: "/musicos", icon: UsersRound, anyPermission: ["musicians.view", "portal.use"] },
    { label: "Ensayos", path: "/ensayos", icon: ClipboardList, permission: "rehearsals.view" },
    { label: "Repertorio", path: "/repertorio", icon: Music2, permission: "repertoire.view" },
    { label: "Eventos", path: "/eventos", icon: Sparkles, anyPermission: ["events.manage", "quotes.manage"] },
    { label: "Producción técnica", path: "/produccion-tecnica", icon: SlidersHorizontal, anyPermission: ["technical.manage", "events.manage", "quotes.manage"] },
  ] },
  { label: "Gestión", items: [
    { label: "Clientes y CRM", path: "/clientes", icon: ContactRound, permission: "clients.manage" },
    { label: "Solicitudes", path: "/solicitudes", icon: FileText, permission: "quotes.manage" },
    { label: "Cotizaciones", path: "/cotizaciones", icon: FileText, permission: "quotes.manage" },
    { label: "Finanzas", path: "/finanzas", icon: HandCoins, permission: "finances.manage" },
  ] },
  { label: "Administración", items: [
    { label: "Usuarios", path: "/usuarios", icon: UserRoundCog, permission: "users.view" },
    { label: "Roles y permisos", path: "/roles", icon: Boxes, permission: "roles.manage" },
    { label: "Listas del registro", path: "/catalogos-registro", icon: Database, permission: "musicians.manage" },
    { label: "Formulario comercial", path: "/configuracion-formulario", icon: SlidersHorizontal, permission: "organization.manage" },
    { label: "Configuración", path: "/configuracion", icon: Settings, permission: "organization.manage" },
  ] },
];
