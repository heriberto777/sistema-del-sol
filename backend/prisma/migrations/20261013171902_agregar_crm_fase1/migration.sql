-- CreateEnum
CREATE TYPE "OrigenLead" AS ENUM ('MANUAL', 'WHATSAPP', 'FORMULARIO_WEB', 'IMPORTACION', 'REFERIDO');

-- CreateEnum
CREATE TYPE "EstadoLead" AS ENUM ('NUEVO', 'CONTACTADO', 'CALIFICADO', 'DESCARTADO', 'CONVERTIDO');

-- CreateEnum
CREATE TYPE "EstadoOportunidad" AS ENUM ('ABIERTA', 'GANADA', 'PERDIDA');

-- CreateEnum
CREATE TYPE "TipoActividadCrm" AS ENUM ('LLAMADA', 'REUNION', 'EMAIL', 'NOTA', 'TAREA');

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "origen" "OrigenLead" NOT NULL DEFAULT 'MANUAL',
    "estado" "EstadoLead" NOT NULL DEFAULT 'NUEVO',
    "motivoDescarte" TEXT,
    "notas" TEXT,
    "vendedorId" TEXT,
    "clienteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_etapas_pipeline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "probabilidadDefault" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#c2660c',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_etapas_pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_oportunidades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "clienteId" TEXT,
    "leadId" TEXT,
    "etapaId" TEXT NOT NULL,
    "montoEstimado" DECIMAL(14,2) NOT NULL,
    "probabilidadPct" INTEGER NOT NULL DEFAULT 0,
    "fechaCierreEstimada" TIMESTAMP(3) NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "estado" "EstadoOportunidad" NOT NULL DEFAULT 'ABIERTA',
    "motivoPerdida" TEXT,
    "cotizacionId" TEXT,
    "fechaCierreReal" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_actividades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoActividadCrm" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "clienteId" TEXT,
    "leadId" TEXT,
    "oportunidadId" TEXT,
    "fechaProgramada" TIMESTAMP(3),
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_actividades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_leads_clienteId_key" ON "crm_leads"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_etapas_pipeline_tenantId_nombre_key" ON "crm_etapas_pipeline"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "crm_oportunidades_cotizacionId_key" ON "crm_oportunidades"("cotizacionId");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_etapas_pipeline" ADD CONSTRAINT "crm_etapas_pipeline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "crm_etapas_pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_actividades" ADD CONSTRAINT "crm_actividades_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_actividades" ADD CONSTRAINT "crm_actividades_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_actividades" ADD CONSTRAINT "crm_actividades_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_actividades" ADD CONSTRAINT "crm_actividades_oportunidadId_fkey" FOREIGN KEY ("oportunidadId") REFERENCES "crm_oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_actividades" ADD CONSTRAINT "crm_actividades_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
