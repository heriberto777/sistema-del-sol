# Plugin: Proyectos

Gestión de proyectos con hitos, tareas, registro de horas y costos —
modelo "integrado al ERP" (no un Kanban aislado): un proyecto se arma
sobre un `Cliente` (Contactos) ya cargado, las tareas se asignan a
`Empleado`s ya existentes, y las horas registradas alimentan el costo
interno del proyecto (derivado de `Empleado.salarioBrutoMensual`).

**Implementación real**: `backend/src/proyectos/` (mismo criterio que
`ecommerce` — este directorio es solo el manifiesto que lee
`PluginLoaderService` al boot, no el código).

## Fase 1 (entregada)

- Modelo de datos: `Proyecto` → `HitoProyecto` → `TareaProyecto` (con
  responsables N:M vía `TareaProyectoResponsable` y registro de horas vía
  `RegistroHoraProyecto`).
- `GastoMenor.proyectoId` opcional — reusa el flujo de creación de gastos
  ya existente, solo lo asocia a un proyecto puntual.
- Permisos opt-in: `proyectos.ver` / `.crear` / `.editar` /
  `.horas.registrar` — Admin Total/Gerente los heredan automático (mismo
  mecanismo que `productos.ia_generar`), cualquier otro rol necesita que
  se lo asignen a mano desde Roles y Permisos.
- Activación por tenant: clave `proyectos` en `MODULOS_BASE` — vía Plan o
  `TenantModuloOverride`, nunca la activa el propio tenant.

## Fases futuras (no implementadas todavía)

- Fase 4: generar la `Factura` real de un hito (`PRECIO_FIJO`) o calcular
  el monto a facturar por horas trabajadas (`POR_HORAS`), reusando
  `FacturacionService.crear()`.
- Dashboard de rentabilidad: facturado vs. costo real (horas × costo
  interno + gastos asociados).
- Notificaciones (Event Bus) por hito próximo a vencer o costo que supera
  el presupuesto.
