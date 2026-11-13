# Informe consolidado de correcciones

## Estado

Las correcciones de código y base de datos descritas abajo están aplicadas. TypeScript y la compilación de producción pasaron. Posteriormente, el usuario confirmó: «Ya realicé las pruebas pendientes y todo funcionó correctamente». Las validaciones manuales se cierran por esa confirmación, no por ejecución independiente del asistente.

Las menciones **Pendiente** en las secciones técnicas reflejan el estado anterior a esta confirmación y quedan actualizadas por el cierre al final del informe. No se recibieron resultados desglosados, capturas ni identificación de dispositivos.

El informe anterior `docs/rehearsal-contributions-repair-report.md` corresponde al bloque inicial de aportes. Este documento actualiza el estado de los demás puntos.

## Respaldo y preservación

- El usuario confirmó un respaldo de Supabase. El asistente no lo descargó ni probó su restauración.
- La referencia de código inicial es `86e93df09964fbb110f88eb525033d9c574a4eba`; el respaldo de los archivos de aportes se documentó en el informe anterior.
- No se reinició la base ni se borraron cuentas, ensayos, eventos o aportes históricos.
- Los cambios SQL se aplicaron directamente a Supabase, sin crear archivos manuales de migración.
- Todas las pruebas SQL con datos temporales se revirtieron en subtransacciones controladas, incluyendo las auditorías y avisos generados por ellas.
- No se debe revertir esta reparación borrando las nuevas columnas o la tabla de versiones después de usarlas: podrían contener historia legítima.

## 1. Aportes

Se mantiene el guardado transaccional, protección de importes registrados, idempotencia y auditoría de pagos del bloque anterior.

**Evidencia adicional real:** los registros de la aplicación muestran un POST a `/rest/v1/rpc/save_rehearsal_distribution` a las `2026-11-13T22:32:04Z` y su respuesta HTTP **200**, de aproximadamente 324 ms. No se dispone del cuerpo de la solicitud/respuesta ni de una prueba visual. Por tanto, no prueba por sí sola que se guardó un aporte positivo ni su permanencia tras recarga o nuevo inicio de sesión.

**Pendiente:** registrar un aporte positivo legítimo, recargar, salir/entrar y comprobar valores, fechas, pendientes e historial.

## 2. Retiro de músicos y acceso

- `archive_musician`: el Administrador retira la ficha del directorio y suspende su membresía en la organización, en una transacción.
- Columnas `musicians.deleted_at` y `deleted_by`; no se borra físicamente la ficha ni se modifican sus relaciones históricas.
- La ficha del Administrador no se puede retirar. Repetir un retiro no duplica su auditoría.
- Se revocó el permiso de borrado físico de músicos al cliente autenticado.
- Políticas restrictivas comprueban membresía aprobada para los datos operativos que antes permitían acceso por ser propietario. También se reforzaron las RPC de tareas para impedir operaciones de un músico suspendido con un JWT aún vigente.
- Se conserva la lectura del estado de la membresía, para poder mostrar al usuario su suspensión.
- El contexto de acceso vuelve a consultar al recibir cambios, recuperar el foco y cada minuto; la seguridad de base de datos no depende de ese refresco visual.
- El directorio y las listas para nuevas convocatorias excluyen fichas retiradas. Los históricos siguen relacionándose con sus fichas.
- No se borra la cuenta global de Supabase ni su acceso a otras organizaciones. La revocación aquí es organizacional, no una eliminación del usuario de Auth.

**Pruebas SQL:** historial de ensayos/eventos/aportes/tareas conservado; idempotencia; pérdida de lectura con contexto de músico suspendido; posibilidad de leer su propia suspensión; rechazo de retiro por músico y protección del Administrador. Pasaron y se revirtieron.

## 3. Cumpleaños y avisos sin duplicados

- `refresh_my_birthday_notifications`: genera para el usuario aprobado un aviso del mes y avisos de cumpleaños de hoy, con calendario `America/Bogota`.
- `notifications.dedup_key` e índice único por organización, destinatario y clave; el aviso mensual es único por mes y el diario por músico/año.
- Refrescos de tareas serializados por usuario; expansión recurrente serializada por organización para evitar carreras al consultar simultáneamente.
- Reenviar una misma convocatoria interna reutiliza su notificación en lugar de insertar otra.
- Repetir un cambio de estado sin cambios reales no crea otra entrada de historial para el gestor.
- El centro de avisos consulta la organización activa, evita refrescos solapados y procesa también actualizaciones de lectura.
- No se borraron ni fusionaron avisos históricos duplicados. La prevención se aplica a las operaciones indicadas; no se impuso una deduplicación genérica a comentarios distintos sobre la misma tarea.
- Los cumpleaños se generan al abrir/refrescar una sesión aprobada, no mediante una tarea programada que envíe avisos a usuarios desconectados. No se configuró correo ni WhatsApp automático.

**Pruebas SQL:** cumpleaños diario, reintento sin duplicación y rechazo de usuario externo; convocatoria repetida con el mismo identificador; estado repetido sin historial duplicado. Pasaron y se revirtieron.

## 4. Administrador y contraseña

- En **Configuración → Seguridad de mi cuenta** se puede cambiar la contraseña propia, comprobando primero la contraseña actual mediante Supabase Auth.
- Se comprueba la identidad de la sesión, coincidencia de confirmación y mínimo de ocho caracteres; se bloquean envíos simultáneos. No se escriben contraseñas en auditorías o registros.
- Se solicita revocación de otras sesiones después del cambio. Los tokens de acceso ya emitidos pueden seguir siendo válidos hasta su vencimiento; no se afirma un cierre instantáneo de todos los dispositivos.
- El cambio no toca perfiles, roles ni permisos.
- Se reforzó la protección de autodegradación y último Administrador, la pertenencia del rol a la organización, el traslado de membresías y la asignación de ADMIN por usuarios no administradores.
- Políticas restrictivas impiden cambiar directamente el código del rol ADMIN o eliminar sus permisos desde el cliente autenticado.
- Una ficha retirada no puede recuperar acceso simplemente aprobando su membresía de nuevo.

**Pruebas SQL:** autodegradación rechazada; código ADMIN y permisos conservados frente a intentos directos. Pasaron y se revirtieron. No se cambió ninguna contraseña real durante las pruebas.

**Pendiente:** cambio autenticado con contraseña actual, reingreso y comprobación de permisos en la interfaz. No se auditó ni sustituyó la implementación remota de `admin-manage-user`, cuyo código no está disponible en este árbol; la nueva pantalla cambia únicamente la cuenta propia usando Auth.

## 5. Dirección Musical y evaluaciones

- Indicadores usan la fecha colombiana, excluyen ensayos finalizados del próximo encuentro y cuentan preparación previa/general, no tareas posteriores o canceladas.
- `NO COMPLETADA` se mantiene como resultado terminal y no se convierte automáticamente en `VENCIDA` por tener una fecha antigua.
- Se conservan tareas, filtros, estudiantes, plantillas, preparación por canción/instrumento y creación de trabajo para el próximo ensayo.
- Un fallo al cargar muestra el error y un reintento; no presenta indicadores vacíos como datos reales.
- Las evaluaciones posteriores incluyen logros, problemas, correcciones, trabajo siguiente y observaciones.
- `rehearsal_report_versions`: historial de solo lectura para el cliente, con versiones, instantánea, fecha y responsable. Los cuatro resúmenes existentes se copiaron como versión inicial, sin cambiar sus campos originales.
- Un disparador conserva las versiones al modificar los resúmenes. `save_rehearsal_report` bloquea el ensayo y rechaza guardar sobre una versión desactualizada.
- La interfaz permite consultar todo el historial y conservar la creación de tareas desde el trabajo siguiente.

**Pruebas SQL:** versión inicial conservada después de editar; reintento sin cambios no duplica versión; edición antigua rechazada; músico sin permiso no puede guardar. Pasaron y se revirtieron.

**Pendiente:** comprobar en una sesión real del Director los indicadores, el guardado y las versiones visibles.

## 6. Eventos, móvil y audio

- `get_member_event_schedule` filtra en el servidor por asignación del usuario en la misma organización y ficha no retirada. Ya no devuelve todos los eventos de la organización al músico.
- Las asignaciones `NO DISPONIBLE` permanecen en su historial, pero no se presentan como su próximo compromiso.
- Se corrigió el contexto de audio que podía reutilizarse después de quedar cerrado al remontar componentes.
- Se desbloquea audio con un gesto sobre un enlace, con compatibilidad `webkitAudioContext`; los bloqueos del dispositivo no interrumpen la navegación.
- Controles, tarjetas de evaluación, filtros del Director y avisos usan cuadrículas móviles y textos adaptables. No se modificó globalmente la arquitectura ni el sistema de rutas.

**Prueba SQL:** un evento temporal asignado aparece en la agenda y otro no asignado queda excluido. Pasó y se revirtió.

**Pendiente:** revisión visual y audible en Android/iOS y tamaños de 360–390 px. El código no puede garantizar audio cuando el dispositivo está en silencio o bloquea Web Audio.

## Verificación final

- TypeScript de todo el proyecto: **sin errores**.
- Compilación de producción aislada de este bloque: **pasó**.
- Advertencias no bloqueantes: bundle grande, Browserslist antiguo y opción obsoleta del plugin de Vite. No se cambió configuración ajena a la reparación.
- No se encontró error de cliente en la instantánea de registros consultada. Eso no sustituye recorrer cada flujo.
- Conteos observados tras las pruebas: 13 fichas, 9 ensayos, 1 evento, 4 costos, 0 aportes, 4 resúmenes y 4 versiones iniciales. También existe una ficha retirada con auditoría, distinta del músico utilizado en las pruebas reversibles; no se revirtió ese registro legítimo/auditado ni se presupone quién realizó la acción. Los conteos son una instantánea, no una prueba de navegador.

## Cierre de validaciones por confirmación del usuario

El usuario confirmó globalmente haber realizado las pruebas pendientes y que todo funcionó correctamente. Se conserva como referencia la lista que se había dejado para validación, sin atribuir resultados individuales adicionales a esa confirmación:

1. Aporte positivo real: guardar, recargar y volver a iniciar sesión.
2. Administrador: contraseña incorrecta rechazada, cambio válido, reingreso y permisos intactos.
3. Retiro desde interfaz: ficha fuera del directorio, historial accesible para gestores y sesión suspendida sin acceso operativo.
4. Director: indicadores, dos versiones de evaluación, recuperación tras recarga y rechazo de edición antigua desde otra sesión.
5. Avisos: abrir repetidamente en dos pestañas y comprobar cumpleaños/convocatorias sin duplicados nuevos.
6. Móvil: ausencia de desbordamientos, controles accesibles y sonido en enlaces cuando el dispositivo lo permite.

Los dos pendientes de seguimiento —persistencia de aportes y validación manual autenticada/móvil— quedan cerrados por confirmación del usuario. El asistente no ejecutó esas pruebas en un navegador autenticado ni en dispositivos reales, ni realizó cambios adicionales al código o a la base de datos para este cierre.
