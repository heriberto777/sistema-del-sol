---
author: Claude Code
branch: feat/soporte-tecnico-rediseno
status: done
---

# Rediseño de Soporte Técnico (tenant → plataforma)

## Intent

El sistema de Soporte Técnico v1 (commits `4244ec6`/`9044d6f`/`dcdbb58`,
Bloque 4 del backlog UX/operación) era deliberadamente liviano: un ticket
(`ReporteTenant`) con una sola `respuesta` de texto plano. El usuario pidió
rediseñarlo a partir de 4 capturas de referencia: una conversación real
(hilo de mensajes) con adjuntos y formato de texto, en un layout de
bandeja estilo inbox (lista + conversación lado a lado) tanto del lado
tenant como del lado plataforma — mismo patrón visual que ya usa
`frontend/src/pages/Mensajes.tsx` (inbox de WhatsApp).

## Scope

**Incluye:**
- Nuevo modelo `ReporteTenantMensaje` (hilo de mensajes por ticket,
  reemplaza el campo único `respuesta`). Migración con backfill de datos
  existentes (el `descripcion` original se vuelve mensaje #1 del tenant;
  `respuesta` existente se vuelve mensaje #2 del equipo de soporte).
- Adjuntos: base64 en Postgres (mismo patrón que `ImagenProducto`), límite
  de tamaño validado en el DTO.
- Formato de texto: editor WYSIWYG real (Tiptap — `@tiptap/react` +
  `@tiptap/starter-kit`, nueva dependencia de frontend). Contenido
  guardado como JSON de Tiptap (no HTML crudo), validado server-side
  contra una lista blanca de tipos de nodo/marca.
- Backend: nuevos endpoints de mensajes (tenant y plataforma), endpoint
  de cambiar estado separado de enviar mensaje (plataforma), filtros
  ampliados en el listado de plataforma (tenant/categoría/rango de
  fecha — el filtro por tenant no existía).
- Reabrir ticket automáticamente (`RESUELTO` → `EN_REVISION`) cuando el
  tenant responde después de que se marcó resuelto.
- Frontend: layout de bandeja (lista + conversación lado a lado, clonando
  la estructura de `Mensajes.tsx`) para `Soporte.tsx` (tenant) y
  `PlatformSoporte.tsx` (plataforma, con panel "Contexto del Tenant").
  Página separada `/soporte/nuevo` para crear ticket (regla "Crear va en
  página, nunca en modal").
- Tests: unitarios (reapertura de ticket, validación de JSON de Tiptap),
  e2e de aislamiento entre tenants sobre los mensajes.

**Excluye (fuera de esta ronda):**
- Notificación por email/WhatsApp de nuevo mensaje — v1 seguía siendo
  deliberadamente liviano, sin SLA. Si hace falta, es una ronda aparte.
- Adjuntos que no sean imagen/PDF chicos — sin límite configurable por
  tenant, un solo límite fijo global.

## Checklist

- [x] Schema: `ReporteTenantMensaje` + enum `AutorMensajeReporte`,
      `ReporteTenant` pierde `descripcion`/`respuesta`/`respondidoPorId`/
      `respondidoEn`, gana `ultimoMensajeEn`.
- [x] Migración aplicada en dev + `db:rls` corrido.
- [x] Backend: DTOs/repository/service/controller actualizados (tenant +
      plataforma), validación de JSON de Tiptap. Lógica de negocio
      (reapertura de estado) movida al service, no al repository.
- [x] Tests unitarios: reapertura de ticket, rechazo de JSON con nodos no
      permitidos.
- [x] Test e2e de aislamiento entre tenants sobre mensajes de soporte.
- [x] Frontend: Tiptap instalado y verificado dentro del contenedor
      Docker (gotcha real: una reinstalación dentro del contenedor dejó
      un `frontend/pnpm-lock.yaml` espurio en el host — borrado, nunca
      commiteado, mismo criterio que la Fase C de Formato de Documentos).
- [x] Frontend: `Soporte.tsx`/`SoporteNuevo.tsx`/`PlatformSoporte.tsx`
      reescritos con el layout de bandeja + editor Tiptap.
- [x] Lint de los archivos nuevos/tocados (backend y frontend) en verde.

## Pendiente — no bloqueante

- QA en vivo del lado **plataforma** (`PlatformSoporte.tsx`,
  `ConversacionSoportePlataforma.tsx`) no se hizo en el navegador — no
  había credenciales de super admin a mano y crear una cuenta de
  plataforma nueva quedó bloqueado por el clasificador de permisos de
  la sesión. Cobertura real de ese flujo: el test e2e
  `reportes-tenant.e2e-spec.ts` ejercita el mismo camino completo
  (plataforma ve el ticket, responde, cambia estado) contra la API real,
  y el componente reutiliza exactamente el mismo patrón ya probado en
  vivo del lado tenant. Si querés, decime unas credenciales de super
  admin (o pedime que arranque una sesión de bootstrap vos mismo) y lo
  termino de verificar en el navegador.

## Evidence

- Migración `20261124133532_rediseno_soporte_tecnico` aplicada contra
  `dev-postgres` (0 filas existentes en `reportes_tenant` — nada que
  backfillear todavía, migración limpia igual). `db:rls` corrido sin
  error (la tabla nueva no entra en `enable-rls.sql`, mismo criterio que
  `linea_factura`/`factura_proveedor_linea` — hija sin tenantId propio).
- `npx tsc --noEmit` del backend limpio tras el refactor completo.
- `npx jest src/reportes-tenant src/common/tiptap` — 15/15 specs en
  verde (incluye rechazo de nodos/marcas fuera de la lista blanca y la
  lógica de reapertura NUEVO→EN_REVISION / RESUELTO→EN_REVISION).
- `npx jest --config ./test/jest-e2e.json reportes-tenant` — 7/7 casos en
  verde: aislamiento entre tenants (B no lee ni responde el ticket de A,
  404 en ambos), validación 400 de Tiptap, y el ciclo completo de estado
  (NUEVO→EN_REVISION por primera respuesta de plataforma→RESUELTO→
  EN_REVISION al reabrir el tenant).

- Tiptap (`@tiptap/react` + `@tiptap/starter-kit`) instalado en el host y
  dentro de `sistema-del-sol-web-1` — gotcha real repetido (mismo que
  Fase C de Formato de Documentos): el `pnpm install` dentro del
  contenedor dejó un `frontend/pnpm-lock.yaml` nuevo en el host, borrado
  (el lockfile real es el de la raíz).
- Gotcha nuevo encontrado y resuelto: el cliente de Prisma del contenedor
  `sistema-del-sol-api-1` quedó desactualizado tras la migración
  (`P2022: the column reportes_tenant.descripcion does not exist`) — un
  `npx prisma generate` + restart del contenedor lo resolvió. Y el caché
  de optimización de dependencias de Vite (`node_modules/.vite`) quedó
  con dos hashes distintos tras agregar Tiptap, causando "Invalid hook
  call" (dos copias de React) — se resolvió borrando `node_modules/.vite`
  dentro del contenedor web + restart.
- QA en vivo completa del lado tenant (navegador real, login
  `admin@demo.com`): crear ticket con el editor Tiptap, verlo en la
  bandeja con preview de texto plano, abrir la conversación, responder —
  sin errores de consola, sin el diálogo de "¿salir sin guardar?"
  bloqueando el alta. Datos de prueba limpiados después.
- Lint de todos los archivos nuevos/tocados (backend vía
  `sistema-del-sol-api-1`, frontend vía `sistema-del-sol-web-1`): 0
  errores, 0 warnings (se movieron las constantes/tipos compartidos a
  `frontend/src/types/soporte.ts` para evitar el warning de Fast Refresh).
- `npx jest src/reportes-tenant src/common/tiptap` dentro del contenedor:
  15/15 en verde (confirmado una vez más al cierre).

## Next

Nada pendiente de mi lado salvo el QA en vivo del panel de plataforma
(ver sección "Pendiente — no bloqueante" arriba). Pendiente del usuario:
revisar/commitear, y decidir si quiere QA manual del lado plataforma
antes o después del merge.
