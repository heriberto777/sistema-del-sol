-- CreateTable
CREATE TABLE "carritos_borrador" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "turnoCajaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "vendedorEmpleadoId" TEXT,
    "listaPrecio" TEXT,
    "tipoFactura" TEXT,
    "tipoComprobanteEspecial" TEXT,
    "lineas" JSONB NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carritos_borrador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carritos_borrador_turnoCajaId_key" ON "carritos_borrador"("turnoCajaId");

-- AddForeignKey
ALTER TABLE "carritos_borrador" ADD CONSTRAINT "carritos_borrador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carritos_borrador" ADD CONSTRAINT "carritos_borrador_turnoCajaId_fkey" FOREIGN KEY ("turnoCajaId") REFERENCES "turnos_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carritos_borrador" ADD CONSTRAINT "carritos_borrador_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carritos_borrador" ADD CONSTRAINT "carritos_borrador_vendedorEmpleadoId_fkey" FOREIGN KEY ("vendedorEmpleadoId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
