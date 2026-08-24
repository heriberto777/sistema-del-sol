import { TipoAusencia } from '@prisma/client';

/**
 * Reglas de fábrica por tipo de ausencia, sembradas al provisionar un
 * tenant (ver TenantsRepository.crearConProvisioning) — mismos valores
 * que la migración `20260826090000_tipos_ausencia_config` sembró para
 * los tenants ya existentes. `conGoceDeSueldoPorDefecto` reproduce el
 * mapa CON_GOCE_POR_DEFECTO histórico de ausencias.service.ts
 * (INJUSTIFICADA sin goce, el resto con goce).
 */
export interface TipoAusenciaConfigBase {
  tipo: TipoAusencia;
  conGoceDeSueldoPorDefecto: boolean;
}

export const TIPOS_AUSENCIA_CONFIG_BASE: TipoAusenciaConfigBase[] = [
  { tipo: 'VACACIONES', conGoceDeSueldoPorDefecto: true },
  { tipo: 'ENFERMEDAD', conGoceDeSueldoPorDefecto: true },
  { tipo: 'PERMISO', conGoceDeSueldoPorDefecto: true },
  { tipo: 'MATERNIDAD_PATERNIDAD', conGoceDeSueldoPorDefecto: true },
  { tipo: 'INJUSTIFICADA', conGoceDeSueldoPorDefecto: false },
  { tipo: 'OTRO', conGoceDeSueldoPorDefecto: true },
];
