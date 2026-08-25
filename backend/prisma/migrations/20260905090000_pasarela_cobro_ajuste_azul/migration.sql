/*
  Warnings:

  - You are about to drop the column `azulAuth1Cifrado` on the `pasarela_config_tenant` table. All the data in the column will be lost.
  - You are about to drop the column `azulAuth2Cifrado` on the `pasarela_config_tenant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pasarela_config_tenant" DROP COLUMN "azulAuth1Cifrado",
DROP COLUMN "azulAuth2Cifrado",
ADD COLUMN     "azulAuthKeyCifrado" TEXT,
ADD COLUMN     "azulCurrencyCode" TEXT DEFAULT '$';
