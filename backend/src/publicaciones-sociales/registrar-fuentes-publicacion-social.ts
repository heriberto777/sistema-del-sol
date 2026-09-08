import { GlobalFonts } from '@napi-rs/canvas';
import { join } from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('PublicacionesSociales');

let registrado = false;

/**
 * El contenedor de producción (`node:20-slim`) no trae ninguna fuente
 * del sistema — sin esto, el texto de los banners saldría en blanco
 * (confirmado: `GlobalFonts.families` devuelve ~270 fuentes en Windows
 * dev por las fuentes del SO, pero 0 en un Debian slim limpio). Por eso
 * se embebe Inter (OFL) en `backend/assets/fonts/` en vez de depender
 * de fontconfig del SO — mismo criterio que justificó elegir
 * `@napi-rs/canvas` sobre `sharp`+SVG (`GlobalFonts.registerFromPath`
 * no necesita instalación a nivel de SO). Idempotente — seguro de
 * llamar más de una vez (ej. tests).
 */
export function registrarFuentesPublicacionSocial(): void {
  if (registrado) return;
  const dir = join(process.cwd(), 'assets', 'fonts');
  const okRegular = GlobalFonts.registerFromPath(join(dir, 'Inter-Regular.ttf'), 'Inter');
  const okBold = GlobalFonts.registerFromPath(join(dir, 'Inter-Bold.ttf'), 'Inter Bold');
  if (!okRegular || !okBold) {
    logger.warn(`No se pudieron registrar las fuentes de Publicaciones Sociales desde ${dir} — el texto de los banners puede salir vacío`);
  }
  registrado = true;
}
