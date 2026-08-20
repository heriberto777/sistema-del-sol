-- CreateTable
CREATE TABLE "usuario_sucursales" (
    "userId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,

    CONSTRAINT "usuario_sucursales_pkey" PRIMARY KEY ("userId","sucursalId")
);

-- AddForeignKey
ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "usuario_sucursales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "usuario_sucursales_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

