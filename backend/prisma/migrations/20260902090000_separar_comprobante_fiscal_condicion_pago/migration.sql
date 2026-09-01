-- CreateEnum
CREATE TYPE "TipoComprobanteFiscal" AS ENUM ('CONSUMO', 'CREDITO_FISCAL', 'REGIMEN_ESPECIAL', 'GUBERNAMENTAL');

-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('CONTADO', 'CREDITO');

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "comprobanteFiscalPorDefecto" "TipoComprobanteFiscal";
ALTER TABLE "clientes" ADD COLUMN     "condicionPagoPorDefecto" "CondicionPago";
ALTER TABLE "clientes" ADD COLUMN     "plazoPagoDias" INTEGER NOT NULL DEFAULT 30;

-- Backfill: separar el valor viejo de "comprobantePorDefecto" (que
-- mezclaba comprobante fiscal y condición de pago) en los dos campos
-- nuevos, independientes.
UPDATE "clientes" SET
  "condicionPagoPorDefecto" = 'CONTADO',
  "comprobanteFiscalPorDefecto" = 'CONSUMO'
WHERE "comprobantePorDefecto" = 'CONTADO';

UPDATE "clientes" SET
  "condicionPagoPorDefecto" = 'CREDITO',
  "comprobanteFiscalPorDefecto" = 'CREDITO_FISCAL'
WHERE "comprobantePorDefecto" = 'CREDITO';

UPDATE "clientes" SET
  "comprobanteFiscalPorDefecto" = 'REGIMEN_ESPECIAL'
WHERE "comprobantePorDefecto" = 'REGIMEN_ESPECIAL';

UPDATE "clientes" SET
  "comprobanteFiscalPorDefecto" = 'GUBERNAMENTAL'
WHERE "comprobantePorDefecto" = 'GUBERNAMENTAL';

-- AlterTable
ALTER TABLE "clientes" DROP COLUMN "comprobantePorDefecto";

-- DropEnum
DROP TYPE "ComprobantePorDefecto";

-- AlterTable: mismo renombre en el borrador de carrito de POS (ítem
-- "separar Comprobante Fiscal de Opción de Pago") — dato efímero, sin
-- necesidad de transformar el contenido, solo el nombre de columna.
ALTER TABLE "carritos_borrador" RENAME COLUMN "tipoComprobanteEspecial" TO "comprobanteFiscal";
