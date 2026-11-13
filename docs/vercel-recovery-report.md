# Informe de recuperación del despliegue Vercel

## Alcance
Corrección exclusiva de instalación y compilación. No se implementaron aquí las mejoras funcionales pendientes.

## Referencia y respaldo
- Referencia: último despliegue de producción READY, commit `9a3bb4771af5ffd5c3be66e1a1ada436972c7151`.
- Estado de partida: commit `08448b0ff48168ea2014afd7e7fa6c1748f48cac`, con cambios locales conservados.
- Respaldo local de código/configuración: `.dyad/backups/vercel-recovery/`.
- Respaldo previo del lockfile: `.dyad/backups/vercel-08448b0/pnpm-lock.yaml`.
- No se realizó ni se afirma haber realizado un respaldo de la base de datos; no fue intervenida.

## Causas y correcciones
- `ERR_PNPM_OUTDATED_LOCKFILE`: retirada la declaración raíz obsoleta de Firebase en `pnpm-lock.yaml`; se mantuvieron las demás versiones y la instalación con lockfile congelado.
- Entradas sin extensiones: código conservado en `src/App.tsx`, `src/main.tsx`, `src/globals.css`; se eliminó la colisión de nombres `App`/`app`.
- Carpeta `src/features/comercial` no coincidía con imports: renombrada a `src/features/commercial`, sin alterar contenido.
- Configuración Vite ausente: recuperado `vite.config.ts` con alias `@` y base original.
- Componentes, contexto y servicios ausentes: recuperados del commit de referencia; no se sustituyeron las páginas actuales.
- Recuperadas las reglas originales de `.gitignore` para excluir dependencias, resultados y respaldos locales.

## Verificaciones
- Comparación de 63 archivos preexistentes frente al respaldo: ninguna modificación de contenido (se contemplaron los renombrados).
- TypeScript: sin errores.
- Instalación limpia y compilación de producción aislada: exitosas; 4201 módulos transformados.
- Vercel: despliegue de prueba `dpl_9Spa7XJapUzoEt6xEiqonuGvYgp3`, estado `READY`.
- URL: https://proyecto-orquesta-github-p2lxcqxs7-proyecto-orquesta.vercel.app
- `/login`: HTTP 200, HTML con referencias a JS/CSS compilados.
- `/assets/index-D6mu_d5X.css`: HTTP 200 y tipo text/css.
- Advertencias no bloqueantes: Browserslist desactualizado, opción esbuild obsoleta del plugin SWC y tamaño del bundle.
- El despliegue fue de prueba: no se promovió a producción ni se modificaron los dominios públicos.
- No se realizaron pruebas autenticadas de aportes, eliminación de músicos, contraseñas, ni pruebas en dispositivos físicos; no se declaran validadas.

## Base de datos
Sin SQL, migraciones, cambios de permisos, eliminación de usuarios o registros, ni despliegues de funciones Supabase.

## Archivos originales recuperados
- `src/components/admin/MusicianApplicationDialog.tsx`
- `src/components/admin/UserCreateDialog.tsx`
- `src/components/admin/UserEditDialog.tsx`
- `src/components/auth/AuthRedirectGate.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/CelebrationsBanner.tsx`
- `src/components/layout/GlobalSearch.tsx`
- `src/components/layout/NavigationClickSound.tsx`
- `src/components/layout/NotificationCenter.tsx`
- `src/components/layout/PageErrorBoundary.tsx`
- `src/components/layout/SidebarNav.tsx`
- `src/components/layout/TopBar.tsx`
- `src/components/profile/NotificationPreferencesCard.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/tooltip.tsx`
- `src/config/navigation.ts`
- `src/contexts/AuthContext.tsx`
- `src/features/musicians/AvailabilityManager.tsx`
- `src/features/musicians/CatalogManager.tsx`
- `src/features/musicians/MusicianFormDialog.tsx`
- `src/features/musicians/service.ts`
- `src/features/musicians/types.ts`
- `src/features/musicians/validation.ts`
- `src/features/rehearsals/RehearsalCostPanel.tsx`
- `src/features/rehearsals/RehearsalFormDialog.tsx`
- `src/features/rehearsals/RehearsalSongsPanel.tsx`
- `src/features/rehearsals/costs.ts`
- `src/features/rehearsals/service.ts`
- `src/features/rehearsals/types.ts`
- `src/features/repertoire/SetlistBuilder.tsx`
- `src/features/repertoire/SongDetailDialog.tsx`
- `src/features/repertoire/SongFormDialog.tsx`
- `src/features/repertoire/service.ts`
- `src/features/repertoire/types.ts`
- `src/features/technical/RiderEditorDialog.tsx`
- `src/features/technical/service.ts`
- `src/features/technical/types.ts`
- `vite.config.ts`
- `.gitignore`
