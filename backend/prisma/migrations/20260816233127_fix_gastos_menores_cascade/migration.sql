-- DropForeignKey
ALTER TABLE "cuentas_bancarias" DROP CONSTRAINT "cuentas_bancarias_cuentaContableId_fkey";

-- DropForeignKey
ALTER TABLE "gastos_menores" DROP CONSTRAINT "gastos_menores_cuentaBancariaId_fkey";

-- DropForeignKey
ALTER TABLE "lineas_gasto_menor" DROP CONSTRAINT "lineas_gasto_menor_cuentaContableId_fkey";

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_cuentaContableId_fkey" FOREIGN KEY ("cuentaContableId") REFERENCES "cuentas_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_menores" ADD CONSTRAINT "gastos_menores_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "cuentas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_gasto_menor" ADD CONSTRAINT "lineas_gasto_menor_cuentaContableId_fkey" FOREIGN KEY ("cuentaContableId") REFERENCES "cuentas_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
