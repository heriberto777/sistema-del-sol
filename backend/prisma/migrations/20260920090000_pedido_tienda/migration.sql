-- CreateTable
CREATE TABLE "pedidos_tienda" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "clienteTelefono" TEXT NOT NULL,
    "clienteEmail" TEXT,
    "direccionEntrega" TEXT NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_tienda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_tienda_facturaId_key" ON "pedidos_tienda"("facturaId");

-- AddForeignKey
ALTER TABLE "pedidos_tienda" ADD CONSTRAINT "pedidos_tienda_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
