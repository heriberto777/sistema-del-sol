-- Fase 3, bug real encontrado en e2e: ComprasService.registrarPago siempre
-- permitió pagar una orden ANTES de recibirla (anticipo a proveedor) — con
-- CuentaPorPagar naciendo solo por recepción, esa orden no tenía ninguna
-- fila todavía y el pago quedaba sin dónde aplicarse. recepcionCompraId
-- nullable habilita una fila "de orden completa" (ver
-- PagosRepository.registrarCobroOrdenCompra / ComprasService.recibir()).
ALTER TABLE "cuentas_por_pagar" ALTER COLUMN "recepcionCompraId" DROP NOT NULL;
