-- CreateTable
CREATE TABLE "tipos_ausencia_config" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoAusencia" NOT NULL,
    "maximoDiasPorAnio" INTEGER,
    "conGoceDeSueldoPorDefecto" BOOLEAN NOT NULL DEFAULT true,
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_ausencia_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tipos_ausencia_config_tenantId_tipo_key" ON "tipos_ausencia_config"("tenantId", "tipo");

ALTER TABLE "tipos_ausencia_config" ADD CONSTRAINT "tipos_ausencia_config_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sembrar las 6 filas para cada tenant ya existente, mismos defaults que
-- CON_GOCE_POR_DEFECTO en ausencias.service.ts (INJUSTIFICADA sin goce,
-- el resto con goce; todas requieren aprobación y sin tope de días).
INSERT INTO "tipos_ausencia_config" ("id", "tenantId", "tipo", "conGoceDeSueldoPorDefecto", "requiereAprobacion", "activo")
SELECT gen_random_uuid(), t."id", v."tipo"::"TipoAusencia", v."conGoce", true, true
FROM "tenants" t
CROSS JOIN (VALUES
    ('VACACIONES', true),
    ('ENFERMEDAD', true),
    ('PERMISO', true),
    ('MATERNIDAD_PATERNIDAD', true),
    ('INJUSTIFICADA', false),
    ('OTRO', true)
) AS v("tipo", "conGoce");
