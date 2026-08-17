-- Row-Level Security por tenant, defensa en profundidad además del filtro
-- por tenantId a nivel de aplicación (ver src/prisma/tenant-prisma.service.ts).
-- Ejecutar UNA VEZ pnpm --filter ./backend db:app-role (crea el rol
-- restringido que hace que esto proteja de verdad) y después de cada
-- `prisma migrate deploy`: pnpm --filter ./backend db:rls
--
-- El rol que corre migraciones (POSTGRES_USER, superusuario y dueño de las
-- tablas) ignora RLS por completo, con o sin FORCE — eso es intencional y
-- esperado. Solo el rol restringido (APP_DB_USER, usado por
-- TenantPrismaService vía AppPrismaService) queda sujeto a estas policies.
-- Ver la sección "Multi-tenancy" de docs/ARCHITECTURE.md.

DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOR tabla IN
    SELECT unnest(ARRAY[
      'tenant_settings', 'configuraciones', 'tenant_modulo_overrides',
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
      'pagos', 'devolucion_compra',
      'cuentas_bancarias', 'gastos_menores'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tabla);
    -- FORCE, no solo ENABLE: sin esto, el dueño de la tabla (el rol de
    -- migraciones) seguiría ignorando la policy aunque no fuera superusuario
    -- — Postgres exime al dueño de RLS por defecto salvo que se fuerce.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tabla);
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I;', tabla
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.tenant_id'', true)::text);',
      tabla
    );
  END LOOP;
END $$;
