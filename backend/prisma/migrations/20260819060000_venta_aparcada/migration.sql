-- CreateTable
CREATE TABLE "ventas_aparcadas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "turnoCajaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "vendedorEmpleadoId" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_aparcadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineas_venta_aparcada" (
    "id" TEXT NOT NULL,
    "ventaAparcadaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "porcentajeItbis" DECIMAL(5,2) NOT NULL,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "lineas_venta_aparcada_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ventas_aparcadas" ADD CONSTRAINT "ventas_aparcadas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_aparcadas" ADD CONSTRAINT "ventas_aparcadas_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_aparcadas" ADD CONSTRAINT "ventas_aparcadas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_aparcadas" ADD CONSTRAINT "ventas_aparcadas_vendedorEmpleadoId_fkey" FOREIGN KEY ("vendedorEmpleadoId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_venta_aparcada" ADD CONSTRAINT "lineas_venta_aparcada_ventaAparcadaId_fkey" FOREIGN KEY ("ventaAparcadaId") REFERENCES "ventas_aparcadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_venta_aparcada" ADD CONSTRAINT "lineas_venta_aparcada_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
