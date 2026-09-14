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
      'ajuste_inventario', 'transferencia_inventario', 'conteos_fisicos',
      'clientes',
      'webhooks',
      'notificacion_plantillas', 'notificaciones',
      'cotizaciones', 'remisiones',
      'cuentas_contables', 'asientos_contables', 'periodos_contables_cerrados',
      'empleados', 'periodos_nomina', 'turnos_caja',
      'pagos', 'devolucion_compra',
      'cuentas_bancarias', 'gastos_menores',
      'formas_pago', 'ventas_aparcadas', 'categorias', 'listas_precio',
      'variantes_producto', 'atributos',
      'ofertas', 'bonos', 'lotes',
      'horarios_empleado', 'registros_asistencia', 'ausencias',
      'sucursales', 'categorias_cliente', 'feriados', 'puestos',
      'leyes_fiscales', 'plantillas_horario', 'tipos_ausencia_config',
      'codigos_autorizacion', 'comisiones_venta',
      'configuraciones_lealtad', 'movimientos_lealtad',
      'cajas', 'tasas_cambio', 'correlativos',
      'whatsapp_config_tenant', 'pasarela_config_tenant',
      'sesiones_cobro_factura', 'whatsapp_mensajes',
      'carritos_borrador', 'pedidos_tienda', 'secciones_tienda',
      'tenant_dominios',
      'proyectos', 'hitos_proyecto', 'tareas_proyecto', 'registros_hora_proyecto',
      'sesiones_trabajo_tarea',
      'publicaciones_sociales',
      'propiedades', 'contratos_propiedad', 'alertas_busqueda_propiedad', 'cobros_alquiler',
      'tareas_personales', 'categorias_incentivo'
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
