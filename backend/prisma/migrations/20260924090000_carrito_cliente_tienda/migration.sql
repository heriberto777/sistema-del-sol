-- Fase 16 (Tienda Online) — carrito persistente para un cliente de tienda logueado.
CREATE TABLE "carritos_cliente_tienda" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carritos_cliente_tienda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carritos_cliente_tienda_clienteId_key" ON "carritos_cliente_tienda"("clienteId");
