# Corrección de aportes de ensayos

## Alcance y estado

Se corrigió el flujo de distribución y confirmación de aportes del panel de ensayos. La verificación del navegador, recarga y nuevo inicio de sesión sigue pendiente; no se declara resuelto el conjunto de requisitos de la aplicación.

## Respaldo

- Base de datos: respaldo confirmado por el usuario. No fue descargado, inspeccionado ni probado por el asistente.
- Código previo: `.dyad/backups/contributions-86e93df/src/features/rehearsals/costs.ts`, `RehearsalCostPanel.tsx` y `src/pages/RehearsalControl.tsx`, con las rutas completas conservadas bajo el directorio de respaldo.
- Referencia Git: `86e93df09964fbb110f88eb525033d9c574a4eba`.
- Política original de lectura: `.dyad/backups/contributions-86e93df/original-cost-read-policy.sql`. Restaurarla reintroduciría la recursión; no debe ejecutarse como una reparación.

## Causa reproducida

Una prueba de inserción con el rol PostgreSQL `authenticated` y el contexto de un Administrador aprobado devolvió `42P17: infinite recursion detected in policy for relation "rehearsal_contributions"`. El ciclo proviene de la política de lectura de costos que consulta aportes, mientras la validación de escritura de aportes consulta costos. Toda la prueba se revirtió, incluyendo auditoría y notificaciones.

## Cambios de base de datos

Aplicados mediante consultas a Supabase, sin archivos manuales de migración:

1. `can_read_rehearsal_cost(uuid, uuid)`: comprobación de lectura con `SECURITY DEFINER`, `search_path` vacío, identidad de la sesión, membresía aprobada, organización y propiedad del aporte. No permite acceso público. La política de lectura de costos la utiliza para evitar el ciclo de RLS.
2. `contribution_date`: fecha opcional; no se rellenaron ni modificaron registros antiguos.
3. `save_rehearsal_distribution(uuid, uuid, numeric, text, text, jsonb)`: transacción con bloqueo del ensayo, comprobación de permisos y organización, validación de importes y suma, conservación de aportes existentes y restricción única por costo/músico. Repetir el mismo guardado no crea nuevos aportes ni sus notificaciones. No permite quitar o cambiar el músico o importe de un aporte ya registrado. Conserva autor y recaudador originales al actualizar un costo existente.
4. `confirm_rehearsal_payment(uuid, uuid, date, text)`: permisos explícitos de gestión de costos o finanzas, bloqueo del aporte, actualización y auditoría en la misma transacción. Repetir un pago ya confirmado no modifica fecha, importe ni observaciones y no genera otra auditoría de pago. La observación nueva se agrega a la original. La fecha de pago no puede ser futura.

No se deshabilitó RLS ni se otorgaron permisos públicos a tablas. No se reinició la base ni se borraron usuarios, músicos, ensayos o aportes históricos.

## Cambios de interfaz

- El panel existente llama a las funciones transaccionales; se eliminaron del frontend el borrado de pendientes y el guardado dividido en varias solicitudes.
- Mensajes de error muestran el mensaje y código reales de Supabase cuando están disponibles.
- Importes, fechas y observaciones de aportes nuevos; fecha y observación de confirmación del pago.
- Aportes registrados quedan protegidos en el formulario, incluso si su músico ya no está convocado.
- Distribución por centavos y diferencia entre costo y aportes.
- Bloqueo inmediato del envío con referencia React y controles deshabilitados durante la operación.
- Si el servidor confirma el guardado pero falla la lectura posterior, se indica que falta actualizar la vista; no se presenta como un guardado fallido.
- Lectura de costos filtrada también por organización.

## Pruebas ejecutadas

Pruebas SQL con contexto de rol y usuario; no equivalen a una sesión real de navegador. Todos los datos de prueba se revirtieron en una subtransacción controlada.

| Prueba | Resultado |
| --- | --- |
| Reproducción del error original de RLS | Fallo 42P17 reproducido y revertido |
| Inserción con RLS de Administrador después de la corrección | Pasó, revertida |
| Guardado transaccional de dos aportes con fecha y observación | Pasó, revertido |
| Repetición del guardado sin duplicar aportes | Pasó |
| Confirmación con observación agregada a la original | Pasó |
| Repetición de confirmación sin cambiar fecha ni duplicar auditoría PAY | Pasó |
| Total de 15.000: 10.000 pagados y 5.000 pendientes | Pasó |
| Rechazo de distribución cuya suma no coincide, sin cambio del costo | Pasó |
| Rechazo de cambio de importe histórico | Pasó |
| Rechazo de confirmación fuera de la organización | Pasó |
| Músico aprobado ve solamente su aporte y el costo correspondiente | Pasó |
| Músico sin permiso no puede confirmar pagos | Pasó |
| Usuario externo no puede leer el costo ni los aportes de prueba | Pasó |
| TypeScript de todo el proyecto | Sin errores |
| Compilación de producción aislada | Pasó |

La compilación emitió advertencias de tamaño de bundle, datos antiguos de Browserslist y una opción obsoleta del plugin de Vite. No son fallos de esta corrección y no se cambió la configuración.

Conteos originales y posteriores: **4 costos, 0 aportes, 9 ensayos y 12 músicos activos**. RLS permanece activa en costos y aportes. Los ensayos/costos existentes no se rellenaron con aportes inventados.

## Pruebas pendientes

- Guardar un aporte real desde la aplicación y capturar la respuesta HTTP/RPC de esa sesión.
- Verificar que reaparece al recargar y tras cerrar/abrir sesión.
- Comprobar distribución, pendientes e historial en las vistas reales de Administrador, Director y músico.
- Probar doble clic y reintento después de pérdida de conexión desde el navegador. La idempotencia del servidor fue probada, no la interacción de navegador.
- Probar visualmente en dispositivos móviles; el código usa diseño responsive, pero no se comprobó en dispositivos reales.
- Si se requiere registrar varios aportes independientes para un mismo músico en un mismo ensayo, la restricción vigente permite uno por costo/músico. No se modificó esa regla ni se diseñó un nuevo modelo financiero.

Eliminación de músicos, cumpleaños/notificaciones, seguridad/cambio de contraseña, panel del Director/evaluaciones y eventos/sonidos siguen pendientes, sin cambios en este bloque.
