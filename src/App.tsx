import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthRedirectGate } from "@/components/auth/AuthRedirectGate";
import { AnyPermissionRoute, ProtectedRoute, PermissionRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import CalendarPage from "@/pages/CalendarPage";
import Clients from "@/pages/Clients";
import CommercialFormSettings from "@/pages/CommercialFormSettings";
import Community from "@/pages/Community";
import DataPolicy from "@/pages/DataPolicy";
import EmailConfirmed from "@/pages/EmailConfirmed";
import Events from "@/pages/Events";
import Finances from "@/pages/Finances";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import MusicDirection from "@/pages/MusicDirection";
import MusicianDashboard from "@/pages/MusicianDashboard";
import MusicianProfile from "@/pages/MusicianProfile";
import Musicians from "@/pages/Musicians";
import MyAvailability from "@/pages/MyAvailability";
import MyContributions from "@/pages/MyContributions";
import MyMusicWork from "@/pages/MyMusicWork";
import MyProfile from "@/pages/MyProfile";
import PendingApproval from "@/pages/PendingApproval";
import PublicHome from "@/pages/PublicHome";
import PublicQuote from "@/pages/PublicQuote";
import PublicRehearsalInvitation from "@/pages/PublicRehearsalInvitation";
import QuoteRequestDetail from "@/pages/QuoteRequestDetail";
import QuoteRequests from "@/pages/QuoteRequests";
import RecoverPassword from "@/pages/RecoverPassword";
import RehearsalControl from "@/pages/RehearsalControl";
import Rehearsals from "@/pages/Rehearsals";
import RequestQuote from "@/pages/RequestQuote";
import ResetPassword from "@/pages/ResetPassword";
import Repertoire from "@/pages/Repertoire";
import RegistrationCatalogs from "@/pages/RegistrationCatalogs";
import Roles from "@/pages/Roles";
import Settings from "@/pages/Settings";
import TechnicalProduction from "@/pages/TechnicalProduction";
import Users from "@/pages/Users";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();
const Router = import.meta.env.BASE_URL === "/" ? BrowserRouter : HashRouter;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <Toaster />
          <Sonner richColors position="top-right" />
          <Router>
            <AuthProvider>
              <AuthRedirectGate>
              <Routes>
                <Route path="/proyecto-orquesta" element={<PublicHome />} />
                <Route path="/solicitar-cotizacion" element={<RequestQuote />} />
                <Route path="/cotizacion/:token" element={<PublicQuote />} />
                <Route path="/convocatoria/:token" element={<PublicRehearsalInvitation />} />
                <Route path="/politica-datos" element={<DataPolicy />} />
                <Route path="/login" element={<Login />} />
                <Route path="/recuperar-clave" element={<RecoverPassword />} />
                <Route path="/actualizar-clave" element={<ResetPassword />} />
                <Route path="/correo-confirmado" element={<EmailConfirmed />} />
                <Route path="/acceso-pendiente" element={<PendingApproval />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route index element={<RoleHome />} />
                    <Route path="completar-perfil" element={<MyProfile firstAccess />} />
                    <Route path="comunidad" element={<Community />} />
                    <Route element={<PermissionRoute permission="portal.use" />}>
                      <Route path="mi-perfil" element={<MyProfile />} />
                      <Route path="mi-disponibilidad" element={<MyAvailability />} />
                      <Route path="mis-aportes" element={<MyContributions />} />
                    </Route>
                    <Route element={<PermissionRoute permission="tasks.self" />}>
                      <Route path="mi-trabajo-musical" element={<MyMusicWork />} />
                    </Route>
                    <Route element={<PermissionRoute permission="tasks.manage" />}>
                      <Route path="direccion-musical" element={<MusicDirection />} />
                    </Route>
                    <Route element={<AnyPermissionRoute permissions={["musicians.view", "portal.use"]} />}>
                      <Route path="musicos" element={<Musicians />} />
                    </Route>
                    <Route element={<PermissionRoute permission="musicians.view" />}>
                      <Route path="musicos/:id" element={<MusicianProfile />} />
                    </Route>
                    <Route element={<AnyPermissionRoute permissions={["rehearsals.view", "quotes.manage", "events.manage", "tasks.manage", "tasks.self"]} />}>
                      <Route path="calendario" element={<CalendarPage />} />
                    </Route>
                    <Route element={<PermissionRoute permission="rehearsals.view" />}>
                      <Route path="ensayos" element={<Rehearsals />} />
                      <Route path="ensayos/:id" element={<RehearsalControl />} />
                    </Route>
                    <Route element={<PermissionRoute permission="repertoire.view" />}>
                      <Route path="repertorio" element={<Repertoire />} />
                    </Route>
                    <Route element={<PermissionRoute permission="clients.manage" />}>
                      <Route path="clientes" element={<Clients />} />
                    </Route>
                    <Route element={<PermissionRoute permission="quotes.manage" />}>
                      <Route path="solicitudes" element={<QuoteRequests />} />
                      <Route path="solicitudes/:id" element={<QuoteRequestDetail />} />
                      <Route path="cotizaciones" element={<QuoteRequests />} />
                    </Route>
                    <Route element={<AnyPermissionRoute permissions={["events.manage", "quotes.manage"]} />}>
                      <Route path="eventos" element={<Events />} />
                    </Route>
                    <Route element={<AnyPermissionRoute permissions={["technical.manage", "events.manage", "quotes.manage"]} />}>
                      <Route path="produccion-tecnica" element={<TechnicalProduction />} />
                    </Route>
                    <Route element={<PermissionRoute permission="finances.manage" />}>
                      <Route path="finanzas" element={<Finances />} />
                    </Route>
                    <Route element={<PermissionRoute permission="users.view" />}>
                      <Route path="usuarios" element={<Users />} />
                    </Route>
                    <Route element={<PermissionRoute permission="roles.manage" />}>
                      <Route path="roles" element={<Roles />} />
                    </Route>
                    <Route element={<PermissionRoute permission="musicians.manage" />}>
                      <Route path="catalogos-registro" element={<RegistrationCatalogs />} />
                    </Route>
                    <Route element={<PermissionRoute permission="organization.manage" />}>
                      <Route path="configuracion" element={<Settings />} />
                      <Route path="configuracion-formulario" element={<CommercialFormSettings />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </AuthRedirectGate>
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RoleHome() {
  const { membership } = useAuth();
  if (membership?.roleCode === "DIRECTOR_MUSICAL") return <Navigate to="/direccion-musical" replace />;
  if (membership?.roleCode === "MUSICIAN") return <MusicianDashboard />;
  return <Index />;
}
