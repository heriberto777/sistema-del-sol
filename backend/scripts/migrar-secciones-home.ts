import { PrismaClient, TipoSeccionTienda } from '@prisma/client';
import { CLAVE_TIENDA_PLANTILLA, CLAVE_TIENDA_TEMA, PlantillaTienda } from '../src/ecommerce/resolver-config-tienda';

/**
 * Fase 18 (Home 100% dinámico) — antes de esta fase, Hero/Destacados/
 * Ofertas estaban hardcodeados en el JSX de cada una de las 17
 * plantillas. Ahora son secciones más de `SeccionTienda`
 * (tipos HERO/DESTACADOS/OFERTAS/FRANJA_CONFIANZA) — un tenant creado
 * ANTES de este deploy no tiene esas filas, así que sin este script su
 * Home quedaría vacío entre Nav y Footer (mismo problema que
 * `permisos:backfill`/`backfill-plantillas-publicaciones-sociales`).
 *
 * Reconstruye el copy EXACTO que cada plantilla tenía hardcodeado (ver
 * el diff del commit de esta fase), para que ningún tenant vea un
 * cambio visual el día del deploy — de ahí en más, un admin puede
 * editar/reordenar/ocultar/borrar esas secciones libremente desde
 * "Secciones del Home".
 *
 * `MERCADO`/`VITRINA` NO reciben HERO: esas 2 plantillas conservan su
 * propio Hero hardcodeado (grid combinado con banner en Mercado; hero
 * con buscador funcional en Vitrina) — agregarles además un HERO
 * dinámico duplicaría el bloque de bienvenida. Vitrina sí recibe
 * FRANJA_CONFIANZA (reemplaza su franja de 3 íconos, que si se borró
 * del código).
 *
 * Idempotente: si el tenant YA tiene alguna sección de estos 4 tipos
 * (ej. porque este script ya corrió, o alguien ya armó su Home a mano
 * después del deploy), no toca nada — nunca pisa ni duplica.
 *
 * Uso: pnpm --filter ./backend secciones-home:backfill
 */

const SUBTITULO_HERO_POR_PLANTILLA: Partial<Record<PlantillaTienda, string>> = {
  BASE: 'Piezas que ya sabés que vas a usar — sin ruido, sin descuentos gritados.',
  AMPLIA: 'Ropa que se adapta a vos — de la XS a la 4X, con la misma atención al detalle.',
  BRUMA: 'Fórmulas simples, empaques honestos — pensado para vos.',
  DIRECTO: 'Todo el surtido, con precio y disponibilidad reales.',
  DISTRITO: 'Curaduría de marcas seleccionadas, con la garantía y el servicio de siempre.',
  BOUTIQUE: 'Piezas seleccionadas, disponibilidad real.',
  CHISPA: 'Accesorios y regalitos que alegran el feed y el bolsillo.',
  BLOQUE: 'Piezas limitadas, sin restock — lo que se agota, se agotó.',
  BAZAR: 'Encontrá lo que buscás — catálogo completo, precio y disponibilidad reales.',
  NODO: 'Lo último en tecnología, con garantía y soporte local.',
  OFICIO: 'Tallas surtidas, facturación empresarial y despacho a domicilio.',
  ROPERO: 'Cada prenda tiene una sola unidad — cuando se va, no vuelve.',
  SOLMARKET: 'Piezas seleccionadas, todo bajo el mismo sol.',
  // ATELIER/EDITORIAL: solo tenían título, sin subtítulo — queda undefined a propósito.
};

/** Mantienen su propio Hero hardcodeado — ver comentario de arriba. */
const PLANTILLAS_SIN_HERO_DINAMICO = new Set<PlantillaTienda>(['MERCADO', 'VITRINA']);

interface SeccionASembrar {
  tipo: TipoSeccionTienda;
  titulo: string;
  subtitulo?: string;
  orden: number;
  contenido?: { icono: string; texto: string }[];
}

async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let totalTenants = 0;

  for (const tenant of tenants) {
    const yaTieneAlguna = await prisma.seccionTienda.findFirst({
      where: { tenantId: tenant.id, tipo: { in: ['HERO', 'DESTACADOS', 'OFERTAS', 'FRANJA_CONFIANZA'] } },
    });
    if (yaTieneAlguna) continue;

    const [configPlantilla, configTema] = await Promise.all([
      prisma.configuracion.findUnique({ where: { tenantId_clave: { tenantId: tenant.id, clave: CLAVE_TIENDA_PLANTILLA } } }),
      prisma.configuracion.findUnique({ where: { tenantId_clave: { tenantId: tenant.id, clave: CLAVE_TIENDA_TEMA } } }),
    ]);
    const plantilla = (configPlantilla?.valor as PlantillaTienda) ?? 'DIRECTO';

    let mostrarOfertas = true;
    if (configTema?.valor) {
      try {
        const parseado = JSON.parse(configTema.valor);
        if (typeof parseado.mostrarSeccionOfertas === 'boolean') mostrarOfertas = parseado.mostrarSeccionOfertas;
      } catch {
        // JSON corrupto — cae al default `true`, mismo criterio que ya usaba resolverTemaTienda.
      }
    }

    const secciones: SeccionASembrar[] = [];
    let orden = -100;

    if (!PLANTILLAS_SIN_HERO_DINAMICO.has(plantilla)) {
      secciones.push({ tipo: 'HERO', titulo: tenant.nombre, subtitulo: SUBTITULO_HERO_POR_PLANTILLA[plantilla], orden: orden++ });
    }
    secciones.push({ tipo: 'DESTACADOS', titulo: 'Destacados', orden: orden++ });
    if (mostrarOfertas) {
      secciones.push({ tipo: 'OFERTAS', titulo: 'Ofertas', orden: orden++ });
    }
    if (plantilla === 'VITRINA') {
      secciones.push({
        tipo: 'FRANJA_CONFIANZA',
        titulo: '',
        contenido: [
          { icono: 'Truck', texto: 'Envío a todo el país' },
          { icono: 'ShieldCheck', texto: 'Pago seguro' },
          { icono: 'ShoppingCart', texto: 'Compra fácil' },
        ],
        orden: orden++,
      });
    }

    await prisma.seccionTienda.createMany({
      data: secciones.map((s) => ({ tenantId: tenant.id, ...s })),
    });
    totalTenants += 1;
    console.log(`${tenant.nombre} (${plantilla}): +${secciones.length} sección(es) — ${secciones.map((s) => s.tipo).join(', ')}`);
  }

  console.log(
    totalTenants > 0
      ? `Listo: ${totalTenants} tenant(s) migrado(s).`
      : 'Nada que migrar — todos los tenants ya tienen HERO/DESTACADOS/OFERTAS/FRANJA_CONFIANZA.',
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
