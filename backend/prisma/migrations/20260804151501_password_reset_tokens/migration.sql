-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN     "resetPasswordExpiraEn" TIMESTAMP(3),
ADD COLUMN     "resetPasswordTokenHash" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resetPasswordExpiraEn" TIMESTAMP(3),
ADD COLUMN     "resetPasswordTokenHash" TEXT;
