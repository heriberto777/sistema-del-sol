/*
  Warnings:

  - You are about to drop the column `cardnetAuthKeyCifrado` on the `pasarela_config_tenant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pasarela_config_tenant" DROP COLUMN "cardnetAuthKeyCifrado",
ADD COLUMN     "cardnetAcquiringInstitutionCode" TEXT,
ADD COLUMN     "cardnetMerchantTerminalAmex" TEXT,
ADD COLUMN     "cardnetMerchantType" TEXT;
