import { Blocks, BookOpen, Boxes, ShoppingBag, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import type { ItemMenu } from './menu-erp';

export interface CategoriaReportesHub {
  id: string;
  etiqueta: string;
  descripcion: string;
  icono: LucideIcon;
  items: ItemMenu[];
}

/**
 * Catálogo central de Reportes (`/reportes`) — benchmark 2026-11-09 contra
 * Cuadre.do/Alegra, Fase 3: ambos agrupan TODOS sus reportes en una sola
 * página de categorías con conteo y descripción (Alegra: 34 reportes en 7
 * categorías; Cuadre: 16 en 4).
 *
 * Benchmark 2026-11-11 — este archivo es ahora la ÚNICA fuente de verdad
 * para navegar a un reporte: la categoría `reportes` de cada dominio en
 * `menu-erp.ts` quedó vacía a propósito (mismo criterio que
 * `configuracion-hub.ts`/`configuracion`). Antes cada ítem de acá también
 * existía duplicado como entrada de sidebar en su propio dominio —
 * encontrado al auditar el sidebar contra el de Alegra (que tampoco repite
 * sus reportes en el menú del dominio, solo dentro de `/report`); de paso
 * se corrigió un ítem desincronizado (Ventas en el sidebar solo tenía 1 de
 * estos 4). Las rutas/permisos/módulos de abajo no cambiaron — sigue
 * siendo exactamente el mismo documento real al que apuntaba cada entrada
 * de sidebar que se quitó.
 */
export const REPORTES_HUB: CategoriaReportesHub[] = [
  {
    id: 'ventas',
    etiqueta: 'Ventas',
    descripcion: 'Qué y cuánto vendiste, agrupado y por comisión de vendedor.',
    icono: TrendingUp,
    items: [
      // Benchmark 2026-11-10 — antes era 1 solo ítem ("Ventas y comisiones")
      // que escondía los otros 3 reportes detrás de una barra de tabs
      // redundante (el sidebar solo tenía esta entrada, auditoría de
      // navegación duplicada). Alegra reparte cada reporte como su propia
      // card dentro de la categoría — mismo criterio acá.
      { id: 'reportes-ventas', etiqueta: 'Ventas', ruta: '/reportes/ventas', permisos: ['reportes.ver'] },
      { id: 'reportes-ventas-agrupadas', etiqueta: 'Ventas agrupadas', ruta: '/reportes/ventas-agrupadas', permisos: ['reportes.ver'] },
      { id: 'reportes-rentabilidad', etiqueta: 'Rentabilidad', ruta: '/reportes/rentabilidad', permisos: ['reportes.ver'] },
      { id: 'reportes-comisiones', etiqueta: 'Comisiones', ruta: '/reportes/comisiones', permisos: ['comisiones.ver'] },
    ],
  },
  {
    id: 'compras',
    etiqueta: 'Compras',
    descripcion: 'Qué y a quién le compraste, y retenciones aplicadas a proveedores.',
    icono: ShoppingBag,
    items: [
      { id: 'reportes-compras', etiqueta: 'Compras', ruta: '/reportes/compras', permisos: ['reportes.ver'] },
      {
        id: 'reportes-retenciones-proveedores',
        etiqueta: 'Retenciones a proveedores',
        ruta: '/reportes/retenciones-proveedores',
        permisos: ['reportes.ver'],
      },
    ],
  },
  {
    id: 'inventario',
    etiqueta: 'Inventario',
    descripcion: 'Existencias, movimientos y rotación de tu catálogo.',
    icono: Boxes,
    items: [{ id: 'reportes-inventario', etiqueta: 'Inventario y rotación', ruta: '/reportes/inventario', permisos: ['reportes.ver'] }],
  },
  {
    id: 'finanzas-fiscal',
    etiqueta: 'Finanzas y Fiscal',
    descripcion: 'Estados financieros y lo que hace falta para declarar ante la DGII.',
    icono: BookOpen,
    items: [
      { id: 'reportes-fiscal-dgii', etiqueta: 'Fiscal DGII', ruta: '/contabilidad/fiscal', permisos: ['reportes.ver'] },
      { id: 'balance-general', etiqueta: 'Balance general', ruta: '/contabilidad/balance-general', permisos: ['contabilidad.ver'] },
      { id: 'estado-resultados', etiqueta: 'Estado de resultados', ruta: '/contabilidad/estado-resultados', permisos: ['contabilidad.ver'] },
      { id: 'balance-comprobacion', etiqueta: 'Balance de comprobación', ruta: '/contabilidad/balance-comprobacion', permisos: ['contabilidad.ver'] },
    ],
  },
  {
    id: 'nomina',
    etiqueta: 'Nómina',
    descripcion: 'Retenciones de ISR de los períodos procesados.',
    icono: Users,
    items: [{ id: 'reportes-nomina', etiqueta: 'Retenciones de ISR', ruta: '/nomina/retenciones', permisos: ['reportes.ver'] }],
  },
  {
    id: 'modulos-activables',
    etiqueta: 'Módulos activables',
    descripcion: 'Resumen de cada módulo que tengas activo — solo aparecen los tuyos.',
    icono: Blocks,
    items: [
      { id: 'rentabilidad', etiqueta: 'Rentabilidad de Proyectos', ruta: '/proyectos', permisos: ['proyectos.rentabilidad.ver'], modulo: 'proyectos' },
      { id: 'crm-dashboard', etiqueta: 'Dashboard CRM', ruta: '/crm/dashboard', permisos: ['crm.reportes.ver'], modulo: 'crm' },
      { id: 'inmobiliaria-resumen', etiqueta: 'Resumen de Inmobiliaria', ruta: '/reportes/inmobiliaria', permisos: ['reportes.ver'], modulo: 'inmobiliaria' },
      { id: 'travel-resumen', etiqueta: 'Resumen de Travel', ruta: '/travel/resumen', permisos: ['travel.ver'], modulo: 'travel' },
      {
        id: 'publicaciones-resumen',
        etiqueta: 'Resumen de Publicaciones',
        ruta: '/reportes/publicaciones-sociales',
        permisos: ['reportes.ver'],
        modulo: 'publicacionessociales',
      },
      { id: 'tienda-resumen', etiqueta: 'Resumen de Tienda Online', ruta: '/reportes/tienda-online', permisos: ['reportes.ver'], modulo: 'ecommerce' },
    ],
  },
];
