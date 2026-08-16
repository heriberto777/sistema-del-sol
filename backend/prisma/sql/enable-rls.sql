-- Row-Level Security por tenant, pensado como defensa en profundidad además
-- del filtro por tenantId a nivel de aplicación (ver
-- src/prisma/tenant-prisma.service.ts). Ejecutar después de cada
-- `prisma migrate deploy`: pnpm --filter ./backend db:rls
--
-- ADVERTENCIA: esta policy por sí sola NO protege nada todavía. Nadie
-- ejecuta `SET app.tenant_id` en el backend, y el rol de la app en
-- docker-compose.yml es superusuario (ignora RLS). Ver la sección
-- "Multi-tenancy" de docs/ARCHITECTURE.md antes de asumir que esta capa
-- está activa.

DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOR tabla IN
    SELECT unnest(ARRAY[
      'tenant_settings', 'configuraciones', 'tenant_plugins',
      'users', 'roles', 'audit_logs',
      'ncf_asignados', 'facturas',
      'productos', 'bodegas', 'movimiento_inventario',
      'proveedores', 'orden_compra', 'recepcion_compra',
      'clientes',
      'webhooks',
      'notificacion_plantillas', 'notificaciones',
      'cotizaciones', 'remisiones',
      'cuentas_contables', 'asientos_contables',
      'empleados', 'periodos_nomina', 'turnos_caja',
      'pagos', 'devolucion_compra'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tabla);
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I;', tabla
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.tenant_id'', true)::text);',
      tabla
    );
  END LOOP;
END $$;
